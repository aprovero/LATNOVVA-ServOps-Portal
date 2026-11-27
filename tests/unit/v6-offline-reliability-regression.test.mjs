/**
 * PASS 15J-P1 — Offline Attendance Reliability Regression Suite (V6-PEND-021 & V6-PEND-022)
 *
 * Exercises the ACTUAL R60 AttendanceV2ClientEngine and AttendanceV2Database
 * against controlled in-process transport fixtures (zero production contact).
 *
 * Covers Regression Matrix scenarios:
 *   A. Normal offline replay (CLOCK_IN -> CLOCK_OUT)
 *   B. Temporary prerequisite failure -> automatic dependent recovery
 *   C. Malformed or missing server acknowledgement
 *   D. Permanent prerequisite rejection (no endless retry, preserved evidence)
 *   E. Concurrent synchronization (single-flight + coalesced newly queued work + observability)
 *   F. Unexpected synchronization exception (lock safely released, subsequent retry succeeds)
 *   G. Multiple offline shifts (failed shift does not block unrelated eligible shift)
 *   H. Duplicate acknowledgement & idempotent replay
 *   I. Existing stranded historical DEPENDENCY_FAILED records (safe recovery vs permanent block)
 *   J. Application reload during synchronization (stale SYNCING recovery, fresh SYNCING respected)
 *   L. Connectivity loss during replay (preserve unresolved events, resume after reconnect)
 *   + SyncStatus UI observability & intervention-state invariants
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { AttendanceV2Database } from '../../src/lib/attendanceV2/db.ts';
import { AttendanceV2ClientEngine } from '../../src/lib/attendanceV2/clientEngine.ts';

function makeEngine(db, transport, deviceId = 'dev-p15j-1') {
  return new AttendanceV2ClientEngine(
    {
      device_id: deviceId,
      device_platform: 'Web-Test',
      client_app_version: '6.0.0',
      client_release_id: 60,
      client_commit_hash: 'pass15jp1',
      protocol_version: 2,
    },
    db,
    transport
  );
}

function makeLease(personnelId, deviceId, projectIds = ['proj-1']) {
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
    scopes: projectIds.map((pid) => ({ project_id: pid, geofence_version_id: `geo-${pid}` })),
  };
}

async function queueOfflineShift(engine, personnelId, projectId = 'proj-1') {
  const ci = await engine.clockIn({
    personnel_id: personnelId,
    project_id: projectId,
    work_type: 'ON_SITE',
    latitude: 20.9854,
    longitude: -89.6152,
    accuracy_meters: 12,
    gps_verified: true,
    geofence_status: 'INSIDE',
    geofence_distance_meters: 10,
    face_verified: true,
    force_offline: true,
  });
  assert.equal(ci.status, 'QUEUED_OFFLINE');

  const co = await engine.clockOut({
    personnel_id: personnelId,
    shift_id: ci.shift_id,
    project_id: projectId,
    work_type: 'ON_SITE',
    latitude: 20.9855,
    longitude: -89.6151,
    accuracy_meters: 14,
    gps_verified: true,
    geofence_status: 'INSIDE',
    geofence_distance_meters: 11,
    face_verified: true,
    force_offline: true,
  });
  assert.equal(co.status, 'QUEUED_OFFLINE');
  return { ci, co };
}

describe('PASS 15J-P1 — V6-PEND-021 & V6-PEND-022 Offline Reliability Regression Matrix', () => {
  it('A. Normal offline replay: CLOCK_IN followed by CLOCK_OUT in strict causal order with ACK', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-a', 'dev-p15j-1'));
    const calls = [];
    const transport = {
      async recordAttendanceEvent(ev) {
        calls.push({ event_id: ev.event_id, shift_id: ev.shift_id, event_type: ev.event_type });
        return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);
    const { ci, co } = await queueOfflineShift(engine, 'p-a');

    const res = await engine.syncOfflineQueue();
    assert.equal(res.processed_count, 2);
    assert.equal(res.acked_count, 2);
    assert.equal(res.failed_count, 0);
    assert.deepEqual(calls.map((c) => c.event_type), ['CLOCK_IN', 'CLOCK_OUT']);
    assert.equal(calls[0].event_id, ci.event_id);
    assert.equal(calls[1].event_id, co.event_id);
    assert.equal(calls[0].shift_id, calls[1].shift_id);

    const events = await db.getQueuedEventsByShift(ci.shift_id);
    assert.deepEqual(events.map((e) => e.sync_status), ['ACKED', 'ACKED']);
    const shift = await db.getActiveShift(ci.shift_id);
    assert.equal(shift?.state, 'RETIRED');
  });

  it('B. Temporary prerequisite failure: CLOCK_OUT waits as DEPENDENCY_WAITING and auto-syncs after CLOCK_IN recovers', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-b', 'dev-p15j-1'));
    let failFirst = true;
    const calls = [];
    const envelopesById = new Map();
    const transport = {
      async recordAttendanceEvent(ev) {
        calls.push({ event_id: ev.event_id, event_type: ev.event_type });
        envelopesById.set(ev.event_id, ev);
        if (failFirst) {
          failFirst = false;
          throw new Error('Failed to fetch');
        }
        return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);
    const { ci, co } = await queueOfflineShift(engine, 'p-b');
    const originalCo = await db.getQueuedEvent(co.event_id);

    // Run 1: CLOCK_IN fails temporarily; CLOCK_OUT must NOT be sent
    const run1 = await engine.syncOfflineQueue();
    assert.equal(run1.acked_count, 0);
    assert.equal(run1.failed_count, 2);
    assert.deepEqual(calls.map((c) => c.event_type), ['CLOCK_IN']);

    const afterRun1 = await db.getQueuedEventsByShift(ci.shift_id);
    assert.equal(afterRun1[0].sync_status, 'RETRYABLE');
    assert.equal(afterRun1[1].sync_status, 'DEPENDENCY_WAITING');

    // Run 2: CLOCK_IN succeeds, CLOCK_OUT automatically becomes eligible and succeeds in same run
    const run2 = await engine.syncOfflineQueue();
    assert.equal(run2.processed_count, 2);
    assert.equal(run2.acked_count, 2);
    assert.equal(run2.failed_count, 0);
    assert.deepEqual(calls.map((c) => c.event_type), ['CLOCK_IN', 'CLOCK_IN', 'CLOCK_OUT']);

    const afterRun2 = await db.getQueuedEventsByShift(ci.shift_id);
    assert.deepEqual(afterRun2.map((e) => e.sync_status), ['ACKED', 'ACKED']);
    assert.equal(afterRun2[0].error_message, undefined);
    assert.equal(afterRun2[1].error_message, undefined);
    // Verify immutable envelope identity preserved
    assert.equal(envelopesById.get(co.event_id).event_id, originalCo.event_id);
    assert.equal(envelopesById.get(co.event_id).shift_id, originalCo.shift_id);
    assert.equal(envelopesById.get(co.event_id).device_event_timestamp, originalCo.device_event_timestamp);
    assert.equal((await db.getActiveShift(ci.shift_id))?.state, 'RETIRED');
  });

  it('C. Malformed or missing acknowledgement: never treated as ACKED, no pending evidence deleted', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-c', 'dev-p15j-1'));
    const malformedResponses = [{}, null, { success: true, status: 'UNKNOWN' }, { success: false, status: '' }];
    let idx = 0;
    const transport = {
      async recordAttendanceEvent() {
        return malformedResponses[idx++ % malformedResponses.length];
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);
    const { ci } = await queueOfflineShift(engine, 'p-c');

    for (let i = 0; i < malformedResponses.length; i++) {
      const res = await engine.syncOfflineQueue();
      assert.equal(res.acked_count, 0);
      const events = await db.getQueuedEventsByShift(ci.shift_id);
      assert.equal(events.length, 2, 'No pending evidence may be deleted');
      assert.equal(events[0].sync_status, 'RETRYABLE');
      assert.equal(events[1].sync_status, 'DEPENDENCY_WAITING');
    }
  });

  it('D. Permanent prerequisite rejection: dependent event preserved as DEPENDENCY_FAILED with zero endless retry loop', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-d', 'dev-p15j-1'));
    let transportCalls = 0;
    const transport = {
      async recordAttendanceEvent() {
        transportCalls++;
        return { success: false, status: 'REJECTED_TERMINATED', error: 'PERSONNEL_INACTIVE' };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);
    const { ci } = await queueOfflineShift(engine, 'p-d');

    const run1 = await engine.syncOfflineQueue();
    assert.equal(run1.acked_count, 0);
    assert.equal(transportCalls, 1, 'Only CLOCK_IN is attempted');
    const afterRun1 = await db.getQueuedEventsByShift(ci.shift_id);
    assert.equal(afterRun1[0].sync_status, 'FAILED_PERMANENT');
    assert.equal(afterRun1[1].sync_status, 'DEPENDENCY_FAILED');

    // Run 2 & Run 3: zero additional transport calls, both records remain preserved for review
    const run2 = await engine.syncOfflineQueue();
    const run3 = await engine.syncOfflineQueue();
    assert.equal(run2.processed_count, 0);
    assert.equal(run3.processed_count, 0);
    assert.equal(transportCalls, 1, 'No endless retry loop');
    const afterRun3 = await db.getQueuedEventsByShift(ci.shift_id);
    assert.equal(afterRun3.length, 2);
    assert.equal(afterRun3[0].sync_status, 'FAILED_PERMANENT');
    assert.equal(afterRun3[1].sync_status, 'DEPENDENCY_FAILED');
  });

  it('E. Concurrent synchronization: overlapping triggers share single-flight run, remain observable, and do not lose newly queued work', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-e', 'dev-p15j-1'));
    let inFlight = 0;
    let maxConcurrent = 0;
    const calls = [];
    const observedStates = [];

    let releaseFirstCall;
    const firstCallEntered = new Promise((resolve) => {
      releaseFirstCall = resolve;
    });
    let allowFirstCallToFinish;
    const firstCallGate = new Promise((resolve) => {
      allowFirstCallToFinish = resolve;
    });

    const transport = {
      async recordAttendanceEvent(ev) {
        inFlight++;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        calls.push({ event_id: ev.event_id, event_type: ev.event_type });
        if (calls.length === 1) {
          releaseFirstCall();
          await firstCallGate;
        } else {
          await new Promise((r) => setTimeout(r, 10));
        }
        inFlight--;
        return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };

    const engine = makeEngine(db, transport);
    const unsub = engine.onSyncStateChange((s) => observedStates.push(s));

    // Queue CLOCK_IN only initially
    const ci = await engine.clockIn({
      personnel_id: 'p-e',
      project_id: 'proj-1',
      work_type: 'ON_SITE',
      latitude: 20.9854,
      longitude: -89.6152,
      accuracy_meters: 10,
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
      force_offline: true,
    });

    // Start automatic sync
    const p1 = engine.syncOfflineQueue();
    await firstCallEntered;
    assert.equal(engine.isSyncing(), true, 'Active sync must be observable');

    // While p1 is in flight, enqueue CLOCK_OUT and trigger simultaneous manual + reconnect syncs
    const co = await engine.clockOut({
      personnel_id: 'p-e',
      shift_id: ci.shift_id,
      project_id: 'proj-1',
      work_type: 'ON_SITE',
      latitude: 20.9854,
      longitude: -89.6152,
      accuracy_meters: 10,
      gps_verified: true,
      geofence_status: 'INSIDE',
      face_verified: true,
      force_offline: true,
    });
    const p2 = engine.syncOfflineQueue();
    const p3 = engine.syncOfflineQueue();

    allowFirstCallToFinish();
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    unsub();

    assert.equal(engine.isSyncing(), false);
    assert.deepEqual(observedStates, [true, false]);
    assert.equal(maxConcurrent, 1, 'Overlapping triggers must never execute concurrently');
    assert.deepEqual(calls.map((c) => c.event_type), ['CLOCK_IN', 'CLOCK_OUT']);
    assert.equal(calls[0].event_id, ci.event_id);
    assert.equal(calls[1].event_id, co.event_id);
    assert.equal(r1.acked_count, 2);
    assert.equal(r2.acked_count, 2);
    assert.equal(r3.acked_count, 2);
  });

  it('F. Synchronization exception: unexpected DB failure releases single-flight lock cleanly so subsequent retry succeeds', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-f', 'dev-p15j-1'));
    const transport = {
      async recordAttendanceEvent(ev) {
        return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);
    await queueOfflineShift(engine, 'p-f');

    // Inject unexpected failure in db.getAllQueuedEvents once
    const origGetAll = db.getAllQueuedEvents.bind(db);
    let failOnce = true;
    db.getAllQueuedEvents = async () => {
      if (failOnce) {
        failOnce = false;
        throw new Error('Simulated IndexedDB transaction abort');
      }
      return origGetAll();
    };

    await assert.rejects(() => engine.syncOfflineQueue(), /Simulated IndexedDB transaction abort/);
    assert.equal(engine.isSyncing(), false, 'Lock/sync state must be released after exception');

    // Subsequent retry succeeds cleanly
    const res = await engine.syncOfflineQueue();
    assert.equal(res.acked_count, 2);
    assert.equal(res.failed_count, 0);
  });

  it('G. Multiple offline shifts: failed prerequisite on Shift 1 does not block unrelated eligible Shift 2', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-g1', 'dev-p15j-1', ['proj-1']));
    await db.saveOfflineLease(makeLease('p-g2', 'dev-p15j-1', ['proj-2']));

    const transport = {
      async recordAttendanceEvent(ev) {
        if (ev.personnel_id === 'p-g1') {
          return { success: false, status: 'REJECTED_OUTSIDE_GEOFENCE', error: 'Outside geofence' };
        }
        return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);
    const s1 = await queueOfflineShift(engine, 'p-g1', 'proj-1');
    const s2 = await queueOfflineShift(engine, 'p-g2', 'proj-2');

    const res = await engine.syncOfflineQueue();
    assert.equal(res.acked_count, 2);
    assert.equal(res.failed_count, 2);

    const shift1Events = await db.getQueuedEventsByShift(s1.ci.shift_id);
    const shift2Events = await db.getQueuedEventsByShift(s2.ci.shift_id);
    assert.deepEqual(shift1Events.map((e) => e.sync_status), ['FAILED_PERMANENT', 'DEPENDENCY_FAILED']);
    assert.deepEqual(shift2Events.map((e) => e.sync_status), ['ACKED', 'ACKED']);
  });

  it('H. Duplicate acknowledgement & idempotent replay: no duplicate attendance records or corrupted queue state', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-h', 'dev-p15j-1'));
    const seen = new Set();
    let appliedCount = 0;
    const transport = {
      async recordAttendanceEvent(ev) {
        if (seen.has(ev.event_id)) {
          return { success: true, status: 'ALREADY_APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
        }
        seen.add(ev.event_id);
        appliedCount++;
        return { success: true, status: 'ALREADY_APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);
    const { ci } = await queueOfflineShift(engine, 'p-h');

    const run1 = await engine.syncOfflineQueue();
    const run2 = await engine.syncOfflineQueue();
    assert.equal(run1.acked_count, 2);
    assert.equal(run2.processed_count, 0);
    assert.equal(appliedCount, 2);
    const events = await db.getQueuedEventsByShift(ci.shift_id);
    assert.deepEqual(events.map((e) => e.sync_status), ['ACKED', 'ACKED']);
  });

  it('I. Existing stranded historical DEPENDENCY_FAILED records: safely recovers eligible entries without clearing queues', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-i1', 'dev-p15j-1'));
    await db.saveOfflineLease(makeLease('p-i2', 'dev-p15j-1'));
    await db.saveOfflineLease(makeLease('p-i3', 'dev-p15j-1'));

    const calls = [];
    const transport = {
      async recordAttendanceEvent(ev) {
        calls.push({ shift_id: ev.shift_id, event_type: ev.event_type });
        return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);

    // Case I-1: Historical R52 stranded state (CLOCK_IN=ACKED, CLOCK_OUT=DEPENDENCY_FAILED)
    const s1 = await queueOfflineShift(engine, 'p-i1');
    const s1Ci = await db.getQueuedEvent(s1.ci.event_id);
    const s1Co = await db.getQueuedEvent(s1.co.event_id);
    await db.saveQueuedEvent({ ...s1Ci, sync_status: 'ACKED', server_receipt_at: new Date().toISOString() });
    await db.saveQueuedEvent({ ...s1Co, sync_status: 'DEPENDENCY_FAILED', error_message: 'Prior event in shift failed to synchronize' });

    // Case I-2: Historical stranded state where CLOCK_IN is still RETRYABLE
    const s2 = await queueOfflineShift(engine, 'p-i2');
    const s2Ci = await db.getQueuedEvent(s2.ci.event_id);
    const s2Co = await db.getQueuedEvent(s2.co.event_id);
    await db.saveQueuedEvent({ ...s2Ci, sync_status: 'RETRYABLE', retry_count: 1 });
    await db.saveQueuedEvent({ ...s2Co, sync_status: 'DEPENDENCY_FAILED', error_message: 'Prior event in shift failed to synchronize' });

    // Case I-3: Genuine permanent prerequisite failure (CLOCK_IN=FAILED_PERMANENT, CLOCK_OUT=DEPENDENCY_FAILED)
    const s3 = await queueOfflineShift(engine, 'p-i3');
    const s3Ci = await db.getQueuedEvent(s3.ci.event_id);
    const s3Co = await db.getQueuedEvent(s3.co.event_id);
    await db.saveQueuedEvent({ ...s3Ci, sync_status: 'FAILED_PERMANENT', error_message: 'PERSONNEL_INACTIVE' });
    await db.saveQueuedEvent({ ...s3Co, sync_status: 'DEPENDENCY_FAILED', error_message: 'Prior event in shift failed to synchronize' });

    const res = await engine.syncOfflineQueue();
    assert.equal(res.acked_count, 3);
    assert.equal(res.failed_count, 0);

    // s1 CLOCK_OUT recovered; s2 CLOCK_IN + CLOCK_OUT recovered; s3 untouched!
    assert.deepEqual((await db.getQueuedEventsByShift(s1.ci.shift_id)).map((e) => e.sync_status), ['ACKED', 'ACKED']);
    assert.deepEqual((await db.getQueuedEventsByShift(s2.ci.shift_id)).map((e) => e.sync_status), ['ACKED', 'ACKED']);
    assert.deepEqual((await db.getQueuedEventsByShift(s3.ci.shift_id)).map((e) => e.sync_status), ['FAILED_PERMANENT', 'DEPENDENCY_FAILED']);
    assert.equal(calls.filter((c) => c.shift_id === s3.ci.shift_id).length, 0);
  });

  it('J. Application reload during synchronization: stale SYNCING recovered with identical identity; fresh SYNCING blocks premature CLOCK_OUT', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-j1', 'dev-p15j-1'));
    await db.saveOfflineLease(makeLease('p-j2', 'dev-p15j-1'));

    const calls = [];
    const transport = {
      async recordAttendanceEvent(ev) {
        calls.push({ event_id: ev.event_id, shift_id: ev.shift_id, event_type: ev.event_type });
        return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);

    // Shift 1: stale SYNCING (5 minutes ago) simulating app crash/reload mid-sync
    const s1 = await queueOfflineShift(engine, 'p-j1');
    const s1Ci = await db.getQueuedEvent(s1.ci.event_id);
    await db.saveQueuedEvent({
      ...s1Ci,
      sync_status: 'SYNCING',
      last_attempted_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });

    // Shift 2: fresh SYNCING (just started) — CLOCK_OUT must NOT be sent ahead of it!
    const s2 = await queueOfflineShift(engine, 'p-j2');
    const s2Ci = await db.getQueuedEvent(s2.ci.event_id);
    await db.saveQueuedEvent({
      ...s2Ci,
      sync_status: 'SYNCING',
      last_attempted_at: new Date().toISOString(),
    });

    const res = await engine.syncOfflineQueue();
    assert.equal(res.acked_count, 2);
    assert.deepEqual(
      calls.map((c) => `${c.event_type}:${c.event_id}`),
      [`CLOCK_IN:${s1.ci.event_id}`, `CLOCK_OUT:${s1.co.event_id}`]
    );

    const s2Events = await db.getQueuedEventsByShift(s2.ci.shift_id);
    assert.equal(s2Events[0].sync_status, 'SYNCING');
    assert.equal(s2Events[1].sync_status, 'DEPENDENCY_WAITING');
  });

  it('L. Connectivity loss during replay: CLOCK_IN succeeds, drop before CLOCK_OUT preserves CLOCK_OUT and resumes on reconnect', async () => {
    const db = new AttendanceV2Database(true);
    await db.saveOfflineLease(makeLease('p-l', 'dev-p15j-1'));
    let dropOnClockOutOnce = true;
    const calls = [];
    const transport = {
      async recordAttendanceEvent(ev) {
        calls.push(ev.event_type);
        if (ev.event_type === 'CLOCK_OUT' && dropOnClockOutOnce) {
          dropOnClockOutOnce = false;
          throw new Error('Failed to fetch: connection lost');
        }
        return { success: true, status: 'APPLIED', event_id: ev.event_id, shift_id: ev.shift_id };
      },
      async syncAttendanceEvents() { return []; },
    };
    const engine = makeEngine(db, transport);
    const { ci } = await queueOfflineShift(engine, 'p-l');

    const run1 = await engine.syncOfflineQueue();
    assert.equal(run1.acked_count, 1);
    assert.equal(run1.failed_count, 1);
    const mid = await db.getQueuedEventsByShift(ci.shift_id);
    assert.deepEqual(mid.map((e) => e.sync_status), ['ACKED', 'RETRYABLE']);

    const run2 = await engine.syncOfflineQueue();
    assert.equal(run2.processed_count, 1);
    assert.equal(run2.acked_count, 1);
    assert.equal(run2.failed_count, 0);
    assert.deepEqual(calls, ['CLOCK_IN', 'CLOCK_OUT', 'CLOCK_OUT']);
    const finalEv = await db.getQueuedEventsByShift(ci.shift_id);
    assert.deepEqual(finalEv.map((e) => e.sync_status), ['ACKED', 'ACKED']);
  });

  it('UI Integration Contract: SyncStatus.tsx observes V2 single-flight sync, counts DEPENDENCY_WAITING, and surfaces intervention states', () => {
    const syncStatusPath = path.resolve(process.cwd(), 'src/components/SyncStatus.tsx');
    const src = fs.readFileSync(syncStatusPath, 'utf8');
    assert.match(src, /onSyncStateChange/, 'SyncStatus must subscribe to engine.onSyncStateChange');
    assert.match(src, /DEPENDENCY_WAITING/, 'SyncStatus must count DEPENDENCY_WAITING in pending queue');
    assert.match(src, /DEPENDENCY_FAILED/, 'SyncStatus must surface DEPENDENCY_FAILED intervention state');
    assert.match(src, /FAILED_PERMANENT/, 'SyncStatus must surface FAILED_PERMANENT intervention state');
    assert.match(src, /v2-intervention-panel/, 'SyncStatus must render management review intervention panel');
  });
});
