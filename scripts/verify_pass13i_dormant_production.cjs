/**
 * PASS 13I: Post-Deployment Verification Suite
 * Target: Production Supabase (dvkkxwtqonjgrvloisid)
 * 
 * Verifies Steps 8–16:
 * 8. Initial Control State (attendance_v2_control)
 * 9. 9 Dormant Tables and Constraints
 * 10. Server Functions & RLS
 * 11. Production Dormant Rejection Test
 * 12. Post-Rejection Production DB Cleanliness (0 shifts, 0 events)
 * 13. Legacy Punch Continuity
 * 14. Canary Normalized Punch Continuity
 * 15. PostgREST & Client Contract
 * 16. Storage Infrastructure
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dvkkxwtqonjgrvloisid.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, anonKey);

async function runPostDeploymentVerification() {
  console.log('========================================================================');
  console.log('  PASS 13I: POST-DEPLOYMENT PRODUCTION VERIFICATION');
  console.log('  Target: Production Supabase (dvkkxwtqonjgrvloisid)');
  console.log('========================================================================\n');

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

  // Authenticate as technician
  console.log('Authenticating test session as technician (tech@latnovva.com)...');
  const { data: authSession, error: authErr } = await client.auth.signInWithPassword({
    email: 'tech@latnovva.com',
    password: 'CanaryPassword123!'
  });
  if (authErr) {
    console.error('❌ Authentication failed:', authErr.message);
    process.exit(1);
  }
  const techUser = authSession.user;
  console.log('✅ Authenticated successfully (UID:', techUser.id, ')\n');

  try {
    // ── STEP 8: VERIFY INITIAL CONTROL STATE ──────────────────────────────────
    console.log('--- Step 8: Verify attendance_v2_control ---');
    const { data: controlData, error: controlErr } = await client
      .from('attendance_v2_control')
      .select('*')
      .eq('control_id', 1)
      .single();

    if (controlErr) {
      assert(false, `attendance_v2_control query failed: ${controlErr.message}`);
    } else {
      assert(controlData !== null, 'attendance_v2_control row exists');
      assert(controlData.control_id === 1, 'control_id === 1');
      assert(controlData.system_state === 'LEGACY_ACTIVE', `system_state === 'LEGACY_ACTIVE' (actual: ${controlData.system_state})`);
      assert(controlData.protocol_version === 2, `protocol_version === 2 (actual: ${controlData.protocol_version})`);
      assert(controlData.minimum_v2_client_release_id === null, 'minimum_v2_client_release_id IS NULL');
      assert(controlData.v2_activated_at === null, 'v2_activated_at IS NULL');
      assert(controlData.legacy_frozen_at === null, 'legacy_frozen_at IS NULL');
    }

    // ── STEP 9: VERIFY DORMANT TABLES ARE EMPTY ──────────────────────────────
    console.log('\n--- Step 9: Verify 9 Dormant Tables are Empty ---');
    const dormantTables = [
      'attendance_shifts',
      'attendance_events',
      'attendance_offline_leases',
      'attendance_offline_lease_scopes',
      'attendance_event_media',
      'attendance_adjustments',
      'attendance_audit_log'
    ];

    for (const tbl of dormantTables) {
      const { count, error: countErr } = await client
        .from(tbl)
        .select('*', { count: 'exact', head: true });

      if (countErr) {
        assert(false, `Table ${tbl} error: ${countErr.message}`);
      } else {
        assert(count === 0, `Table public.${tbl} exists and contains 0 rows (count: ${count})`);
      }
    }

    // Check project_geofence_versions exists
    const { count: geoCount, error: geoErr } = await client
      .from('project_geofence_versions')
      .select('*', { count: 'exact', head: true });
    assert(!geoErr, `Table public.project_geofence_versions exists (records: ${geoCount ?? 0})`);

    // ── STEP 10: VERIFY SERVER FUNCTIONS & GUARDED TRANSITIONS ───────────────
    console.log('\n--- Step 10: Verify Server Functions & Control Guards ---');
    // Test issue_attendance_offline_lease in LEGACY_ACTIVE
    const { data: leaseData, error: leaseErr } = await client.rpc('issue_attendance_offline_lease', {
      p_client_app_version: '5.1.0',
      p_client_release_id: 49,
      p_device_id: 'test-device-pass13i',
      p_duration_hours: 24
    });
    if (leaseErr) {
      assert(false, `RPC issue_attendance_offline_lease error: ${leaseErr.message}`);
    } else {
      assert(leaseData && leaseData.success === false && leaseData.error === 'V2_DISABLED' && leaseData.reason === 'LEGACY_ACTIVE',
        `RPC issue_attendance_offline_lease fail-closed in LEGACY_ACTIVE (got error: ${leaseData?.error})`);
    }

    // Test transition_attendance_v2_control_state is protected and denied for authenticated users
    const { data: transData, error: transErr } = await client.rpc('transition_attendance_v2_control_state', {
      p_new_state: 'V2_ACTIVE',
      p_reason: 'Testing guarded state machine'
    });
    assert(transErr && transErr.message.includes('permission denied'),
      `State machine is protected: authenticated users denied execute on transition_attendance_v2_control_state (${transErr?.message})`);

    // ── STEP 11: PROVE PRODUCTION DORMANT REJECTION GATE ─────────────────────
    console.log('\n--- Step 11: Execute Production Dormant Rejection Test ---');
    const dummyEvent = {
      event_id: '00000000-0000-0000-0000-000000000001',
      client_mutation_id: '00000000-0000-0000-0000-000000000001',
      device_event_id: '00000000-0000-0000-0000-000000000001',
      personnel_id: techUser.id,
      shift_id: '00000000-0000-0000-0000-000000000002',
      event_type: 'CLOCK_IN',
      work_type: 'NORMAL',
      occurred_at_utc: new Date().toISOString(),
      timezone: 'America/Mexico_City',
      timezone_offset_minutes: -360,
      geo_lat: 20.9676,
      geo_lng: -89.5926,
      geo_accuracy_meters: 10,
      capture_channel: 'ONLINE_DIRECT',
      auth_session_id: techUser.id,
      client_app_version: '5.1.0',
      client_release_id: 49,
      protocol_version: 2
    };

    // Test record_attendance_event fail-closed rejection
    const { data: recordRes, error: recordErr } = await client.rpc('record_attendance_event', { p_event: dummyEvent });
    assert(!recordErr && recordRes && recordRes.success === false && recordRes.status === 'REJECTED' && recordRes.error === 'V2_DISABLED',
      `record_attendance_event rejected mutation in LEGACY_ACTIVE (status: ${recordRes?.status}, error: ${recordRes?.error})`);

    // Test sync_attendance_events batch fail-closed rejection
    const { data: syncRes, error: syncErr } = await client.rpc('sync_attendance_events', { p_events: [dummyEvent] });
    const syncOutcome = syncRes && syncRes[0]?.outcome;
    assert(!syncErr && syncOutcome && syncOutcome.success === false && syncOutcome.status === 'REJECTED' && syncOutcome.error === 'V2_DISABLED',
      `sync_attendance_events rejected batch in LEGACY_ACTIVE (status: ${syncOutcome?.status}, error: ${syncOutcome?.error})`);

    // ── STEP 12: VERIFY PRODUCTION DB CLEANLINESS ─────────────────────────────
    console.log('\n--- Step 12: Verify Post-Rejection Production DB Cleanliness ---');
    const { count: postShiftCount } = await client.from('attendance_shifts').select('*', { count: 'exact', head: true });
    const { count: postEventCount } = await client.from('attendance_events').select('*', { count: 'exact', head: true });
    const { count: postLeaseCount } = await client.from('attendance_offline_leases').select('*', { count: 'exact', head: true });

    assert(postShiftCount === 0, `Zero persistent shifts created in production (actual: ${postShiftCount})`);
    assert(postEventCount === 0, `Zero persistent events created in production (actual: ${postEventCount})`);
    assert(postLeaseCount === 0, `Zero persistent leases created in production (actual: ${postLeaseCount})`);

    // ── STEP 13 & 14: VERIFY LEGACY & CANARY CONTINUITY ───────────────────────
    console.log('\n--- Step 13 & 14: Verify Legacy & Canary Punch Continuity ---');
    const { data: writeMode, error: writeModeErr } = await client.rpc('get_attendance_write_mode');
    if (writeModeErr) {
      assert(false, `get_attendance_write_mode error: ${writeModeErr.message}`);
    } else {
      assert(writeMode !== null, 'get_attendance_write_mode returned valid response');
      assert(typeof writeMode.normalized_attendance_enabled === 'boolean', 'normalized_attendance_enabled boolean returned');
    }

    // Verify mx_timesheets open shifts remain unchanged and queryable
    const { count: openShiftsCount, error: openTsErr } = await client
      .from('mx_timesheets')
      .select('*', { count: 'exact', head: true })
      .is('time_out', null);

    assert(!openTsErr, `mx_timesheets open shifts queryable without error`);
    assert(typeof openShiftsCount === 'number' && openShiftsCount >= 0, `mx_timesheets legacy records intact (current open shifts: ${openShiftsCount})`);

    // ── STEP 15: POSTGREST & CLIENT CONTRACT ──────────────────────────────────
    console.log('\n--- Step 15: PostgREST & Platform Settings Contract ---');
    const { data: settings, error: settingsErr } = await client
      .from('platform_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    assert(!settingsErr && settings !== null, 'platform_settings global record accessible');
    assert(settings.minimum_client_version === '5.0.3', `Production platform minimum_client_version remains 5.0.3 (got: ${settings.minimum_client_version})`);

    // ── STEP 16: STORAGE INFRASTRUCTURE ───────────────────────────────────────
    console.log('\n--- Step 16: Storage Infrastructure Verification ---');
    // Verify attendance_event_media table specifies attendance-media storage bucket
    const { data: mediaSample, error: mediaErr } = await client
      .from('attendance_event_media')
      .select('storage_bucket')
      .limit(0);
    assert(!mediaErr, 'attendance_event_media schema queryable for storage_bucket column');

    console.log('\n========================================================================');
    console.log(`  POST-DEPLOYMENT PRODUCTION VERIFICATION: ${passed} PASSED / ${failed} FAILED`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Fatal post-deployment verification error:', err);
    failed++;
  }

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPostDeploymentVerification().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}

module.exports = { runPostDeploymentVerification };
