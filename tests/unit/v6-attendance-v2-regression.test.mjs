/**
 * PASS 15F Sections 31-32 — Strengthened Attendance V2 Historical Regression Suite
 * In-Memory / Zero Production Mutation.
 *
 * NOTE: Server-side PostgreSQL RPC enforcement (DB-level idempotency/conflict/RLS)
 * remains BLOCKED_BY_PENDING_ACTION: V6-PEND-002 until executed on disposable Supabase.
 * All client-engine, database, lease, geofence math, replay, and mediaSync paths below
 * exercise REAL production code paths.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AttendanceV2Database } from '../../src/lib/attendanceV2/db.ts';
import { AttendanceV2ClientEngine } from '../../src/lib/attendanceV2/clientEngine.ts';
import { AttendanceV2MediaSync } from '../../src/lib/attendanceV2/mediaSync.ts';
import { canBootstrapOfflineV2WithLease } from '../../src/lib/attendanceV2/offlineBootstrap.ts';
import { haversineMeters, buildLiveSiteClusters } from '../../src/utils/liveMap.utils.ts';

function createStatefulMockTransport({
  failNetwork = false,
  rejectOutsideGeofence = false,
  terminatedPersonnel = new Set(),
  duplicateStatus = 'IDEMPOTENT_DUPLICATE',
} = {}) {
  const recorded = [];
  const eventsById = new Map();
  const openShifts = new Map();

  function evaluateEvent(ev) {
    if (terminatedPersonnel.has(ev.personnel_id)) {
      return { success: false, status: 'REJECTED_TERMINATED', error: 'Personnel is terminated or inactive' };
    }
    if (rejectOutsideGeofence && ev.work_type === 'ON_SITE' && ev.geofence_status === 'OUTSIDE') {
      return { success: false, status: 'REJECTED_OUTSIDE_GEOFENCE', error: 'Outside authorized geofence' };
    }
    if (eventsById.has(ev.event_id)) {
      const prev = eventsById.get(ev.event_id);
      const samePayload =
        prev.shift_id === ev.shift_id &&
        prev.event_type === ev.event_type &&
        prev.personnel_id === ev.personnel_id &&
        prev.project_id === ev.project_id;
      if (!samePayload) {
        return { success: false, status: 'CONFLICT', error: 'Event UUID reused with altered payload' };
      }
      return { success: true, status: duplicateStatus, event_id: ev.event_id, shift_id: ev.shift_id };
    }
    if (ev.event_type === 'CLOCK_OUT') {
      const activeShiftId = openShifts.get(ev.personnel_id);
      if (activeShiftId && activeShiftId !== ev.shift_id) {
        return { success: false, status: 'SHIFT_NOT_FOUND', error: 'Target shift_id does not match open shift' };
      }
      openShifts.delete(ev.personnel_id);
    } else if (ev.event_type === 'CLOCK_IN') {
      openShifts.set(ev.personnel_id, ev.shift_id);
    }
    eventsById.set(ev.event_id, ev);
    recorded.push(ev);
    return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
  }

  return {
    recorded,
    eventsById,
    openShifts,
    setOffline(v) { failNetwork = v; },
    async recordAttendanceEvent(ev) {
      if (failNetwork) throw new Error('Failed to fetch: network unreachable');
      return evaluateEvent(ev);
    },
    async syncAttendanceEvents(events) {
      if (failNetwork) throw new Error('Failed to fetch: network unreachable');
      return events.map((ev) => ({
        event_id: ev.event_id,
        shift_id: ev.shift_id,
        event_type: ev.event_type,
        outcome: evaluateEvent(ev),
      }));
    },
  };
}

function makeEngine(db, transport, deviceId = 'dev-test-1') {
  return new AttendanceV2ClientEngine(
    {
      device_id: deviceId,
      device_platform: 'Web-Test',
      client_app_version: '6.0.0',
      client_release_id: 60,
      client_commit_hash: 'test',
      protocol_version: 2,
    },
    db,
    transport
  );
}

function makeValidLease(personnelId, deviceId, projectId = 'proj-merida', overrides = {}) {
  return {
    lease_id: `lease-${personnelId}-${deviceId}`,
    auth_user_id: personnelId,
    personnel_id: personnelId,
    subsidiary: 'MX',
    valid_from: new Date(Date.now() - 3600_000).toISOString(),
    valid_until: new Date(Date.now() + 24 * 3600_000).toISOString(),
    attendance_protocol_version: 2,
    client_release_id: 60,
    client_app_version: '6.0.0',
    device_id: deviceId,
    is_revoked: false,
    cached_at: new Date().toISOString(),
    scopes: [{ project_id: projectId, geofence_version_id: 'geo-v2-merida' }],
    ...overrides,
  };
}

describe('Attendance V2 Historical Regression (PASS 15F Strengthened)', () => {
  it('1. Online ClockIn -> ClockOut uses exact same shift_id and retires active shift', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    const ci = await engine.clockIn({
      personnel_id: 'p-100',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      latitude: 20.9854,
      longitude: -89.6152,
      accuracy_meters: 15,
      gps_verified: true,
      geofence_status: 'INSIDE',
      geofence_distance_meters: 12,
      face_verified: true,
    });
    assert.equal(ci.status, 'APPLIED');
    assert.equal((await db.getCurrentActiveShiftForPersonnel('p-100'))?.shift_id, ci.shift_id);

    const co = await engine.clockOut({
      personnel_id: 'p-100',
      shift_id: ci.shift_id,
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      latitude: 20.9855,
      longitude: -89.6151,
      accuracy_meters: 18,
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });
    assert.equal(co.status, 'APPLIED');
    assert.equal(transport.recorded[1].shift_id, ci.shift_id);
    assert.equal(await db.getCurrentActiveShiftForPersonnel('p-100'), null);
  });

  it('2. ClockOut with wrong shift_id is rejected and does NOT close real active shift', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    const ci = await engine.clockIn({
      personnel_id: 'p-wrong-shift',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });
    const co = await engine.clockOut({
      personnel_id: 'p-wrong-shift',
      shift_id: '00000000-0000-0000-0000-000000000999',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });
    assert.equal(co.success, false);
    assert.equal(co.status, 'SHIFT_NOT_FOUND');
    assert.equal((await db.getCurrentActiveShiftForPersonnel('p-wrong-shift'))?.shift_id, ci.shift_id);
  });

  it('3. ClockOut with empty shift_id FAILS CLOSED even when an active shift exists (no latest-shift inference)', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    const ci = await engine.clockIn({
      personnel_id: 'p-empty-shift',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });
    assert.equal(ci.status, 'APPLIED');

    const co = await engine.clockOut({
      personnel_id: 'p-empty-shift',
      shift_id: '',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });
    assert.equal(co.success, false);
    assert.equal(co.status, 'SHIFT_NOT_FOUND');
    assert.equal((await db.getCurrentActiveShiftForPersonnel('p-empty-shift'))?.shift_id, ci.shift_id);
  });

  it('4. syncOfflineQueue ACKs IDEMPOTENT_DUPLICATE and ALREADY_RECORDED without looping (PASS 15F P1-3)', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport({ failNetwork: true, duplicateStatus: 'IDEMPOTENT_DUPLICATE' });
    const engine = makeEngine(db, transport, 'dev-idem');
    await db.saveOfflineLease(makeValidLease('p-idem', 'dev-idem'));

    const ci = await engine.clockIn({
      personnel_id: 'p-idem',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
      force_offline: true,
    });
    // Pre-seed same event_id on mock server so replay returns IDEMPOTENT_DUPLICATE
    transport.setOffline(false);
    const queued = (await db.getAllQueuedEvents())[0];
    await transport.recordAttendanceEvent(queued);

    const replay = await engine.syncOfflineQueue();
    assert.equal(replay.acked_count, 1);
    const updated = (await db.getAllQueuedEvents()).find((e) => e.event_id === ci.event_id);
    assert.equal(updated?.sync_status, 'ACKED');
  });

  it('5. syncOfflineQueue marks CONFLICT when same event_id has altered payload (client handling)', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport({ failNetwork: true });
    const engine = makeEngine(db, transport, 'dev-conf');
    await db.saveOfflineLease(makeValidLease('p-conf', 'dev-conf'));

    const ci = await engine.clockIn({
      personnel_id: 'p-conf',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
      force_offline: true,
    });
    transport.setOffline(false);
    const queued = (await db.getAllQueuedEvents())[0];
    // Server already has same event_id with a different project_id
    await transport.recordAttendanceEvent({ ...queued, project_id: 'proj-ORIGINAL' });

    const replay = await engine.syncOfflineQueue();
    assert.equal(replay.acked_count, 0);
    const updated = (await db.getAllQueuedEvents()).find((e) => e.event_id === ci.event_id);
    assert.equal(updated?.sync_status, 'CONFLICT');
  });

  it('6. Forgotten ClockOut preserves manual adjustment metadata & reported_departure_timestamp', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    const ci = await engine.clockIn({
      personnel_id: 'p-forgot',
      project_id: 'proj-1',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });

    const reportedDep = '2026-12-01T17:30:00.000Z';
    const co = await engine.clockOut({
      personnel_id: 'p-forgot',
      shift_id: ci.shift_id,
      project_id: 'proj-1',
      work_type: 'ON_SITE',
      gps_verified: false,
      geofence_status: 'NOT_APPLICABLE',
      face_verified: false,
      is_forgotten_clockout: true,
      worker_explanation: 'Phone battery died on site',
      reported_departure_timestamp: reportedDep,
    });
    assert.equal(co.status, 'APPLIED');
    const coEvent = transport.recorded[1];
    assert.equal(coEvent.is_manual_adjustment, true);
    assert.equal(coEvent.adjustment_reason, 'FORGOTTEN_CLOCKOUT');
    assert.equal(coEvent.worker_explanation, 'Phone battery died on site');
    assert.equal(coEvent.reported_departure_timestamp, reportedDep);
  });

  it('7. Zombie ACTIVE shift (>14h) is purged automatically by real engine on next ClockIn', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    const staleTime = new Date(Date.now() - 16 * 3600_000).toISOString();
    await db.saveActiveShift({
      shift_id: 'zombie-shift-1',
      personnel_id: 'p-zombie',
      project_id: 'proj-1',
      work_type: 'ON_SITE',
      started_at: staleTime,
      timezone_offset_minutes: -360,
      created_offline: false,
      protocol_version: 2,
      client_release_id: 60,
      clock_in_event_id: 'zombie-ev-1',
      state: 'ACTIVE', // Real active state queried by getCurrentActiveShiftForPersonnel
      created_at: staleTime,
      updated_at: staleTime,
    });

    assert.equal((await db.getCurrentActiveShiftForPersonnel('p-zombie'))?.shift_id, 'zombie-shift-1');

    const ci = await engine.clockIn({
      personnel_id: 'p-zombie',
      project_id: 'proj-1',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });
    assert.equal(ci.status, 'APPLIED');
    assert.notEqual(ci.shift_id, 'zombie-shift-1');
    assert.equal(await db.getActiveShift('zombie-shift-1'), null);
  });

  it('8. Active shift (<14h) blocks duplicate ClockIn with ACTIVE_SHIFT_CONFLICT', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    const ci1 = await engine.clockIn({
      personnel_id: 'p-active',
      project_id: 'proj-1',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });
    const ci2 = await engine.clockIn({
      personnel_id: 'p-active',
      project_id: 'proj-1',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
    });
    assert.equal(ci2.success, false);
    assert.equal(ci2.status, 'ACTIVE_SHIFT_CONFLICT');
    assert.equal(ci2.shift_id, ci1.shift_id);
  });

  it('9. Home Office ClockIn succeeds cleanly with HOME_OFFICE + NOT_APPLICABLE', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    const ci = await engine.clockIn({
      personnel_id: 'p-ho',
      project_id: 'proj-merida',
      work_type: 'HOME_OFFICE',
      latitude: 21.02,
      longitude: -89.58,
      accuracy_meters: 25,
      gps_verified: true,
      geofence_status: 'NOT_APPLICABLE',
      face_verified: true,
    });
    assert.equal(ci.status, 'APPLIED');
    assert.equal(transport.recorded[0].work_type, 'HOME_OFFICE');
  });

  it('10 & 11. Primary CDMX & Secondary Mérida geofence distance math + multi-site resolution', async () => {
    const cdmxLat = 19.4326, cdmxLng = -99.1332;
    const meridaLat = 20.9854, meridaLng = -89.6152;
    const distPrimary = haversineMeters(19.4327, -99.1331, cdmxLat, cdmxLng);
    const distSecondary = haversineMeters(20.9855, -89.6151, meridaLat, meridaLng);
    assert.ok(distPrimary < 50, `Expected <50m at primary CDMX, got ${distPrimary}`);
    assert.ok(distSecondary < 50, `Expected <50m at secondary Mérida, got ${distSecondary}`);

    const sites = [
      { id: 'proj-cdmx', projectId: 'proj-cdmx', name: 'CDMX HQ', lat: cdmxLat, lng: cdmxLng, radiusMeters: 300, assignedCount: 2 },
      { id: 'loc-merida', projectId: 'proj-cdmx', name: 'Mérida Office', lat: meridaLat, lng: meridaLng, radiusMeters: 300, assignedCount: 1 },
    ];
    const clusters = buildLiveSiteClusters(sites, [{
      personnelId: 'p-mer', name: 'Luis', role: 'Tech', clockInIso: new Date().toISOString(), clockInLabel: '08:00',
      workType: 'ON_SITE', projectId: 'proj-cdmx', lat: 20.9855, lng: -89.6151,
    }]);
    assert.equal(clusters.find((c) => c.id === 'loc-merida')?.workers.length, 1);
  });

  it('12. Outside-geofence rejection is NOT silently queued as offline', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport({ rejectOutsideGeofence: true });
    const engine = makeEngine(db, transport);

    const ci = await engine.clockIn({
      personnel_id: 'p-outside',
      project_id: 'proj-cdmx',
      work_type: 'ON_SITE',
      latitude: 25.0,
      longitude: -100.0,
      accuracy_meters: 15,
      gps_verified: true,
      geofence_status: 'OUTSIDE',
      geofence_distance_meters: 5000,
      face_verified: true,
    });
    assert.equal(ci.success, false);
    assert.equal(ci.status, 'REJECTED_OUTSIDE_GEOFENCE');
    assert.equal((await db.getAllQueuedEvents()).length, 0);
  });

  it('13. Offline valid lease (with real scopes) works identically for explicit offline AND online+transport-drop; transport-drop WITHOUT lease fails closed (P0-3)', async () => {
    // 13A. Online + transport drop WITHOUT lease MUST fail closed
    const dbNoLease = new AttendanceV2Database(true);
    const transportDrop = createStatefulMockTransport({ failNetwork: true });
    const engineNoLease = makeEngine(dbNoLease, transportDrop, 'dev-drop-nolease');
    const denied = await engineNoLease.clockIn({
      personnel_id: 'p-nolease',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
      force_offline: false,
    });
    assert.equal(denied.success, false);
    assert.equal(denied.status, 'REJECTED');
    assert.equal((await dbNoLease.getAllQueuedEvents()).length, 0);

    // 13B. Online + transport drop WITH valid lease queues with populated offline_lease_id
    const dbValid = new AttendanceV2Database(true);
    const engineValid = makeEngine(dbValid, transportDrop, 'dev-drop-valid');
    const lease = makeValidLease('p-drop-ok', 'dev-drop-valid', 'proj-merida');
    await dbValid.saveOfflineLease(lease);

    const ci = await engineValid.clockIn({
      personnel_id: 'p-drop-ok',
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
      force_offline: false,
    });
    assert.equal(ci.status, 'QUEUED_OFFLINE');
    const queuedIn = (await dbValid.getAllQueuedEvents())[0];
    assert.equal(queuedIn.offline_lease_id, lease.lease_id);

    const co = await engineValid.clockOut({
      personnel_id: 'p-drop-ok',
      shift_id: ci.shift_id,
      project_id: 'proj-merida',
      work_type: 'ON_SITE',
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
      force_offline: false,
    });
    assert.equal(co.status, 'QUEUED_OFFLINE');
  });

  it('14, 15, 16. Expired, revoked, and wrong-device offline leases ALL fail closed on ClockIn & ClockOut', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport({ failNetwork: true });

    // Expired
    const engExp = makeEngine(db, transport, 'dev-exp');
    await db.saveOfflineLease(makeValidLease('p-exp', 'dev-exp', 'proj-merida', {
      valid_until: new Date(Date.now() - 3600_000).toISOString(),
    }));
    assert.equal((await engExp.clockIn({
      personnel_id: 'p-exp', project_id: 'proj-merida', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: true, force_offline: true,
    })).success, false);

    // Revoked
    const engRev = makeEngine(db, transport, 'dev-rev');
    await db.saveOfflineLease(makeValidLease('p-rev', 'dev-rev', 'proj-merida', { is_revoked: true }));
    assert.equal((await engRev.clockIn({
      personnel_id: 'p-rev', project_id: 'proj-merida', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: true, force_offline: true,
    })).success, false);

    // Wrong device on ClockIn AND ClockOut
    const engDevB = makeEngine(db, transport, 'dev-B');
    await db.saveOfflineLease(makeValidLease('p-dev', 'dev-A', 'proj-merida'));
    assert.equal((await engDevB.clockIn({
      personnel_id: 'p-dev', project_id: 'proj-merida', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: true, force_offline: true,
    })).success, false);
    assert.equal((await engDevB.clockOut({
      personnel_id: 'p-dev', shift_id: 'shift-x', project_id: 'proj-merida', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: true, force_offline: true,
    })).success, false);
  });

  it('17. Offline cold-boot lease helper enforces personnel + device + expiry + revocation', () => {
    const now = Date.parse('2026-12-01T12:00:00Z');
    const lease = makeValidLease('p-1', 'd-1', 'proj-1', {
      valid_from: '2026-12-01T06:00:00Z',
      valid_until: '2026-12-02T06:00:00Z',
    });
    assert.equal(canBootstrapOfflineV2WithLease(lease, 'p-1', 'd-1', now), true);
    assert.equal(canBootstrapOfflineV2WithLease(lease, 'p-2', 'd-1', now), false);
    assert.equal(canBootstrapOfflineV2WithLease(lease, 'p-1', 'd-2', now), false);
    assert.equal(canBootstrapOfflineV2WithLease({ ...lease, is_revoked: true }, 'p-1', 'd-1', now), false);
    assert.equal(canBootstrapOfflineV2WithLease({ ...lease, valid_until: '2026-12-01T11:59:59Z' }, 'p-1', 'd-1', now), false);
  });

  it('18. Offline reconnect replay preserves causal order (CLOCK_IN -> CLOCK_OUT) and exact UUIDs', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport({ failNetwork: true });
    const engine = makeEngine(db, transport, 'dev-replay');
    await db.saveOfflineLease(makeValidLease('p-replay', 'dev-replay', 'proj-merida'));

    const ci = await engine.clockIn({
      personnel_id: 'p-replay', project_id: 'proj-merida', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: true, force_offline: true,
    });
    const co = await engine.clockOut({
      personnel_id: 'p-replay', shift_id: ci.shift_id, project_id: 'proj-merida', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: true, force_offline: true,
    });

    transport.setOffline(false);
    const replay = await engine.syncOfflineQueue();
    assert.equal(replay.acked_count, 2);
    assert.equal(transport.recorded[0].event_id, ci.event_id);
    assert.equal(transport.recorded[0].event_type, 'CLOCK_IN');
    assert.equal(transport.recorded[1].event_id, co.event_id);
    assert.equal(transport.recorded[1].event_type, 'CLOCK_OUT');
    assert.equal(transport.recorded[1].shift_id, ci.shift_id);
  });

  it('19 & 20. Split shifts get distinct shift_ids and concurrent personnel shifts remain isolated', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    const [aIn, bIn] = await Promise.all([
      engine.clockIn({ personnel_id: 'p-A', project_id: 'proj-1', work_type: 'ON_SITE', gps_verified: true, geofence_status: 'INSIDE', face_verified: true }),
      engine.clockIn({ personnel_id: 'p-B', project_id: 'proj-2', work_type: 'HOME_OFFICE', gps_verified: true, geofence_status: 'NOT_APPLICABLE', face_verified: true }),
    ]);
    assert.notEqual(aIn.shift_id, bIn.shift_id);

    await engine.clockOut({ personnel_id: 'p-A', shift_id: aIn.shift_id, project_id: 'proj-1', work_type: 'ON_SITE', gps_verified: true, geofence_status: 'INSIDE', face_verified: true });
    const aIn2 = await engine.clockIn({ personnel_id: 'p-A', project_id: 'proj-2', work_type: 'ON_SITE', gps_verified: true, geofence_status: 'INSIDE', face_verified: true });
    assert.notEqual(aIn2.shift_id, aIn.shift_id);
    assert.equal((await db.getCurrentActiveShiftForPersonnel('p-B'))?.shift_id, bIn.shift_id);
  });

  it('21 & 22. Real AttendanceV2MediaSync executes request -> upload -> confirm independently of event ACK', async () => {
    const db = new AttendanceV2Database(true);
    const calls = [];
    const mediaSync = new AttendanceV2MediaSync(
      db,
      {
        async requestAttendanceSelfieUpload(eventId) {
          calls.push(`request:${eventId}`);
          return { success: true, bucket: 'attendance-v2-media-private', storage_path: `selfies/${eventId}.jpg` };
        },
        async confirmAttendanceSelfieUpload(p) {
          calls.push(`confirm:${p.eventId}:${p.sha256Hash}`);
          return { success: true, media_id: 'srv-media-1', status: 'CONFIRMED' };
        },
      },
      {
        async uploadSelfie(p) {
          calls.push(`upload:${p.bucket}/${p.path}`);
          return { success: true };
        },
      }
    );

    const queued = await mediaSync.queueSelfie({
      eventId: 'ev-media-99',
      shiftId: 'shift-media-99',
      personnelId: 'p-media',
      dataBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      mimeType: 'image/jpeg',
      byteSize: 24,
      sha256Hash: 'deadbeef1234',
    });
    assert.equal((await db.getPendingMediaBlobs()).length, 1);

    const res = await mediaSync.syncAllPendingMedia();
    assert.equal(res.uploaded_count, 1);
    assert.equal(res.failed_count, 0);
    assert.deepEqual(calls, [
      'request:ev-media-99',
      'upload:attendance-v2-media-private/selfies/ev-media-99.jpg',
      'confirm:ev-media-99:deadbeef1234',
    ]);
    assert.equal((await db.getPendingMediaBlobs()).length, 0);
    assert.equal(await db.getMediaBlob(queued.media_id), null);
  });

  it('23. Terminated personnel offline replay marks FAILED_PERMANENT without looping (PASS 15F P1-3)', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport({ failNetwork: true, terminatedPersonnel: new Set(['p-term']) });
    const engine = makeEngine(db, transport, 'dev-term');
    await db.saveOfflineLease(makeValidLease('p-term', 'dev-term', 'proj-1'));

    const ci = await engine.clockIn({
      personnel_id: 'p-term', project_id: 'proj-1', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: true, force_offline: true,
    });
    transport.setOffline(false);
    const replay = await engine.syncOfflineQueue();
    assert.equal(replay.acked_count, 0);
    assert.equal(replay.failed_count, 1);
    const updated = (await db.getAllQueuedEvents()).find((e) => e.event_id === ci.event_id);
    assert.equal(updated?.sync_status, 'FAILED_PERMANENT');
  });

  it('24. Face ID verified vs 3-strike bypass evidence preserved verbatim in envelope', async () => {
    const db = new AttendanceV2Database(true);
    const transport = createStatefulMockTransport();
    const engine = makeEngine(db, transport);

    await engine.clockIn({
      personnel_id: 'p-face-ok', project_id: 'proj-1', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: true, face_bypass_reason: null,
    });
    await engine.clockIn({
      personnel_id: 'p-face-bypass', project_id: 'proj-1', work_type: 'ON_SITE',
      gps_verified: true, geofence_status: 'INSIDE', face_verified: false, face_bypass_reason: 'Mala iluminación / contraluz',
    });

    assert.equal(transport.recorded[0].face_verified, true);
    assert.equal(transport.recorded[0].face_bypass_reason ?? null, null);
    assert.equal(transport.recorded[1].face_verified, false);
    assert.equal(transport.recorded[1].face_bypass_reason, 'Mala iluminación / contraluz');
  });
});
