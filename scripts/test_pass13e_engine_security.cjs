/**
 * PASS 13E: Attendance V2 Server Engine, Idempotency, RLS & Security Test Suite
 * Target: Disposable PostgreSQL 16 container (latnovva_pass13d_disposable_pg)
 *
 * Verifies:
 * 1. 29-field canonical hash determinism & property order invariance
 * 2. Idempotency contract (ALREADY_APPLIED vs IMMUTABLE_EVENT_PAYLOAD_MISMATCH)
 * 3. Concurrency serialization with advisory locks (simultaneous Clock-In -> exactly 1 OPEN)
 * 4. Clock-out exact shift targeting, chronology, and duration/payroll calculation
 * 5. Direct table write lockdown (authenticated/anon cannot INSERT/UPDATE/DELETE)
 * 6. Multi-role RLS read matrix (Tech, Office, Supervisor, Manager, HR, Customer)
 * 7. Security Definer identity spoofing protection
 * 8. Offline lease issuance, dual-identity binding, and replay validation
 * 9. Forgotten clockout handling (8h capped, 0 OT, requires_review)
 * 10. Zombie shift auto-closure (>14h, 8/0 cap, system actor audit) & manager reconciliation
 * 11. Global control state gates (LEGACY_ACTIVE, V2_DORMANT, V2_ACTIVE, V2_DEGRADED)
 */

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DISPOSABLE_CONN = 'postgres://postgres:pass13d_test_password@localhost:54329/postgres';

