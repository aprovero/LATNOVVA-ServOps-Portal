/**
 * PASS 13I-W-R2: Comprehensive Disposable Integration Test Suite
 * Target: latnovva_pass13d_disposable_pg (localhost:54329)
 */
const { Client } = require('pg');
const fs = require('fs');
const crypto = require('crypto');

async function runTests() {
  console.log('========================================================================');
  console.log('  PASS 13I-W-R2: COMPREHENSIVE DISPOSABLE INTEGRATION TEST SUITE');
  console.log('========================================================================\n');

  const client = new Client({ connectionString: 'postgres://postgres:pass13d_test_password@localhost:54329/postgres' });
  await client.connect();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 0. Clean test environment
    await client.query(`
      TRUNCATE public.attendance_events, public.attendance_shifts, public.attendance_offline_leases CASCADE;
      DROP TABLE IF EXISTS public.attendance_geofence_exceptions CASCADE;
    `);

    // 1. Seed base users and profiles for matrix testing
    const CAESAR_ID = 'dd408924-77f9-4059-af8d-ed50773ac592';
    const LUIS_ID = 'bdc422cb-4261-431c-a6f4-9ec32a7f2548';
    const OTHER_WORKER_ID = '11111111-1111-1111-1111-111111111111';
    const MERIDA_PROJ = 'c95e8081-3323-4c55-87f5-259207865768';
    const OTHER_PROJ = '33333333-3333-3333-3333-333333333333';

    const SUPER_MERIDA_UID = 'a0000000-0000-0000-0000-000000000001';
    const SUPER_OTHER_UID = 'a0000000-0000-0000-0000-000000000002';
    const MGR_MX_UID = 'a0000000-0000-0000-0000-000000000003';
    const HR_MX_UID = 'a0000000-0000-0000-0000-000000000004';
    const OFFICE_UID = 'a0000000-0000-0000-0000-000000000005';
    const CUSTOMER_UID = 'a0000000-0000-0000-0000-000000000006';

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);

      INSERT INTO auth.users (id, email) VALUES
        ('${CAESAR_ID}', 'caesar@latnovva.com'),
        ('${LUIS_ID}', 'luis@latnovva.com'),
        ('${OTHER_WORKER_ID}', 'other@latnovva.com'),
        ('${SUPER_MERIDA_UID}', 'super_merida@latnovva.com'),
        ('${SUPER_OTHER_UID}', 'super_other@latnovva.com'),
        ('${MGR_MX_UID}', 'mgr_mx@latnovva.com'),
        ('${HR_MX_UID}', 'hr_mx@latnovva.com'),
        ('${OFFICE_UID}', 'office@latnovva.com'),
        ('${CUSTOMER_UID}', 'customer@latnovva.com')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.mx_personnel (id, name, subsidiary, status, supervisor_id) VALUES
        ('${CAESAR_ID}', 'Caesar Flores Peregrino', 'MX', 'Active', 'super-merida-pers-id'),
        ('${LUIS_ID}', 'Luis Alberto Caamal Hernandez', 'MX', 'Active', 'super-merida-pers-id'),
        ('${OTHER_WORKER_ID}', 'Other Worker', 'MX', 'Active', 'super-other-pers-id')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.profiles (id, email, role, subsidiary) VALUES
        ('${CAESAR_ID}', 'caesar@latnovva.com', 'Tech', 'MX'),
        ('${LUIS_ID}', 'luis@latnovva.com', 'Tech', 'MX'),
        ('${OTHER_WORKER_ID}', 'other@latnovva.com', 'Tech', 'MX'),
        ('${SUPER_MERIDA_UID}', 'super_merida@latnovva.com', 'Supervisor', 'MX'),
        ('${SUPER_OTHER_UID}', 'super_other@latnovva.com', 'Supervisor', 'MX'),
        ('${MGR_MX_UID}', 'mgr_mx@latnovva.com', 'Manager', 'MX'),
        ('${HR_MX_UID}', 'hr_mx@latnovva.com', 'HR', 'MX'),
        ('${OFFICE_UID}', 'office@latnovva.com', 'Office', 'MX'),
        ('${CUSTOMER_UID}', 'customer@latnovva.com', 'Customer', 'MX')
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, subsidiary = EXCLUDED.subsidiary;

      -- Assign Caesar and Luis and Supervisor Merida to Mérida project
      UPDATE public.projects 
      SET assigned_personnel = '["${CAESAR_ID}", "${LUIS_ID}", "${SUPER_MERIDA_UID}"]'::jsonb
      WHERE id = '${MERIDA_PROJ}';
    `);

    // 2. Apply pass13i_w_r2_multi_location.sql migration
    console.log('--- 1. Applying Migration Bundle (pass13i_w_r2_multi_location.sql) ---');
    const sql = fs.readFileSync('scripts/sql/pass13i_w_r2_multi_location.sql', 'utf8');
    await client.query(sql);
    assert(true, 'pass13i_w_r2_multi_location.sql executed cleanly');

    // 3. Schema & Seed Verification
    console.log('\n--- 2. Verifying Normalized Tables & Seed Record ---');
    const locRes = await client.query("SELECT * FROM public.attendance_locations WHERE location_name = 'Mérida Warehouse';");
    assert(locRes.rows.length === 1, 'Mérida Warehouse location exists in attendance_locations');
    const warehouse = locRes.rows[0];
    assert(warehouse.latitude === 20.93019 && warehouse.longitude === -89.67442, 'Warehouse coordinates: 20.93019, -89.67442');
    assert(parseFloat(warehouse.radius_meters) === 250, 'Warehouse radius: 250m');
    assert(warehouse.is_active === true, 'Warehouse location is_active = true');

    const projLocRes = await client.query(`
      SELECT * FROM public.attendance_project_locations 
      WHERE project_id = '${MERIDA_PROJ}' AND location_id = '${warehouse.location_id}';
    `);
    assert(projLocRes.rows.length === 1, 'Mérida project mapped to Mérida Warehouse');
    assert(projLocRes.rows[0].is_active === true, 'Project-location mapping is_active = true');

    // Verify 0 warehouse bypasses
    const bypassRes = await client.query('SELECT count(*) FROM public.project_geofence_versions WHERE warehouse_bypass_allowed = TRUE;');
    assert(parseInt(bypassRes.rows[0].count, 10) === 0, 'project_geofence_versions.warehouse_bypass_allowed remains 0 across all projects');

    // 4. Immutability Tests
    console.log('\n--- 3. Testing Immutability & Audit Triggers ---');
    try {
      await client.query(`UPDATE public.attendance_locations SET radius_meters = 500 WHERE location_id = '${warehouse.location_id}';`);
      assert(false, 'Location coordinate update must be rejected');
    } catch (e) {
      assert(e.message.includes('parameters are immutable'), `Location coordinate update rejected: ${e.message}`);
    }

    try {
      await client.query(`DELETE FROM public.attendance_locations WHERE location_id = '${warehouse.location_id}';`);
      assert(false, 'Location delete must be rejected');
    } catch (e) {
      assert(e.message.includes('audit-immutable'), `Location delete rejected: ${e.message}`);
    }

    try {
      await client.query(`UPDATE public.attendance_project_locations SET project_id = gen_random_uuid() WHERE project_location_id = '${projLocRes.rows[0].project_location_id}';`);
      assert(false, 'Project location mapping update must be rejected');
    } catch (e) {
      assert(e.message.includes('mapping relationship is immutable'), `Mapping update rejected: ${e.message}`);
    }

    try {
      await client.query(`DELETE FROM public.attendance_project_locations WHERE project_location_id = '${projLocRes.rows[0].project_location_id}';`);
      assert(false, 'Project location mapping delete must be rejected');
    } catch (e) {
      assert(e.message.includes('deletion is prohibited'), `Mapping delete rejected: ${e.message}`);
    }

    // 5. Media Authorization Tests (Section 23)
    console.log('\n--- 4. Testing Media Authorization Hardening (Section 23) ---');
    await client.query('BEGIN;');
    await client.query('SAVEPOINT sp_media;');

    // Set up a mock shift and event with confirmed media for Caesar
    const testShiftId = crypto.randomUUID();
    const testEventId = crypto.randomUUID();
    const testMediaId = crypto.randomUUID();
    const testStoragePath = `selfies/MX/${CAESAR_ID}/${testShiftId}/${testEventId}.jpg`;

    await client.query(`
      INSERT INTO public.attendance_shifts (
        shift_id, auth_user_id, personnel_id, project_id, subsidiary, work_type,
        first_clock_in_at, status, requires_review, review_status
      ) VALUES (
        '${testShiftId}', '${CAESAR_ID}', '${CAESAR_ID}', '${MERIDA_PROJ}', 'MX', 'ON_SITE',
        now(), 'OPEN', FALSE, 'NONE'
      );

      INSERT INTO public.attendance_events (
        event_id, shift_id, personnel_id, project_id, event_type, work_type,
        device_event_timestamp, timezone_offset_minutes, device_id, device_platform,
        client_app_version, client_release_id, client_commit_hash, attendance_protocol_version,
        created_offline, gps_verified, geofence_status, face_verified, auth_user_id,
        server_received_at, canonical_hash, server_authorization_outcome
      ) VALUES (
        '${testEventId}', '${testShiftId}', '${CAESAR_ID}', '${MERIDA_PROJ}', 'CLOCK_IN', 'ON_SITE',
        now(), -360, 'test-dev', 'WEB', '5.1.0', 49, '6fa9421f', 2,
        false, true, 'INSIDE', true, '${CAESAR_ID}',
        now(), 'hash1', 'AUTHORIZED'
      );

      INSERT INTO public.attendance_event_media (
        media_id, event_id, media_type, storage_bucket, storage_path,
        mime_type, file_size_bytes, sha256_hash, captured_at, uploaded_at
      ) VALUES (
        '${testMediaId}', '${testEventId}', 'SELFIE', 'attendance-v2-media-private', '${testStoragePath}',
        'image/jpeg', 1024, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', now(), now()
      );
    `);

    // Helper to test can_read_attendance_media as user
    async function checkMediaAccess(uid) {
      const q = await client.query(`
        SELECT (
          SELECT public.can_read_attendance_media('${testStoragePath}')
        ) AS allowed
        FROM (SELECT set_config('request.jwt.claim.sub', '${uid}', true)) s;
      `);
      return q.rows[0].allowed;
    }

    // A. Worker A (Caesar) reads own confirmed selfie -> ALLOW
    assert(await checkMediaAccess(CAESAR_ID) === true, 'Worker A reads own selfie: ALLOWED');

    // B. Worker B (Luis) reads Worker A selfie -> DENY
    assert(await checkMediaAccess(LUIS_ID) === false, 'Worker B reads Worker A selfie: DENIED');

    // C. Supervisor with scope over Mérida (Supervisor Merida) reads Caesar -> ALLOW
    assert(await checkMediaAccess(SUPER_MERIDA_UID) === true, 'Scoped Supervisor reads Worker A selfie: ALLOWED');

    // D. Unrelated Supervisor (Supervisor Other) reads Caesar -> DENY
    assert(await checkMediaAccess(SUPER_OTHER_UID) === false, 'Unrelated Supervisor reads Worker A selfie: DENIED');

    // E. Manager MX reads authorized MX record -> ALLOW
    assert(await checkMediaAccess(MGR_MX_UID) === true, 'Manager MX reads authorized MX selfie: ALLOWED');

    // F. HR MX reads authorized MX record -> ALLOW
    assert(await checkMediaAccess(HR_MX_UID) === true, 'HR MX reads authorized MX selfie: ALLOWED');

    // G. Office -> DENY
    assert(await checkMediaAccess(OFFICE_UID) === false, 'Office role reads selfie: DENIED');

    // H. Customer -> DENY
    assert(await checkMediaAccess(CUSTOMER_UID) === false, 'Customer role reads selfie: DENIED');

    // I. Anonymous (null uid) -> DENY
    const anonRes = await client.query(`
      SELECT public.can_read_attendance_media('${testStoragePath}') AS allowed
      FROM (SELECT set_config('request.jwt.claim.sub', '', true)) s;
    `);
    assert(anonRes.rows[0].allowed === false, 'Anonymous reads selfie: DENIED');

    // J. Unconfirmed / non-existent media path -> DENY
    const unconfRes = await client.query(`
      SELECT (
        SELECT public.can_read_attendance_media('selfies/MX/fake/path.jpg')
      ) AS allowed
      FROM (SELECT set_config('request.jwt.claim.sub', '${MGR_MX_UID}', true)) s;
    `);
    assert(unconfRes.rows[0].allowed === false, 'Unconfirmed storage path: DENIED');

    await client.query('ROLLBACK TO SAVEPOINT sp_media;');
    await client.query('ROLLBACK;');

    // 6. Offline Lease Generation Tests (Section 12 & 14)
    console.log('\n--- 5. Testing Offline Lease Generation ---');
    await client.query("UPDATE public.attendance_v2_control SET system_state = 'V2_ACTIVE' WHERE control_id = 1;");

    // A. Caesar lease contains primary + secondary warehouse
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const cLeaseRes = await client.query(`SELECT public.issue_attendance_offline_lease('device-c', 24) AS res;`);
    const cLease = cLeaseRes.rows[0].res;
    assert(cLease.success === true, 'Caesar lease issued successfully');
    const cMeridaScope = cLease.scopes.find(s => s.project_id === MERIDA_PROJ);
    assert(cMeridaScope !== undefined, 'Caesar lease includes Mérida scope');
    assert(cMeridaScope.secondary_locations.length === 1, 'Caesar lease includes 1 secondary location for Mérida');
    assert(cMeridaScope.secondary_locations[0].location_name === 'Mérida Warehouse', 'Secondary location is Mérida Warehouse');
    assert(cMeridaScope.secondary_locations[0].radius_meters === 250, 'Warehouse radius in Caesar lease is 250m');

    // B. Luis lease ALSO contains primary + secondary warehouse (multi-location, not worker-specific!)
    await client.query(`SET "request.jwt.claim.sub" = '${LUIS_ID}';`);
    const lLeaseRes = await client.query(`SELECT public.issue_attendance_offline_lease('device-l', 24) AS res;`);
    const lLease = lLeaseRes.rows[0].res;
    assert(lLease.success === true, 'Luis lease issued successfully');
    const lMeridaScope = lLease.scopes.find(s => s.project_id === MERIDA_PROJ);
    assert(lMeridaScope !== undefined, 'Luis lease includes Mérida scope');
    assert(lMeridaScope.secondary_locations.length === 1, 'Luis lease includes Mérida Warehouse (multi-location normalized)');
    assert(lMeridaScope.secondary_locations[0].location_name === 'Mérida Warehouse', 'Secondary location for Luis is Mérida Warehouse');

    // C. Other worker (not assigned to Mérida) does NOT receive Mérida scope or warehouse
    await client.query(`SET "request.jwt.claim.sub" = '${OTHER_WORKER_ID}';`);
    const oLeaseRes = await client.query(`SELECT public.issue_attendance_offline_lease('device-o', 24) AS res;`);
    const oLease = oLeaseRes.rows[0].res;
    assert(oLease.success === true, 'Other worker lease issued');
    const oMeridaScope = oLease.scopes.find(s => s.project_id === MERIDA_PROJ);
    assert(oMeridaScope === undefined, 'Non-Mérida worker lease does NOT receive Mérida scope or warehouse');

    // 7. Online V2 Geofence Resolution Matrix (Section 24)
    console.log('\n--- 6. Testing Mérida Online Test Matrix (Section 24) ---');

    function createPunchPayload(personnelId, lat, lon, acc = 10, isOffline = false, leaseId = null, projId = MERIDA_PROJ) {
      const shiftId = crypto.randomUUID();
      const eventId = crypto.randomUUID();
      return {
        event_id: eventId,
        shift_id: shiftId,
        personnel_id: personnelId,
        project_id: projId,
        event_type: 'CLOCK_IN',
        work_type: 'ON_SITE',
        device_event_timestamp: new Date().toISOString(),
        timezone_offset_minutes: -360,
        device_id: 'test-device',
        device_platform: 'TEST',
        client_app_version: '5.1.0',
        client_release_id: 49,
        client_commit_hash: '6fa9421f',
        attendance_protocol_version: 2,
        created_offline: isOffline,
        offline_lease_id: leaseId,
        latitude: lat,
        longitude: lon,
        accuracy_meters: acc,
        gps_verified: true,
        geofence_status: 'INSIDE',
        face_verified: true
      };
    }

    await client.query('BEGIN;');

    // Test 1: Mérida Worker A (Caesar) at Main (20.9889, -89.6133) -> ALLOW / PRIMARY_GEOFENCE
    await client.query('SAVEPOINT sp_1;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const p1 = createPunchPayload(CAESAR_ID, 20.9889, -89.6133);
    const r1 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p1]);
    assert(r1.rows[0].res.success === true, 'Mérida Worker A at Main: ALLOWED');
    assert(r1.rows[0].res.authorization_policy === 'PRIMARY_GEOFENCE', 'Worker A at Main authorized as PRIMARY_GEOFENCE');
    await client.query('ROLLBACK TO SAVEPOINT sp_1;');

    // Test 2: Mérida Worker A (Caesar) at Warehouse (20.93019, -89.67442) -> ALLOW / SECONDARY_GEOFENCE
    await client.query('SAVEPOINT sp_2;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const p2 = createPunchPayload(CAESAR_ID, 20.93019, -89.67442);
    const r2 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p2]);
    assert(r2.rows[0].res.success === true, 'Mérida Worker A at Warehouse: ALLOWED');
    assert(r2.rows[0].res.authorization_policy === 'SECONDARY_GEOFENCE', 'Worker A at Warehouse authorized as SECONDARY_GEOFENCE');
    const ev2 = (await client.query(`SELECT * FROM public.attendance_events WHERE event_id = '${p2.event_id}';`)).rows[0];
    assert(ev2.attendance_location_id === warehouse.location_id, 'Stored event references Mérida Warehouse location_id');
    assert(ev2.server_geofence_status === 'SECONDARY_GEOFENCE', 'Stored event server_geofence_status is SECONDARY_GEOFENCE');
    await client.query('ROLLBACK TO SAVEPOINT sp_2;');

    // Test 3: Mérida Worker B (Luis) at Main -> ALLOW / PRIMARY_GEOFENCE
    await client.query('SAVEPOINT sp_3;');
    await client.query(`SET "request.jwt.claim.sub" = '${LUIS_ID}';`);
    const p3 = createPunchPayload(LUIS_ID, 20.9889, -89.6133);
    const r3 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p3]);
    assert(r3.rows[0].res.success === true, 'Mérida Worker B at Main: ALLOWED');
    assert(r3.rows[0].res.authorization_policy === 'PRIMARY_GEOFENCE', 'Worker B at Main authorized as PRIMARY_GEOFENCE');
    await client.query('ROLLBACK TO SAVEPOINT sp_3;');

    // Test 4: Mérida Worker B (Luis) at Warehouse -> ALLOW / SECONDARY_GEOFENCE
    await client.query('SAVEPOINT sp_4;');
    await client.query(`SET "request.jwt.claim.sub" = '${LUIS_ID}';`);
    const p4 = createPunchPayload(LUIS_ID, 20.93019, -89.67442);
    const r4 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p4]);
    assert(r4.rows[0].res.success === true, 'Mérida Worker B at Warehouse: ALLOWED');
    assert(r4.rows[0].res.authorization_policy === 'SECONDARY_GEOFENCE', 'Worker B at Warehouse authorized as SECONDARY_GEOFENCE');
    const ev4 = (await client.query(`SELECT * FROM public.attendance_events WHERE event_id = '${p4.event_id}';`)).rows[0];
    assert(ev4.attendance_location_id === warehouse.location_id, 'Worker B event references Mérida Warehouse location_id');
    await client.query('ROLLBACK TO SAVEPOINT sp_4;');

    // Test 5: Non-Mérida worker at Warehouse -> DENY (PROJECT_NOT_ASSIGNED)
    await client.query('SAVEPOINT sp_5;');
    await client.query(`SET "request.jwt.claim.sub" = '${OTHER_WORKER_ID}';`);
    const p5 = createPunchPayload(OTHER_WORKER_ID, 20.93019, -89.67442);
    const r5 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p5]);
    assert(r5.rows[0].res.success === false && r5.rows[0].res.error === 'PROJECT_NOT_ASSIGNED', 'Non-Mérida worker at Warehouse: DENIED (PROJECT_NOT_ASSIGNED)');
    await client.query('ROLLBACK TO SAVEPOINT sp_5;');

    // Test 6: Mérida worker outside both locations (20.5, -89.0) -> DENY (OUTSIDE_GEOFENCE)
    await client.query('SAVEPOINT sp_6;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const p6 = createPunchPayload(CAESAR_ID, 20.5, -89.0);
    const r6 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p6]);
    assert(r6.rows[0].res.success === false && r6.rows[0].res.error === 'OUTSIDE_GEOFENCE', 'Mérida worker outside both locations: DENIED (OUTSIDE_GEOFENCE)');
    await client.query('ROLLBACK TO SAVEPOINT sp_6;');

    // Test 7: Spoofed personnel_id -> DENY (IDENTITY_SPOOF_ATTEMPT)
    await client.query('SAVEPOINT sp_7;');
    await client.query(`SET "request.jwt.claim.sub" = '${LUIS_ID}';`);
    const p7 = createPunchPayload(CAESAR_ID, 20.9889, -89.6133); // Luis claiming to be Caesar
    const r7 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p7]);
    assert(r7.rows[0].res.error === 'IDENTITY_SPOOF_ATTEMPT', 'Spoofed personnel_id: DENIED (IDENTITY_SPOOF_ATTEMPT)');
    await client.query('ROLLBACK TO SAVEPOINT sp_7;');

    // Test 8: Inactive warehouse location -> DENY (OUTSIDE_GEOFENCE)
    await client.query('SAVEPOINT sp_8;');
    await client.query(`UPDATE public.attendance_locations SET is_active = FALSE WHERE location_id = '${warehouse.location_id}';`);
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const p8 = createPunchPayload(CAESAR_ID, 20.93019, -89.67442);
    const r8 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p8]);
    assert(r8.rows[0].res.error === 'OUTSIDE_GEOFENCE', 'Inactive warehouse location: DENIED (OUTSIDE_GEOFENCE)');
    await client.query('ROLLBACK TO SAVEPOINT sp_8;');

    // Test 9: Expired warehouse mapping -> DENY (OUTSIDE_GEOFENCE)
    await client.query('SAVEPOINT sp_9;');
    await client.query(`UPDATE public.attendance_project_locations SET valid_until = now() - interval '1 hour' WHERE project_id = '${MERIDA_PROJ}';`);
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const p9 = createPunchPayload(CAESAR_ID, 20.93019, -89.67442);
    const r9 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p9]);
    assert(r9.rows[0].res.error === 'OUTSIDE_GEOFENCE', 'Expired warehouse mapping: DENIED (OUTSIDE_GEOFENCE)');
    await client.query('ROLLBACK TO SAVEPOINT sp_9;');

    // 8. Offline Clocking & Replay Tests (Section 13 & 14)
    console.log('\n--- 7. Testing Offline Revalidation & Idempotency ---');
    // Test 10: Offline Mérida worker at Warehouse -> ACCEPT / SECONDARY_GEOFENCE
    await client.query('SAVEPOINT sp_10;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const p10 = createPunchPayload(CAESAR_ID, 20.93019, -89.67442, 10, true, cLease.lease_id);
    const r10 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p10]);
    assert(r10.rows[0].res.success === true, 'Offline punch at warehouse: ACCEPTED');
    assert(r10.rows[0].res.authorization_policy === 'SECONDARY_GEOFENCE', 'Offline punch authorized as SECONDARY_GEOFENCE');

    // Test 11: Idempotent Replay -> ALREADY_APPLIED
    const r11 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p10]);
    assert(r11.rows[0].res.status === 'ALREADY_APPLIED', 'Offline replay returns ALREADY_APPLIED');

    // Test 12: Same Event UUID with changed payload -> CANONICAL_HASH_MISMATCH
    const p12 = { ...p10, latitude: 20.93020 }; // altered coordinate
    const r12 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p12]);
    assert(r12.rows[0].res.error === 'CANONICAL_HASH_MISMATCH', 'Altered payload replay rejected: CANONICAL_HASH_MISMATCH');
    await client.query('ROLLBACK TO SAVEPOINT sp_10;');

    // Test 13: Offline punch outside both locations -> REJECT (OUTSIDE_GEOFENCE)
    await client.query('SAVEPOINT sp_13;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const p13 = createPunchPayload(CAESAR_ID, 20.5, -89.0, 10, true, cLease.lease_id);
    const r13 = await client.query('SELECT public.record_attendance_event($1) AS res;', [p13]);
    assert(r13.rows[0].res.error === 'OUTSIDE_GEOFENCE', 'Offline punch outside both: REJECTED (OUTSIDE_GEOFENCE)');
    await client.query('ROLLBACK TO SAVEPOINT sp_13;');

    // 9. Concurrency, Split Shifts & Home Office Regression (Sections 28 & 29)
    console.log('\n--- 8. Testing Concurrency, ClockOut, & Home Office Regression ---');
    // Test 14: Competing ClockIn conflict
    await client.query('SAVEPOINT sp_14;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const openShift = createPunchPayload(CAESAR_ID, 20.9889, -89.6133);
    const openRes = await client.query('SELECT public.record_attendance_event($1) AS res;', [openShift]);
    assert(openRes.rows[0].res.success === true, 'Open shift created');

    const competingShift = createPunchPayload(CAESAR_ID, 20.9889, -89.6133); // new shift_id while open
    const compRes = await client.query('SELECT public.record_attendance_event($1) AS res;', [competingShift]);
    assert(compRes.rows[0].res.status === 'ACTIVE_SHIFT_CONFLICT', 'Competing active shift: REJECTED (ACTIVE_SHIFT_CONFLICT)');

    // Test 15: Normal ClockOut
    const clockOutPayload = {
      ...openShift,
      event_id: crypto.randomUUID(),
      event_type: 'CLOCK_OUT',
      device_event_timestamp: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
    };
    const outRes = await client.query('SELECT public.record_attendance_event($1) AS res;', [clockOutPayload]);
    assert(outRes.rows[0].res.success === true && outRes.rows[0].res.event_type === 'CLOCK_OUT', 'Normal ClockOut: COMPLETED');
    await client.query('ROLLBACK TO SAVEPOINT sp_14;');

    // Test 16: Forgotten ClockOut
    await client.query('SAVEPOINT sp_16;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const forgtShift = createPunchPayload(CAESAR_ID, 20.9889, -89.6133);
    await client.query('SELECT public.record_attendance_event($1) AS res;', [forgtShift]);

    const forgtOutPayload = {
      ...forgtShift,
      event_id: crypto.randomUUID(),
      event_type: 'CLOCK_OUT',
      is_manual_adjustment: true,
      adjustment_reason: 'FORGOTTEN_CLOCKOUT',
      reported_departure_timestamp: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      worker_explanation: 'Forgot to clock out before leaving site',
      gps_verified: false,
      geofence_status: 'NOT_APPLICABLE'
    };
    const forgtRes = await client.query('SELECT public.record_attendance_event($1) AS res;', [forgtOutPayload]);
    assert(forgtRes.rows[0].res.success === true, 'Forgotten ClockOut: ACCEPTED');
    const forgtDbShift = (await client.query(`SELECT * FROM public.attendance_shifts WHERE shift_id = '${forgtShift.shift_id}';`)).rows[0];
    assert(forgtDbShift.status === 'REQUIRES_REVIEW', 'Forgotten ClockOut shift status is REQUIRES_REVIEW');
    assert(forgtDbShift.payable_hours === '8.00', 'Forgotten ClockOut defaults to 8.00 payable hours');
    await client.query('ROLLBACK TO SAVEPOINT sp_16;');

    // Test 17: HOME_OFFICE ClockIn does not require physical geofence
    await client.query('SAVEPOINT sp_17;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const homeOfficePayload = {
      ...createPunchPayload(CAESAR_ID, 0, 0),
      work_type: 'HOME_OFFICE',
      gps_verified: false,
      geofence_status: 'NOT_APPLICABLE',
      latitude: null,
      longitude: null
    };
    const hoRes = await client.query('SELECT public.record_attendance_event($1) AS res;', [homeOfficePayload]);
    assert(hoRes.rows[0].res.success === true, 'HOME_OFFICE ClockIn accepted without geofence check');
    await client.query('ROLLBACK TO SAVEPOINT sp_17;');

    // 10. Current 25 Project Regression Tests (Section 25)
    console.log('\n--- 9. Testing Current 25 Project Regression (Section 25) ---');
    const CDMX_PROJ = 'a68210e5-d579-4e6f-b2d3-af1a9d3a4911';
    const OPDE_PROJ = '4fe5c8c4-f381-4f4f-a6c2-fa54ee0838de';
    const BLOCKED_PVI = '92b46b29-1671-4fc5-bb1a-6408277f1302';
    const BLOCKED_SALTILLO = '3f484639-06fd-4547-bbe9-a6ddda280e46';

    // Assign Caesar to CDMX, OPDE, and blocked projects for testing geofence behavior
    await client.query(`
      UPDATE public.projects SET assigned_personnel = '["${CAESAR_ID}"]'::jsonb WHERE id = '${CDMX_PROJ}';
      UPDATE public.projects SET assigned_personnel = '["${CAESAR_ID}"]'::jsonb WHERE id = '${OPDE_PROJ}';
      UPDATE public.projects SET assigned_personnel = '["${CAESAR_ID}"]'::jsonb WHERE id = '${BLOCKED_PVI}';
      UPDATE public.projects SET assigned_personnel = '["${CAESAR_ID}"]'::jsonb WHERE id = '${BLOCKED_SALTILLO}';
    `);

    // A. Oficina CDMX (primary only: 19.4293, -99.1724) -> ALLOW
    await client.query('SAVEPOINT sp_cdmx;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const pCdmx = createPunchPayload(CAESAR_ID, 19.4293, -99.1724, 10, false, null, CDMX_PROJ);
    const rCdmx = await client.query('SELECT public.record_attendance_event($1) AS res;', [pCdmx]);
    assert(rCdmx.rows[0].res.success === true, 'Oficina CDMX primary geofence: ALLOWED');
    assert(rCdmx.rows[0].res.authorization_policy === 'PRIMARY_GEOFENCE', 'CDMX authorized as PRIMARY_GEOFENCE');
    await client.query('ROLLBACK TO SAVEPOINT sp_cdmx;');

    // CDMX worker at Mérida Warehouse -> DENY (warehouse is not mapped to CDMX)
    await client.query('SAVEPOINT sp_cdmx_wh;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const pCdmxWh = createPunchPayload(CAESAR_ID, 20.93019, -89.67442, 10, false, null, CDMX_PROJ);
    const rCdmxWh = await client.query('SELECT public.record_attendance_event($1) AS res;', [pCdmxWh]);
    assert(rCdmxWh.rows[0].res.error === 'OUTSIDE_GEOFENCE', 'CDMX punch at Mérida Warehouse: DENIED (OUTSIDE_GEOFENCE)');
    await client.query('ROLLBACK TO SAVEPOINT sp_cdmx_wh;');

    // B. Field project OPDE-LNV-085 (primary only: 21.9167, -101.9667) -> ALLOW
    await client.query('SAVEPOINT sp_opde;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const pOpde = createPunchPayload(CAESAR_ID, 21.9167, -101.9667, 10, false, null, OPDE_PROJ);
    const rOpde = await client.query('SELECT public.record_attendance_event($1) AS res;', [pOpde]);
    assert(rOpde.rows[0].res.success === true, 'Field project OPDE-LNV-085 primary: ALLOWED');
    await client.query('ROLLBACK TO SAVEPOINT sp_opde;');

    // C. Blocked project PVI Guadalajara -> REJECT (GEOFENCE_NOT_CONFIGURED)
    await client.query('SAVEPOINT sp_pvi;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const pPvi = createPunchPayload(CAESAR_ID, 20.67, -103.34, 10, false, null, BLOCKED_PVI);
    const rPvi = await client.query('SELECT public.record_attendance_event($1) AS res;', [pPvi]);
    assert(rPvi.rows[0].res.error === 'GEOFENCE_NOT_CONFIGURED', 'Blocked project PVI Guadalajara: REJECTED (GEOFENCE_NOT_CONFIGURED)');
    await client.query('ROLLBACK TO SAVEPOINT sp_pvi;');

    // D. Blocked project Tren Saltillo -> REJECT (GEOFENCE_NOT_CONFIGURED)
    await client.query('SAVEPOINT sp_salt;');
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const pSalt = createPunchPayload(CAESAR_ID, 25.43, -101.00, 10, false, null, BLOCKED_SALTILLO);
    const rSalt = await client.query('SELECT public.record_attendance_event($1) AS res;', [pSalt]);
    assert(rSalt.rows[0].res.error === 'GEOFENCE_NOT_CONFIGURED', 'Blocked project Tren Saltillo: REJECTED (GEOFENCE_NOT_CONFIGURED)');
    await client.query('ROLLBACK TO SAVEPOINT sp_salt;');

    await client.query('ROLLBACK;'); // Rollback all remaining uncommitted test modifications

    // 10. Clean up operational tables and restore control state to LEGACY_ACTIVE
    await client.query(`
      TRUNCATE public.attendance_events, public.attendance_shifts, public.attendance_offline_leases CASCADE;
      UPDATE public.attendance_v2_control SET system_state = 'LEGACY_ACTIVE' WHERE control_id = 1;
    `);

    // Verify fail-closed in LEGACY_ACTIVE
    await client.query(`SET "request.jwt.claim.sub" = '${CAESAR_ID}';`);
    const dormantLease = await client.query(`SELECT public.issue_attendance_offline_lease('device-c', 24) AS res;`);
    assert(dormantLease.rows[0].res.error === 'V2_DISABLED', 'Offline lease fails closed in LEGACY_ACTIVE (V2_DISABLED)');

    const dormantPunch = await client.query(`SELECT public.record_attendance_event($1) AS res;`, [p1]);
    assert(dormantPunch.rows[0].res.error === 'V2_DISABLED', 'Online punch fails closed in LEGACY_ACTIVE (V2_DISABLED)');

    console.log('\n========================================================================');
    console.log(`TOTAL TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('========================================================================\n');

    if (failed > 0) process.exit(1);

  } finally {
    await client.end();
  }
}

runTests().catch(e => {
  console.error('Fatal error in test suite:', e);
  process.exit(1);
});
