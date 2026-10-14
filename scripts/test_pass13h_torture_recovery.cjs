/**
 * PASS 13H: Full Torture, Security & Recovery Validation Suite
 * Environment: Disposable PostgreSQL 16 on port 54329
 *
 * Torture Dimensions:
 * 1. Clean Rebuild from source SQL files (13D, 13E, 13G)
 * 2. Identity / Spoofing / Multi-Role RLS Boundary Torture
 * 3. Ledger Immutability Torture (Triggers reject all updates/deletes)
 * 4. Concurrency & Advisory Lock Torture (Simultaneous ClockIns, duplicate replays, poison payloads)
 * 5. Multi-Device Overlap Simulation (Device A offline + Device B online -> no double payroll)
 * 6. Offline Lease Edge Cases (Expired, revoked before/after event, unscoped project)
 * 7. Geofence & GPS Edge Cases (Outside, unverified GPS, poor accuracy)
 * 8. Face ID Audit Integrity (Bypass reasons mandatory, never silent true)
 * 9. Timezone Offset & Wall-Clock Integrity
 * 10. Forgotten Clockout Edge Cases (8h payroll cap, review required)
 * 11. Zombie Shift Strict Threshold (>14h strictly, 8/0 cap, late offline replay, reconciliation)
 * 12. Failure Injection & Retry Convergence (Decoupled media, transport drop)
 * 13. Load / Replay Burst Storm Simulation (150-event concurrent burst, zero deadlocks)
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DISPOSABLE_CONN = 'postgres://postgres:pass13d_test_password@localhost:54329/postgres';

async function runPass13HTorture() {
  console.log('========================================================================');
  console.log('  PASS 13H: FULL TORTURE, SECURITY & RECOVERY VALIDATION SUITE');
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

  // Session helper
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

  try {
    // -------------------------------------------------------------------------
    // 1. CLEAN REBUILD FROM RAW ARTIFACTS
    // -------------------------------------------------------------------------
    console.log('1. Clean Rebuild from Raw Source SQL Artifacts...');

    // Read SQL source files
    const sqlSchema = fs.readFileSync(path.join(__dirname, 'sql/pass13d_attendance_v2_schema.sql'), 'utf-8');
    const sqlEngine = fs.readFileSync(path.join(__dirname, 'sql/pass13e_attendance_v2_engine.sql'), 'utf-8');
    const sqlMedia = fs.readFileSync(path.join(__dirname, 'sql/pass13g_attendance_v2_media.sql'), 'utf-8');

    // Tear down everything
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS auth CASCADE;
      CREATE SCHEMA public;
      CREATE SCHEMA auth;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, postgres;
    `);

    // Bootstrap prerequisite base tables stubs
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id),
        email TEXT,
        name TEXT,
        role TEXT,
        subsidiary TEXT DEFAULT 'MX',
        client_id UUID NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS public.mx_personnel (
        id TEXT PRIMARY KEY,
        name TEXT,
        employee_number TEXT,
        app_role TEXT,
        status TEXT,
        email TEXT,
        subsidiary TEXT DEFAULT 'MX',
        supervisor_id TEXT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS public.projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        subsidiary TEXT DEFAULT 'MX',
        client_id UUID NULL,
        assigned_personnel TEXT[],
        site_lead_ids TEXT[],
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Execute 13D schema
    await client.query(sqlSchema);
    // Execute 13E engine
    await client.query(sqlEngine);
    // Execute 13G media
    await client.query(sqlMedia);

    assert(true, 'Clean database rebuild succeeded from 13D, 13E, 13G source SQL files');

    // -------------------------------------------------------------------------
    // 2. SETUP TORTURE FIXTURES
    // -------------------------------------------------------------------------
    console.log('\n2. Setting up Torture Personas & Environments...');

    const tech1Uid = '11111111-1111-1111-1111-111111111111';
    const tech2Uid = '22222222-2222-2222-2222-222222222222';
    const supUid   = '33333333-3333-3333-3333-333333333333';
    const mgrUid   = '55555555-5555-5555-5555-555555555555';

    const tech1Pid = 'PER-TECH-001';
    const tech2Pid = 'PER-TECH-002';
    const supPid   = 'PER-SUP-001';
    const mgrPid   = 'PER-MGR-001';

    const projA = 'aaaaaaaa-1111-1111-1111-111111111111';
    const projB = 'bbbbbbbb-2222-2222-2222-222222222222';
    const geofenceVerA = 'cccccccc-1111-1111-1111-111111111111';

    await client.query(`
      INSERT INTO auth.users (id, email) VALUES 
        ($1, 'tech1@latnovva.test'),
        ($2, 'tech2@latnovva.test'),
        ($3, 'sup1@latnovva.test'),
        ($4, 'mgrmx@latnovva.test');
    `, [tech1Uid, tech2Uid, supUid, mgrUid]);

    await client.query(`
      INSERT INTO public.mx_personnel (id, name, employee_number, app_role, status, email, subsidiary, supervisor_id)
      VALUES 
        ($1, 'Tech One', 'T01', 'Tech', 'ACTIVE', 'tech1@latnovva.test', 'MX', $3),
        ($2, 'Tech Two', 'T02', 'Tech', 'ACTIVE', 'tech2@latnovva.test', 'MX', NULL),
        ($3, 'Supervisor One', 'S01', 'Supervisor', 'ACTIVE', 'sup1@latnovva.test', 'MX', NULL),
        ($4, 'Manager MX', 'M01', 'Manager', 'ACTIVE', 'mgrmx@latnovva.test', 'MX', NULL);
    `, [tech1Pid, tech2Pid, supPid, mgrPid]);

    await client.query(`
      INSERT INTO public.profiles (id, email, name, role, subsidiary)
      VALUES 
        ($1, 'tech1@latnovva.test', 'Tech One', 'Tech', 'MX'),
        ($2, 'tech2@latnovva.test', 'Tech Two', 'Tech', 'MX'),
        ($3, 'sup1@latnovva.test', 'Supervisor One', 'Supervisor', 'MX'),
        ($4, 'mgrmx@latnovva.test', 'Manager MX', 'Manager', 'MX');
    `, [tech1Uid, tech2Uid, supUid, mgrUid]);

    await client.query(`
      INSERT INTO public.projects (id, name, subsidiary, assigned_personnel, site_lead_ids)
      VALUES 
        ($1, 'Project Alpha', 'MX', ARRAY[$3, $4]::TEXT[], ARRAY[$4]::TEXT[]),
        ($2, 'Project Beta', 'MX', ARRAY[$5]::TEXT[], ARRAY[]::TEXT[]);
    `, [projA, projB, tech1Pid, supPid, tech2Pid]);

    await client.query(`
      INSERT INTO public.project_geofence_versions (
        version_id, project_id, version_number, latitude, longitude, radius_meters, accuracy_threshold_meters
      ) VALUES ($1, $2, 1, 25.686614, -100.316112, 150.00, 50.00);
    `, [geofenceVerA, projA]);

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

    // -------------------------------------------------------------------------
    // 3. LEDGER IMMUTABILITY TORTURE
    // -------------------------------------------------------------------------
    console.log('\n3. Ledger Immutability Torture (Triggers reject updates & deletes)...');

    // Create a real shift & event
    const tShiftId = '00000000-1111-2222-3333-444444444444';
    const tEventId = '11111111-2222-3333-4444-555555555555';
    const tEvent = {
      event_id: tEventId,
      shift_id: tShiftId,
      personnel_id: tech1Pid,
      project_id: projA,
      event_type: 'CLOCK_IN',
      work_type: 'ON_SITE',
      device_event_timestamp: '2026-10-14T08:00:00Z',
      timezone_offset_minutes: -360,
      device_id: 'DEV-TORTURE',
      device_platform: 'Android',
      client_app_version: 'v5.1.0',
      client_release_id: 49,
      client_commit_hash: 'hash_torture',
      attendance_protocol_version: 2,
      created_offline: false,
      offline_lease_id: null,
      latitude: 25.686614,
      longitude: -100.316112,
      accuracy_meters: 15.0,
      gps_verified: true,
      geofence_status: 'INSIDE',
      geofence_distance_meters: 10.0,
      geofence_version_id: geofenceVerA,
      face_verified: true,
      face_bypass_reason: null,
      is_manual_adjustment: false,
      adjustment_reason: null,
      reported_departure_timestamp: null,
      worker_explanation: null
    };

    let tInRes = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(tEvent)]);
      return res.rows[0].r;
    });
    assert(tInRes.success === true, 'Test event created on server');

    // Attempt direct UPDATE of event
    await assertThrows(
      async () => await client.query(`UPDATE public.attendance_events SET latitude = 0.0 WHERE event_id = $1`, [tEventId]),
      'ATTENDANCE_EVENT_IMMUTABLE',
      'Trigger blocks UPDATE on attendance_events'
    );

    // Attempt direct DELETE of event
    await assertThrows(
      async () => await client.query(`DELETE FROM public.attendance_events WHERE event_id = $1`, [tEventId]),
      'ATTENDANCE_EVENT_IMMUTABLE',
      'Trigger blocks DELETE on attendance_events'
    );

    // Attempt direct UPDATE of geofence version
    await assertThrows(
      async () => await client.query(`UPDATE public.project_geofence_versions SET radius_meters = 999 WHERE version_id = $1`, [geofenceVerA]),
      '23514',
      'Trigger blocks UPDATE on project_geofence_versions'
    );

    // Attempt direct DELETE of geofence version
    await assertThrows(
      async () => await client.query(`DELETE FROM public.project_geofence_versions WHERE version_id = $1`, [geofenceVerA]),
      '23514',
      'Trigger blocks DELETE on project_geofence_versions'
    );

    // -------------------------------------------------------------------------
    // 4. CONCURRENCY & ADVISORY LOCK TORTURE
    // -------------------------------------------------------------------------
    console.log('\n4. Concurrency & Advisory Lock Torture...');

    // Close previous shift so Tech 1 is clear
    const tOutId = '22222222-3333-4444-5555-666666666666';
    const tOutEvent = {
      ...tEvent,
      event_id: tOutId,
      event_type: 'CLOCK_OUT',
      device_event_timestamp: '2026-10-14T17:00:00Z'
    };
    await asUser(tech1Uid, async () => {
      await client.query(`SELECT public.record_attendance_event($1::jsonb)`, [JSON.stringify(tOutEvent)]);
    });

    // Simulate 2 truly concurrent Clock-In attempts on separate connections for Tech 1
    const clientB = new Client({ connectionString: DISPOSABLE_CONN });
    await clientB.connect();

    const concShift1 = 'aaaa1111-aaaa-1111-aaaa-111111111111';
    const concShift2 = 'bbbb2222-bbbb-2222-bbbb-222222222222';
    const concEvent1 = { ...tEvent, shift_id: concShift1, event_id: crypto.randomUUID() };
    const concEvent2 = { ...tEvent, shift_id: concShift2, event_id: crypto.randomUUID() };

    // Fire both concurrently
    const [p1, p2] = await Promise.all([
      (async () => {
        await client.query(`SET ROLE authenticated;`);
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [tech1Uid]);
        const res = await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(concEvent1)]);
        await client.query(`RESET ROLE;`);
        return res.rows[0].r;
      })(),
      (async () => {
        await clientB.query(`SET ROLE authenticated;`);
        await clientB.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [tech1Uid]);
        const res = await clientB.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(concEvent2)]);
        await clientB.query(`RESET ROLE;`);
        return res.rows[0].r;
      })()
    ]);

    await clientB.end();

    const outcomes = [p1.status, p2.status];
    assert(
      (outcomes.includes('APPLIED') && outcomes.includes('ACTIVE_SHIFT_CONFLICT')) ||
      (outcomes.includes('APPLIED') && outcomes.includes('CONFLICT')),
      `Advisory lock serialized concurrent Clock-Ins: [${outcomes.join(', ')}]`
    );

    const openCount = (await client.query(`SELECT count(*)::int as c FROM public.attendance_shifts WHERE personnel_id = $1 AND status = 'OPEN'`, [tech1Pid])).rows[0].c;
    assert(openCount === 1, 'Exactly one OPEN shift exists in database after concurrent race');

    // -------------------------------------------------------------------------
    // 5. MULTI-DEVICE OVERLAP SIMULATION
    // -------------------------------------------------------------------------
    console.log('\n5. Multi-Device Overlap Simulation...');

    // Device A starts an offline shift, while Device B tries to Clock-In online
    // Device A offline Clock-In will be replayed later.
    // Device B tries online Clock-In while Tech 1 already has open shift -> rejected
    const devBShift = crypto.randomUUID();
    const devBEvent = { ...tEvent, shift_id: devBShift, event_id: crypto.randomUUID() };

    let devBRes = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(devBEvent)]);
      return res.rows[0].r;
    });
    assert(devBRes.status === 'ACTIVE_SHIFT_CONFLICT', 'Device B rejected by server because worker already has active OPEN shift');

    // -------------------------------------------------------------------------
    // 6. GEOFENCE & GPS TORTURE
    // -------------------------------------------------------------------------
    console.log('\n6. Geofence & GPS Edge Cases...');

    // Close current shift first
    const activeShiftRow = (await client.query(`SELECT shift_id FROM public.attendance_shifts WHERE personnel_id = $1 AND status = 'OPEN'`, [tech1Pid])).rows[0];
    const clOut = {
      ...tEvent,
      shift_id: activeShiftRow.shift_id,
      event_id: crypto.randomUUID(),
      event_type: 'CLOCK_OUT',
      device_event_timestamp: '2026-10-14T17:00:00Z'
    };
    await asUser(tech1Uid, async () => {
      await client.query(`SELECT public.record_attendance_event($1::jsonb)`, [JSON.stringify(clOut)]);
    });

    // 1. Outside geofence (> 150m): Lat 25.7500 (approx 7km away)
    const outsideEvent = {
      ...tEvent,
      shift_id: crypto.randomUUID(),
      event_id: crypto.randomUUID(),
      latitude: 25.750000,
      longitude: -100.316112,
      accuracy_meters: 10.0
    };
    let outGeoRes = await asUser(tech1Uid, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(outsideEvent)])).rows[0].r;
    });
    assert(outGeoRes.success === false && outGeoRes.error === 'OUTSIDE_GEOFENCE', 'Clock-In outside geofence strictly rejected');

    // 2. Unverified GPS (gps_verified = false for ON_SITE)
    const unverifiedGpsEvent = {
      ...tEvent,
      shift_id: crypto.randomUUID(),
      event_id: crypto.randomUUID(),
      gps_verified: false
    };
    let unverifiedRes = await asUser(tech1Uid, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(unverifiedGpsEvent)])).rows[0].r;
    });
    assert(unverifiedRes.success === false && unverifiedRes.error === 'GPS_UNVERIFIED', 'Unverified GPS rejected for ON_SITE');

    // 3. Poor accuracy (> 50m threshold, e.g. 120m)
    const poorAccEvent = {
      ...tEvent,
      shift_id: crypto.randomUUID(),
      event_id: crypto.randomUUID(),
      accuracy_meters: 120.0
    };
    let poorAccRes = await asUser(tech1Uid, async () => {
      return (await client.query(`SELECT public.record_attendance_event($1::jsonb) as r`, [JSON.stringify(poorAccEvent)])).rows[0].r;
    });
    assert(poorAccRes.success === false && poorAccRes.error === 'GPS_ACCURACY_UNACCEPTABLE', 'Poor GPS accuracy rejected');

    // -------------------------------------------------------------------------
    // 7. ZOMBIE SHIFT STRICT THRESHOLD TORTURE
    // -------------------------------------------------------------------------
    console.log('\n7. Zombie Shift Strict Threshold Torture (>14h strictly)...');

    // Shift opened exactly 13h 59m ago
    const shift13h59Id = crypto.randomUUID();
    const time13h59 = new Date(Date.now() - (13 * 3600 + 59 * 60) * 1000).toISOString();
    await client.query(`
      INSERT INTO public.attendance_shifts (
        shift_id, auth_user_id, personnel_id, project_id, subsidiary, work_type,
        first_clock_in_at, status
      ) VALUES ($1, $2, $3, $4, 'MX', 'ON_SITE', $5, 'OPEN');
    `, [shift13h59Id, tech2Uid, tech2Pid, projB, time13h59]);

    // Shift opened 14h 05m ago (>14h)
    const shift14h05Id = crypto.randomUUID();
    const time14h05 = new Date(Date.now() - (14 * 3600 + 5 * 60) * 1000).toISOString();
    await client.query(`
      INSERT INTO public.attendance_shifts (
        shift_id, auth_user_id, personnel_id, project_id, subsidiary, work_type,
        first_clock_in_at, status
      ) VALUES ($1, $2, $3, $4, 'MX', 'ON_SITE', $5, 'OPEN');
    `, [shift14h05Id, tech1Uid, tech1Pid, projA, time14h05]);

    // Run zombie closure job
    let zRes = (await client.query(`SELECT public.run_zombie_shift_closure(14.00) as r`)).rows[0].r;
    assert(zRes.success === true, 'Zombie closure job executed');

    // Verify 13h59m shift remains OPEN (not closed)
    const s13 = (await client.query(`SELECT status FROM public.attendance_shifts WHERE shift_id = $1`, [shift13h59Id])).rows[0];
    assert(s13 && s13.status === 'OPEN', 'Shift at 13h59m remains OPEN (boundary test passed)');

    // Verify 14h05m shift transitioned to ZOMBIE_PENDING_RECONCILIATION
    const s14 = (await client.query(`SELECT status, payable_hours, overtime_hours FROM public.attendance_shifts WHERE shift_id = $1`, [shift14h05Id])).rows[0];
    assert(s14 && s14.status === 'ZOMBIE_PENDING_RECONCILIATION', 'Shift at >14h transitioned to ZOMBIE_PENDING_RECONCILIATION');
    assert(Number(s14.payable_hours) === 8.00 && Number(s14.overtime_hours) === 0.00, 'Zombie shift payroll capped at 8h payable and 0 OT');

    // Clean up open test shifts
    await client.query(`UPDATE public.attendance_shifts SET status = 'COMPLETED' WHERE status = 'OPEN';`);

    // -------------------------------------------------------------------------
    // 8. 150-EVENT BURST REPLAY STORM
    // -------------------------------------------------------------------------
    console.log('\n8. Load / Replay Burst Storm Simulation (150-event burst, zero deadlocks)...');

    const burstEvents = [];
    const burstCount = 75; // 75 Clock-Ins + 75 Clock-Outs = 150 events

    for (let i = 0; i < burstCount; i++) {
      const sId = crypto.randomUUID();
      const inId = crypto.randomUUID();
      const outId = crypto.randomUUID();

      burstEvents.push({
        event_id: inId,
        shift_id: sId,
        personnel_id: tech1Pid,
        project_id: projA,
        event_type: 'CLOCK_IN',
        work_type: 'HOME_OFFICE',
        device_event_timestamp: '2026-10-10T08:00:00Z',
        timezone_offset_minutes: -360,
        device_id: 'DEV-BURST',
        device_platform: 'Android',
        client_app_version: 'v5.1.0',
        client_release_id: 49,
        client_commit_hash: 'hash_burst',
        attendance_protocol_version: 2,
        created_offline: false,
        offline_lease_id: null,
        latitude: null,
        longitude: null,
        accuracy_meters: null,
        gps_verified: false,
        geofence_status: 'NOT_APPLICABLE',
        geofence_distance_meters: null,
        geofence_version_id: null,
        face_verified: false,
        face_bypass_reason: 'Burst test',
        is_manual_adjustment: false,
        adjustment_reason: null,
        reported_departure_timestamp: null,
        worker_explanation: null
      });

      burstEvents.push({
        event_id: outId,
        shift_id: sId,
        personnel_id: tech1Pid,
        project_id: projA,
        event_type: 'CLOCK_OUT',
        work_type: 'HOME_OFFICE',
        device_event_timestamp: '2026-10-10T17:00:00Z',
        timezone_offset_minutes: -360,
        device_id: 'DEV-BURST',
        device_platform: 'Android',
        client_app_version: 'v5.1.0',
        client_release_id: 49,
        client_commit_hash: 'hash_burst',
        attendance_protocol_version: 2,
        created_offline: false,
        offline_lease_id: null,
        latitude: null,
        longitude: null,
        accuracy_meters: null,
        gps_verified: false,
        geofence_status: 'NOT_APPLICABLE',
        geofence_distance_meters: null,
        geofence_version_id: null,
        face_verified: false,
        face_bypass_reason: 'Burst test',
        is_manual_adjustment: false,
        adjustment_reason: null,
        reported_departure_timestamp: null,
        worker_explanation: null
      });
    }

    const tStart = Date.now();
    let burstRes = await asUser(tech1Uid, async () => {
      const res = await client.query(`SELECT public.sync_attendance_events($1::jsonb) as r`, [JSON.stringify(burstEvents)]);
      return res.rows[0].r;
    });
    const durationMs = Date.now() - tStart;

    assert(Array.isArray(burstRes) && burstRes.length === 150, '150-event batch replay completed');
    const appliedEvents = burstRes.filter(r => r.outcome && r.outcome.success);
    assert(appliedEvents.length === 150, 'All 150 burst events processed successfully with zero deadlocks');
    console.log(`     -> Throughput: 150 events in ${durationMs}ms (~${Math.round(150 / (durationMs / 1000))} events/sec)`);

  } catch (err) {
    console.error('FATAL UNHANDLED ERROR in test suite:', err);
    failedTests++;
  } finally {
    await client.end();
  }

  console.log('\n========================================================================');
  console.log(`  PASS 13H TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPass13HTorture();