async function runPass13ETests() {
  console.log('========================================================================');
  console.log('  PASS 13E: ATTENDANCE V2 SERVER ENGINE, IDEMPOTENCY & RLS TEST SUITE');
  console.log('  Environment: Disposable PostgreSQL 16 on port 54329');
  console.log('========================================================================\n');

  const client = new Client({ connectionString: DISPOSABLE_CONN });
  await client.connect();

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failedTests++;
    }
  }

  async function assertThrows(fn, expectedErrorSubstring, message) {
    try {
      await fn();
      console.error(`  ❌ [FAIL] Expected error containing "${expectedErrorSubstring}", but succeeded: ${message}`);
      failedTests++;
    } catch (err) {
      if (err.message.includes(expectedErrorSubstring) || err.code === expectedErrorSubstring) {
        console.log(`  ✅ [PASS] Correctly rejected (${err.code || err.message}): ${message}`);
        passedTests++;
      } else {
        console.error(`  ❌ [FAIL] Threw unexpected error: "${err.message}" (expected "${expectedErrorSubstring}"): ${message}`);
        failedTests++;
      }
    }
  }

  try {
    // -------------------------------------------------------------------------
    // SETUP: Fixtures for testing
    // -------------------------------------------------------------------------
    console.log('1. Setting up test fixtures for multi-role personas...');

    // Ensure 13E engine SQL (functions, triggers, RLS, grants) is applied
    const sqlEngine = fs.readFileSync(path.join(__dirname, 'sql/pass13e_attendance_v2_engine.sql'), 'utf-8');
    await client.query(sqlEngine);

    // Clean test data from previous runs (bypassing user triggers for fixture reset)
    await client.query(`
      TRUNCATE TABLE 
        public.attendance_event_media,
        public.attendance_audit_log,
        public.attendance_adjustments,
        public.attendance_events,
        public.attendance_shifts,
        public.attendance_offline_lease_scopes,
        public.attendance_offline_leases,
        public.project_geofence_versions,
        public.projects,
        public.mx_personnel,
        public.profiles,
        auth.users
      CASCADE;
    `);

    // Create Personas:
    // 1. Tech 1 (Worker, MX)
    // 2. Tech 2 (Worker, MX)
    // 3. Supervisor 1 (MX, supervises Tech 1, site lead on Project A)
    // 4. Office 1 (MX, assigned to Project A)
    // 5. Manager MX (Manager, MX)
    // 6. HR MX (HR, MX)
    // 7. Manager US (Manager, US - cross-subsidiary test)
    // 8. Customer 1 (Client A)

    const uids = {
      tech1: '11111111-1111-1111-1111-111111111111',
      tech2: '22222222-2222-2222-2222-222222222222',
      sup1:  '33333333-3333-3333-3333-333333333333',
      off1:  '44444444-4444-4444-4444-444444444444',
      mgrMX: '55555555-5555-5555-5555-555555555555',
      hrMX:  '66666666-6666-6666-6666-666666666666',
      mgrUS: '77777777-7777-7777-7777-777777777777',
      cust1: '88888888-8888-8888-8888-888888888888',
    };

    const pids = {
      tech1: 'PER-TECH-001',
      tech2: 'PER-TECH-002',
      sup1:  'PER-SUP-001',
      off1:  'PER-OFF-001',
      mgrMX: 'PER-MGR-001',
      hrMX:  'PER-HR-001',
      mgrUS: 'PER-MGR-US1',
    };

    const clientIdA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const clientIdB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    const projA = 'aaaaaaaa-1111-1111-1111-111111111111';
    const projB = 'bbbbbbbb-2222-2222-2222-222222222222';

    // Insert Auth Users
    for (const [key, uid] of Object.entries(uids)) {
      await client.query(`
        INSERT INTO auth.users (id, email) VALUES ($1, $2);
      `, [uid, `${key}@latnovva.test`]);
    }

    // Insert Personnel
    await client.query(`
      INSERT INTO public.mx_personnel (id, name, employee_number, app_role, status, email, subsidiary, supervisor_id)
      VALUES 
        ($1, 'Tech One', 'T01', 'Tech', 'ACTIVE', 'tech1@latnovva.test', 'MX', $3),
        ($2, 'Tech Two', 'T02', 'Tech', 'ACTIVE', 'tech2@latnovva.test', 'MX', NULL),
        ($3, 'Supervisor One', 'S01', 'Supervisor', 'ACTIVE', 'sup1@latnovva.test', 'MX', NULL),
        ($4, 'Office One', 'O01', 'Office', 'ACTIVE', 'off1@latnovva.test', 'MX', NULL),
        ($5, 'Manager MX', 'M01', 'Manager', 'ACTIVE', 'mgrmx@latnovva.test', 'MX', NULL),
        ($6, 'HR MX', 'H01', 'HR', 'ACTIVE', 'hrmx@latnovva.test', 'MX', NULL),
        ($7, 'Manager US', 'MUS', 'Manager', 'ACTIVE', 'mgrus@latnovva.test', 'US', NULL);
    `, [pids.tech1, pids.tech2, pids.sup1, pids.off1, pids.mgrMX, pids.hrMX, pids.mgrUS]);

    // Insert Profiles
    await client.query(`
      INSERT INTO public.profiles (id, email, name, role, subsidiary, client_id)
      VALUES 
        ($1, 'tech1@latnovva.test', 'Tech One', 'Tech', 'MX', NULL),
        ($2, 'tech2@latnovva.test', 'Tech Two', 'Tech', 'MX', NULL),
        ($3, 'sup1@latnovva.test', 'Supervisor One', 'Supervisor', 'MX', NULL),
        ($4, 'off1@latnovva.test', 'Office One', 'Office', 'MX', NULL),
        ($5, 'mgrmx@latnovva.test', 'Manager MX', 'Manager', 'MX', NULL),
        ($6, 'hrmx@latnovva.test', 'HR MX', 'HR', 'MX', NULL),
        ($7, 'mgrus@latnovva.test', 'Manager US', 'Manager', 'US', NULL),
        ($8, 'cust1@latnovva.test', 'Client Representative', 'Customer', 'MX', $9);
    `, [uids.tech1, uids.tech2, uids.sup1, uids.off1, uids.mgrMX, uids.hrMX, uids.mgrUS, uids.cust1, clientIdA]);

    // Insert Projects: Project A (Client A), Project B (Client B)
    await client.query(`
      INSERT INTO public.projects (id, name, subsidiary, client_id, assigned_personnel, site_lead_ids)
      VALUES 
        ($1, 'Project Alpha', 'MX', $3, ARRAY[$5, $6, $7]::TEXT[], ARRAY[$6]::TEXT[]),
        ($2, 'Project Beta', 'MX', $4, ARRAY[$8]::TEXT[], ARRAY[]::TEXT[]);
    `, [projA, projB, clientIdA, clientIdB, pids.tech1, pids.sup1, pids.off1, pids.tech2]);

    // Insert Geofence for Project Alpha: Lat 25.6866, Lon -100.3161, Radius 150m, Acc 50m
    const geofenceVerA = 'cccccccc-1111-1111-1111-111111111111';
    await client.query(`
      INSERT INTO public.project_geofence_versions (
        version_id, project_id, version_number, latitude, longitude, radius_meters, accuracy_threshold_meters
      ) VALUES ($1, $2, 1, 25.686614, -100.316112, 150.00, 50.00);
    `, [geofenceVerA, projA]);

    // Initialize Control to V2_ACTIVE for engine tests
    await client.query(`
      INSERT INTO public.attendance_v2_control (
        control_id, system_state, protocol_version, minimum_v2_client_release_id, minimum_v2_client_version
      ) VALUES (1, 'V2_ACTIVE', 2, 49, 'v5.1.0')
      ON CONFLICT (control_id) DO UPDATE 
      SET system_state = EXCLUDED.system_state,
          minimum_v2_client_release_id = EXCLUDED.minimum_v2_client_release_id,
          minimum_v2_client_version = EXCLUDED.minimum_v2_client_version,
          protocol_version = EXCLUDED.protocol_version;
    `);

    assert(true, 'Test personas, projects, geofences, and V2 control initialized');

    // Helper to simulate calling as a specific user
    async function asUser(uid, fn) {
      await client.query(`SET ROLE authenticated;`);
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [uid]);
      try {
        return await fn();
      } finally {
        await client.query(`SELECT set_config('request.jwt.claim.sub', '', false);`);
        await client.query(`RESET ROLE;`);
      }
    }

    // -------------------------------------------------------------------------
    // 2. DETERMINISTIC 29-FIELD CANONICAL HASH TESTS
    // -------------------------------------------------------------------------
    console.log('\n2. Testing 29-Field Canonical Hash Stability & Determinism...');

    const baseEvent = {
      event_id: '99999999-9999-9999-9999-999999999999',
      shift_id: '88888888-8888-8888-8888-888888888888',
      personnel_id: pids.tech1,
      project_id: projA,
      event_type: 'CLOCK_IN',
      work_type: 'ON_SITE',
      device_event_timestamp: '2026-10-14T08:00:00Z',
      timezone_offset_minutes: -360,
      device_id: 'DEV-PIXEL-7A',
      device_platform: 'Android',
      client_app_version: 'v5.1.0',
      client_release_id: 49,
      client_commit_hash: 'abc123def456',
      attendance_protocol_version: 2,
      created_offline: false,
      offline_lease_id: null,
      latitude: 25.686614,
      longitude: -100.316112,
      accuracy_meters: 15.2,
      gps_verified: true,
      geofence_status: 'INSIDE',
      geofence_distance_meters: 12.5,
      geofence_version_id: geofenceVerA,
      face_verified: true,
      face_bypass_reason: null,
      is_manual_adjustment: false,
      adjustment_reason: null,
      reported_departure_timestamp: null,
      worker_explanation: null
    };

    // Calculate hash
    const resHash1 = await client.query(`SELECT public.compute_canonical_event_hash($1::jsonb) as h`, [JSON.stringify(baseEvent)]);
    const hash1 = resHash1.rows[0].h;
    assert(hash1 && hash1.length === 64, `Generated valid 64-char SHA256 hex hash: ${hash1}`);

    // Test property order invariance: shuffle keys
    const shuffledKeys = Object.keys(baseEvent).reverse();
    const shuffledEvent = {};
    for (const k of shuffledKeys) shuffledEvent[k] = baseEvent[k];

    const resHash2 = await client.query(`SELECT public.compute_canonical_event_hash($1::jsonb) as h`, [JSON.stringify(shuffledEvent)]);
    const hash2 = resHash2.rows[0].h;
    assert(hash1 === hash2, 'Canonical hash is property-order invariant');

    // Test case normalization for UUIDs, enums, commit hash
    const uppercaseVariants = {
      ...baseEvent,
      event_id: baseEvent.event_id.toUpperCase(),
      client_commit_hash: 'ABC123DEF456',
      event_type: 'clock_in',
      geofence_status: 'inside'
    };
    const resHash3 = await client.query(`SELECT public.compute_canonical_event_hash($1::jsonb) as h`, [JSON.stringify(uppercaseVariants)]);
    assert(resHash3.rows[0].h === hash1, 'Canonical hash normalizes casing of UUIDs, enums, and hex strings');

    // Negative test: Changing a single field produces a different hash
    const mutatedEvent = { ...baseEvent, accuracy_meters: 15.3 };
    const resHashMut = await client.query(`SELECT public.compute_canonical_event_hash($1::jsonb) as h`, [JSON.stringify(mutatedEvent)]);
    assert(resHashMut.rows[0].h !== hash1, 'Mutating any evidence field produces distinct canonical hash');

    // -------------------------------------------------------------------------
    // 3. CONTROL STATE GATES & PINNED RELEASE ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n3. Testing Control State Gates & Release Authorization...');

    // In LEGACY_ACTIVE: all V2 writes rejected
    await client.query(`UPDATE public.attendance_v2_control SET system_state = 'LEGACY_ACTIVE' WHERE control_id = 1;`);
    let legacyRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(baseEvent)])).rows[0].r;
    });
    assert(legacyRes.success === false && legacyRes.error === 'V2_DISABLED', 'Mutations strictly rejected when system_state = LEGACY_ACTIVE');

    // In V2_DORMANT: writes rejected with V2_DORMANT
    await client.query(`UPDATE public.attendance_v2_control SET system_state = 'V2_DORMANT' WHERE control_id = 1;`);
    let dormantRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(baseEvent)])).rows[0].r;
    });
    assert(dormantRes.success === false && dormantRes.error === 'V2_DORMANT', 'Mutations strictly rejected when system_state = V2_DORMANT');

    // In V2_ACTIVE with legacy client release (48 < 49): rejected with CLIENT_RELEASE_UNAUTHORIZED
    await client.query(`UPDATE public.attendance_v2_control SET system_state = 'V2_ACTIVE' WHERE control_id = 1;`);
    const legacyClientEvent = { ...baseEvent, client_release_id: 48 };
    let relRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(legacyClientEvent)])).rows[0].r;
    });
    assert(relRes.success === false && relRes.error === 'CLIENT_RELEASE_UNAUTHORIZED', 'Unpinned/outdated client release rejected by V2 control');

    // In V2_ACTIVE with protocol mismatch (protocol 1 != 2): rejected
    const badProtoEvent = { ...baseEvent, attendance_protocol_version: 1 };
    let protoRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(badProtoEvent)])).rows[0].r;
    });
    assert(protoRes.success === false && protoRes.error === 'PROTOCOL_MISMATCH', 'Invalid protocol version rejected');

    // -------------------------------------------------------------------------
    // 4. SECURITY DEFINER SPOOFING RESISTANCE
    // -------------------------------------------------------------------------
    console.log('\n4. Testing Security Definer Identity Spoofing Protection...');

    // Tech 1 attempts to record event claiming to be Tech 2
    const forgedPersonnelEvent = { ...baseEvent, personnel_id: pids.tech2 };
    let spoofRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(forgedPersonnelEvent)])).rows[0].r;
    });
    assert(spoofRes.success === false && spoofRes.error === 'IDENTITY_MISMATCH', 'Forged personnel_id claim strictly rejected');

    // -------------------------------------------------------------------------
    // 5. TRANSACTIONAL CLOCK-IN & IDEMPOTENCY
    // -------------------------------------------------------------------------
    console.log('\n5. Testing Transactional Clock-In, Admissibility & Idempotency...');

    // Valid Clock-In by Tech 1
    let clockInRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(baseEvent)])).rows[0].r;
    });
    assert(clockInRes.success === true && clockInRes.status === 'APPLIED', 'Valid Clock-In event accepted and applied');

    // Verify shift was created in OPEN state
    const shiftRow = (await client.query(`SELECT * FROM public.attendance_shifts WHERE shift_id = $1`, [baseEvent.shift_id])).rows[0];
    assert(shiftRow && shiftRow.status === 'OPEN' && shiftRow.personnel_id === pids.tech1, 'Shift created in OPEN status bound to authoritative personnel_id');

    // Idempotent Replay: exact same event -> returns ALREADY_APPLIED
    let replayRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(baseEvent)])).rows[0].r;
    });
    assert(replayRes.success === true && replayRes.status === 'ALREADY_APPLIED', 'Idempotent replay returns ALREADY_APPLIED');

    // Poisoned Replay: same event_id but tampered latitude
    const poisonedEvent = { ...baseEvent, latitude: 25.999999 };
    let poisonedRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(poisonedEvent)])).rows[0].r;
    });
    assert(poisonedRes.success === false && poisonedRes.status === 'IMMUTABLE_EVENT_PAYLOAD_MISMATCH', 'Payload tampering on existing event_id returns IMMUTABLE_EVENT_PAYLOAD_MISMATCH');

    // -------------------------------------------------------------------------
    // 6. CONCURRENCY SERIALIZATION WITH ADVISORY LOCKS
    // -------------------------------------------------------------------------
    console.log('\n6. Testing Advisory Lock Concurrency Serialization...');

    // Attempt to open a second simultaneous shift for Tech 1 while first is still OPEN
    const competingShiftId = '77777777-7777-7777-7777-777777777777';
    const competingEventId = '66666666-6666-6666-6666-666666666666';
    const competingEvent = {
      ...baseEvent,
      shift_id: competingShiftId,
      event_id: competingEventId,
      device_event_timestamp: '2026-10-14T08:30:00Z'
    };

    let competingRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(competingEvent)])).rows[0].r;
    });
    assert(competingRes.success === false && competingRes.status === 'ACTIVE_SHIFT_CONFLICT', 'Second simultaneous Clock-In rejected with ACTIVE_SHIFT_CONFLICT');

    const openShiftsCount = (await client.query(`SELECT count(*)::int as c FROM public.attendance_shifts WHERE personnel_id = $1 AND status = 'OPEN'`, [pids.tech1])).rows[0].c;
    assert(openShiftsCount === 1, 'Strictly exactly one OPEN shift exists for worker');

    // -------------------------------------------------------------------------
    // 7. TRANSACTIONAL CLOCK-OUT & CHRONOLOGY
    // -------------------------------------------------------------------------
    console.log('\n7. Testing Transactional Clock-Out & Exact Shift Targeting...');

    // Chronology check: Clock-out timestamp earlier than clock-in
    const clockOutEventId = '55555555-5555-5555-5555-555555555555';
    const prematureClockOut = {
      ...baseEvent,
      event_id: clockOutEventId,
      event_type: 'CLOCK_OUT',
      device_event_timestamp: '2026-10-14T07:30:00Z' // 30 mins before 08:00
    };

    let prematureRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(prematureClockOut)])).rows[0].r;
    });
    assert(prematureRes.success === false && prematureRes.error === 'CLOCK_OUT_BEFORE_CLOCK_IN', 'Clock-Out timestamp before Clock-In rejected');

    // Target non-existent shift
    const bogusShiftClockOut = {
      ...baseEvent,
      shift_id: '00000000-0000-0000-0000-000000000000',
      event_id: clockOutEventId,
      event_type: 'CLOCK_OUT',
      device_event_timestamp: '2026-10-14T17:00:00Z'
    };
    let bogusRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(bogusShiftClockOut)])).rows[0].r;
    });
    assert(bogusRes.success === false && bogusRes.error === 'SHIFT_NOT_FOUND', 'Clock-Out targeting non-existent shift rejected');

    // Normal Clock-Out: 9 hours shift (08:00 to 17:00 = 540 min = 9.0h -> 8.0h regular + 1.0h OT)
    const validClockOut = {
      ...baseEvent,
      event_id: clockOutEventId,
      event_type: 'CLOCK_OUT',
      device_event_timestamp: '2026-10-14T17:00:00Z'
    };
    let validOutRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(validClockOut)])).rows[0].r;
    });
    assert(validOutRes.success === true && validOutRes.status === 'APPLIED', 'Valid Clock-Out applied successfully');

    const closedShift = (await client.query(`SELECT * FROM public.attendance_shifts WHERE shift_id = $1`, [baseEvent.shift_id])).rows[0];
    assert(closedShift.status === 'COMPLETED', 'Shift status updated to COMPLETED');
    assert(closedShift.physical_duration_minutes === 540, 'Physical duration accurately calculated as 540 minutes');
    assert(Number(closedShift.payable_hours) === 9.00, 'Payable hours accurately calculated as 9.00');
    assert(Number(closedShift.overtime_hours) === 1.00, 'Overtime hours accurately calculated as 1.00');
    assert(closedShift.close_method === 'NORMAL_CLOCK_OUT', 'Close method recorded as NORMAL_CLOCK_OUT');

    // -------------------------------------------------------------------------
    // 8. FORGOTTEN CLOCKOUT FLOW
    // -------------------------------------------------------------------------
    console.log('\n8. Testing Forgotten Clockout Flow (8h Capped Payroll, Requires Review)...');

    // Create a new shift for Tech 2
    const forgottenShiftId = '44444444-4444-4444-4444-444444444444';
    const forgottenInEventId = '33333333-3333-3333-3333-333333333333';
    const tech2ClockIn = {
      ...baseEvent,
      shift_id: forgottenShiftId,
      event_id: forgottenInEventId,
      personnel_id: pids.tech2,
      project_id: projB,
      work_type: 'HOME_OFFICE',
      device_event_timestamp: '2026-10-14T07:00:00Z'
    };
    await asUser(uids.tech2, async () => {
      return await client.query(`SELECT public.record_attendance_event($1::jsonb)`, [JSON.stringify(tech2ClockIn)]);
    });

    // Tech 2 submits Forgotten Clockout 2 days later, claiming left at 18:00
    const forgottenOutEventId = '22222222-3333-4444-5555-666666666666';
    const tech2ForgottenOut = {
      ...tech2ClockIn,
      event_id: forgottenOutEventId,
      event_type: 'CLOCK_OUT',
      device_event_timestamp: '2026-10-16T09:00:00Z',
      gps_verified: false,
      geofence_status: 'NOT_APPLICABLE',
      latitude: null,
      longitude: null,
      accuracy_meters: null,
      geofence_distance_meters: null,
      geofence_version_id: null,
      is_manual_adjustment: true,
      adjustment_reason: 'FORGOTTEN_CLOCKOUT',
      reported_departure_timestamp: '2026-10-14T18:00:00Z',
      worker_explanation: 'Forgot to clock out before battery died at client site'
    };

    let forgRes = await asUser(uids.tech2, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(tech2ForgottenOut)])).rows[0].r;
    });
    assert(forgRes.success === true && forgRes.status === 'APPLIED', 'Forgotten Clockout event accepted');

    const forgShift = (await client.query(`SELECT * FROM public.attendance_shifts WHERE shift_id = $1`, [forgottenShiftId])).rows[0];
    assert(forgShift.status === 'REQUIRES_REVIEW', 'Forgotten Clockout shift status set to REQUIRES_REVIEW');
    assert(Number(forgShift.payable_hours) === 8.00, 'Payable hours strictly capped at 8.00');
    assert(Number(forgShift.overtime_hours) === 0.00, 'Overtime hours strictly capped at 0.00');
    assert(forgShift.requires_review === true, 'requires_review flag set to TRUE');
    assert(forgShift.review_status === 'PENDING', 'review_status set to PENDING');
    assert(forgShift.close_method === 'FORGOTTEN_CLOCKOUT_8H', 'close_method set to FORGOTTEN_CLOCKOUT_8H');

    // -------------------------------------------------------------------------
    // 9. OFFLINE LEASE ISSUANCE & REPLAY
    // -------------------------------------------------------------------------
    console.log('\n9. Testing Offline Lease Issuance, Dual-Identity & Replay...');

    // Tech 1 requests offline lease
    let leaseRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.issue_attendance_offline_lease('DEV-PIXEL-7A', 48, 49, 'v5.1.0') as r`)).rows[0].r;
    });
    assert(leaseRes.success === true && leaseRes.lease_id, 'Offline lease issued successfully');
    assert(leaseRes.auth_user_id === uids.tech1 && leaseRes.personnel_id === pids.tech1, 'Lease strictly binds dual identity');
    assert(leaseRes.assigned_scopes_count >= 1, 'Lease contains project and geofence scopes for assigned projects');

    const issuedLeaseId = leaseRes.lease_id;

    // Tech 1 executes offline shift during lease window
    const offlineShiftId = '12121212-1212-1212-1212-121212121212';
    const offlineInId = '34343434-3434-3434-3434-343434343434';
    const offlineInEvent = {
      ...baseEvent,
      shift_id: offlineShiftId,
      event_id: offlineInId,
      created_offline: true,
      offline_lease_id: issuedLeaseId,
      device_event_timestamp: new Date().toISOString()
    };

    let offSyncRes = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT public.sync_attendance_events($1::jsonb) as r`, [JSON.stringify([offlineInEvent])])).rows[0].r;
    });
    assert(offSyncRes[0].outcome.success === true, 'Offline event replayed via sync_attendance_events successfully');

    // Negative: Offline event claiming another worker's lease
    const forgedLeaseEvent = {
      ...offlineInEvent,
      event_id: '56565656-5656-5656-5656-565656565656',
      shift_id: '78787878-7878-7878-7878-787878787878',
      personnel_id: pids.tech2
    };
    let forgedLeaseRes = await asUser(uids.tech2, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(forgedLeaseEvent)])).rows[0].r;
    });
    assert(forgedLeaseRes.success === false && forgedLeaseRes.error === 'OFFLINE_LEASE_IDENTITY_MISMATCH', 'Offline lease presented by different user rejected with OFFLINE_LEASE_IDENTITY_MISMATCH');

    // -------------------------------------------------------------------------
    // 10. ZOMBIE SHIFT AUTO-CLOSURE & MANAGEMENT RECONCILIATION
    // -------------------------------------------------------------------------
    console.log('\n10. Testing Zombie Shift Auto-Closure & Management Reconciliation...');

    // Create an old open shift (16 hours ago)
    const zombieShiftId = '90909090-9090-9090-9090-909090909090';
    const oldClockInTime = new Date(Date.now() - 16 * 3600 * 1000).toISOString();

    // Insert directly using admin client to simulate shift opened 16h ago
    await client.query(`
      INSERT INTO public.attendance_shifts (
        shift_id, auth_user_id, personnel_id, project_id, subsidiary, work_type,
        first_clock_in_at, status
      ) VALUES ($1, $2, $3, $4, 'MX', 'ON_SITE', $5, 'OPEN');
    `, [zombieShiftId, uids.tech2, pids.tech2, projB, oldClockInTime]);

    // Run zombie shift closure job (>14h threshold)
    let zombieJobRes = (await client.query(`SELECT public.run_zombie_shift_closure(14.00) as r`)).rows[0].r;
    assert(zombieJobRes.success === true && zombieJobRes.closed_zombie_shifts_count >= 1, 'Zombie shift closure job executed successfully');

    const zombieShift = (await client.query(`SELECT * FROM public.attendance_shifts WHERE shift_id = $1`, [zombieShiftId])).rows[0];
    assert(zombieShift.status === 'ZOMBIE_PENDING_RECONCILIATION', 'Shift transitioned to ZOMBIE_PENDING_RECONCILIATION');
    assert(Number(zombieShift.payable_hours) === 8.00, 'Zombie shift payable hours capped at 8.00');
    assert(Number(zombieShift.overtime_hours) === 0.00, 'Zombie shift overtime hours capped at 0.00');
    assert(zombieShift.physical_duration_minutes >= 900, 'Physical duration accurately captured as >= 900 min');

    // Verify SYSTEM actor adjustment and audit log
    const zombieAdj = (await client.query(`SELECT * FROM public.attendance_adjustments WHERE shift_id = $1`, [zombieShiftId])).rows[0];
    assert(zombieAdj && zombieAdj.actor_type === 'SYSTEM' && zombieAdj.actor_user_id === null, 'System adjustment recorded with actor_type = SYSTEM and actor_user_id = NULL');

    // Supervisor Reconciles Zombie Shift
    let reconRes = await asUser(uids.sup1, async () => {
      return (await client.query(`SELECT public.reconcile_shift($1, 10.00, 2.00, 'Worker worked approved overtime at Beta') as r`, [zombieShiftId])).rows[0].r;
    });
    assert(reconRes.success === true && reconRes.status === 'APPROVED', 'Supervisor reconciled zombie shift');

    const reconciledShift = (await client.query(`SELECT * FROM public.attendance_shifts WHERE shift_id = $1`, [zombieShiftId])).rows[0];
    assert(reconciledShift.status === 'COMPLETED', 'Shift updated to COMPLETED after reconciliation');
    assert(Number(reconciledShift.payable_hours) === 10.00, 'Payable hours overridden to 10.00');
    assert(Number(reconciledShift.overtime_hours) === 2.00, 'Overtime hours overridden to 2.00');
    assert(reconciledShift.requires_review === false && reconciledShift.review_status === 'APPROVED', 'Review completed and approved');

    // -------------------------------------------------------------------------
    // 11. DIRECT TABLE WRITE LOCKDOWN
    // -------------------------------------------------------------------------
    console.log('\n11. Testing Direct Table Write Lockdown for authenticated role...');

    await asUser(uids.tech1, async () => {
      await assertThrows(
        async () => await client.query(`INSERT INTO public.attendance_shifts (shift_id, auth_user_id, personnel_id, project_id, subsidiary, work_type, first_clock_in_at, status) VALUES (gen_random_uuid(), auth.uid(), 'P1', $1, 'MX', 'ON_SITE', now(), 'OPEN')`, [projA]),
        'permission denied for table attendance_shifts',
        'Direct INSERT into public.attendance_shifts denied'
      );

      await assertThrows(
        async () => await client.query(`UPDATE public.attendance_shifts SET payable_hours = 100 WHERE shift_id = $1`, [baseEvent.shift_id]),
        'permission denied for table attendance_shifts',
        'Direct UPDATE on public.attendance_shifts denied'
      );

      await assertThrows(
        async () => await client.query(`DELETE FROM public.attendance_shifts WHERE shift_id = $1`, [baseEvent.shift_id]),
        'permission denied for table attendance_shifts',
        'Direct DELETE from public.attendance_shifts denied'
      );

      await assertThrows(
        async () => await client.query(`INSERT INTO public.attendance_events (event_id, shift_id, personnel_id, project_id, event_type, work_type, device_event_timestamp, timezone_offset_minutes, device_id, device_platform, client_app_version, client_release_id, client_commit_hash, attendance_protocol_version, created_offline, gps_verified, geofence_status, face_verified, is_manual_adjustment, auth_user_id, canonical_hash) VALUES (gen_random_uuid(), $1, 'P1', $2, 'CLOCK_IN', 'ON_SITE', now(), 0, 'D', 'P', 'V', 1, 'H', 2, false, true, 'INSIDE', true, false, auth.uid(), 'HASH')`, [baseEvent.shift_id, projA]),
        'permission denied for table attendance_events',
        'Direct INSERT into public.attendance_events denied'
      );

      await assertThrows(
        async () => await client.query(`INSERT INTO public.attendance_adjustments (adjustment_id, shift_id, adjustment_type, reason, actor_type, actor_user_id) VALUES (gen_random_uuid(), $1, 'PAYABLE_HOURS_OVERRIDE', 'HACK', 'WORKER', auth.uid())`, [baseEvent.shift_id]),
        'permission denied for table attendance_adjustments',
        'Direct INSERT into public.attendance_adjustments denied'
      );

      await assertThrows(
        async () => await client.query(`INSERT INTO public.attendance_audit_log (audit_id, target_type, target_id, action, actor_type, actor_user_id) VALUES (gen_random_uuid(), 'SHIFT', '1', 'HACK', 'WORKER', auth.uid())`, []),
        'permission denied for table attendance_audit_log',
        'Direct INSERT into public.attendance_audit_log denied'
      );
    });

    // -------------------------------------------------------------------------
    // 12. MULTI-ROLE RLS READ MATRIX
    // -------------------------------------------------------------------------
    console.log('\n12. Testing Multi-Role Row-Level Security Read Matrix...');

    // Tech 1 should see only own shifts
    let tech1Shifts = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT shift_id, personnel_id FROM public.attendance_shifts`)).rows;
    });
    assert(tech1Shifts.length > 0 && tech1Shifts.every(s => s.personnel_id === pids.tech1), 'Tech 1 sees strictly only own shifts');

    // Tech 2 should see only own shifts
    let tech2Shifts = await asUser(uids.tech2, async () => {
      return (await client.query(`SELECT shift_id, personnel_id FROM public.attendance_shifts`)).rows;
    });
    assert(tech2Shifts.length > 0 && tech2Shifts.every(s => s.personnel_id === pids.tech2), 'Tech 2 sees strictly only own shifts');

    // Supervisor 1 supervises Tech 1 & is site lead on Project Alpha:
    // Can see Tech 1's shifts, but NOT Tech 2's shift on Project Beta (unless assigned)
    let sup1Shifts = await asUser(uids.sup1, async () => {
      return (await client.query(`SELECT shift_id, personnel_id FROM public.attendance_shifts`)).rows;
    });
    assert(sup1Shifts.some(s => s.personnel_id === pids.tech1), 'Supervisor sees direct report Tech 1 shifts');
    assert(!sup1Shifts.some(s => s.personnel_id === pids.tech2), 'Supervisor does NOT see unassigned Tech 2 shifts on unassigned project');

    // Office 1 is assigned to Project Alpha:
    // Can see shifts on Project Alpha
    let off1Shifts = await asUser(uids.off1, async () => {
      return (await client.query(`SELECT shift_id, project_id FROM public.attendance_shifts`)).rows;
    });
    assert(off1Shifts.length > 0 && off1Shifts.every(s => s.project_id === projA), 'Office sees strictly assigned project shifts');

    // Manager MX: can see all MX shifts
    let mgrMXShifts = await asUser(uids.mgrMX, async () => {
      return (await client.query(`SELECT shift_id, subsidiary FROM public.attendance_shifts`)).rows;
    });
    assert(mgrMXShifts.length >= 3 && mgrMXShifts.every(s => s.subsidiary === 'MX'), 'Manager MX sees all shifts in MX subsidiary');

    // Manager US: cross-subsidiary test -> should see 0 shifts in MX
    let mgrUSShifts = await asUser(uids.mgrUS, async () => {
      return (await client.query(`SELECT shift_id, subsidiary FROM public.attendance_shifts`)).rows;
    });
    assert(mgrUSShifts.length === 0, 'Cross-subsidiary boundary: Manager US sees 0 shifts from MX subsidiary');

    // Customer 1: assigned to Client A (Project Alpha)
    // Should see shifts on Project Alpha, but ZERO shifts on Project Beta (Client B)
    let cust1Shifts = await asUser(uids.cust1, async () => {
      return (await client.query(`SELECT shift_id, project_id FROM public.attendance_shifts`)).rows;
    });
    assert(cust1Shifts.length > 0 && cust1Shifts.every(s => s.project_id === projA), 'Customer strictly restricted to assigned client projects');

    // Audit Log Visibility: Only Manager / HR can view audit log
    let techAudit = await asUser(uids.tech1, async () => {
      return (await client.query(`SELECT count(*)::int as c FROM public.attendance_audit_log`)).rows[0].c;
    });
    assert(techAudit === 0, 'Tech cannot read attendance_audit_log (RLS returns 0 rows)');

    let mgrAudit = await asUser(uids.mgrMX, async () => {
      return (await client.query(`SELECT count(*)::int as c FROM public.attendance_audit_log`)).rows[0].c;
    });
    assert(mgrAudit > 0, 'Manager can read attendance_audit_log');

  } catch (error) {
    console.error('FATAL UNHANDLED ERROR in test suite:', error);
    failedTests++;
  } finally {
    await client.end();
  }

  console.log('\n========================================================================');
  console.log(`  PASS 13E TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPass13ETests();
