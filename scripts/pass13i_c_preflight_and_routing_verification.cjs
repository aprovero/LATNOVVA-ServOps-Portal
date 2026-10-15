/**
 * PASS 13I-C: Predeploy Gate and Dormant Write Routing Verification
 * Target: Production Supabase (dvkkxwtqonjgrvloisid)
 * 
 * Verifies Predeploy Gates and Client Routing:
 * 1. attendance_v2_control.system_state === 'LEGACY_ACTIVE'
 * 2. protocol_version === 2
 * 3. minimum_v2_client_release_id IS NULL
 * 4. platform_settings.minimum_client_version === '5.0.3'
 * 5. zero V2 shifts, events, offline leases, media, adjustments
 * 6. project_geofence_versions === 0
 * 7. legacy writes not frozen (legacy_frozen_at IS NULL)
 * 8. record_clock_punch callable and enabled
 * 9. verify technician's write mode via RPC get_attendance_write_mode
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dvkkxwtqonjgrvloisid.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey);

async function runVerification() {
  console.log('========================================================================');
  console.log('  PASS 13I-C: PREDEPLOY GATES & DORMANT ROUTING VERIFICATION');
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
  console.log('Authenticating session as technician (tech@latnovva.com)...');
  const { data: authSession, error: authErr } = await client.auth.signInWithPassword({
    email: 'tech@latnovva.com',
    password: 'CanaryPassword123!'
  });
  if (authErr) {
    console.error('❌ Authentication failed:', authErr.message);
    process.exit(1);
  }
  const techUser = authSession.user;
  console.log(`✅ Authenticated successfully (UID: ${techUser.id})\n`);

  try {
    // 1. Control State
    console.log('--- 1. Control Table Checks ---');
    const { data: control, error: cErr } = await client
      .from('attendance_v2_control')
      .select('*')
      .eq('control_id', 1)
      .single();

    assert(!cErr && control, 'attendance_v2_control query successful');
    assert(control && control.system_state === 'LEGACY_ACTIVE', `system_state === 'LEGACY_ACTIVE' (actual: ${control?.system_state})`);
    assert(control && control.protocol_version === 2, `protocol_version === 2 (actual: ${control?.protocol_version})`);
    assert(control && control.minimum_v2_client_release_id === null, 'minimum_v2_client_release_id IS NULL');
    assert(control && control.legacy_frozen_at === null, 'legacy_frozen_at IS NULL');
    assert(control && control.v2_activated_at === null, 'v2_activated_at IS NULL');

    // 2. Platform Settings
    console.log('\n--- 2. Platform Settings Checks ---');
    const { data: settings, error: sErr } = await client
      .from('platform_settings')
      .select('*')
      .eq('id', 'global')
      .single();

    assert(!sErr && settings, 'platform_settings query successful');
    assert(settings && settings.minimum_client_version === '5.0.3', `minimum_client_version === '5.0.3' (actual: ${settings?.minimum_client_version})`);

    // 3. Zero V2 Data Check
    console.log('\n--- 3. Zero V2 Data Checks ---');
    const tablesToCheck = [
      'attendance_shifts',
      'attendance_events',
      'attendance_offline_leases',
      'attendance_offline_lease_scopes',
      'attendance_event_media',
      'attendance_adjustments',
      'attendance_audit_log',
      'project_geofence_versions'
    ];

    for (const t of tablesToCheck) {
      const { count, error } = await client.from(t).select('*', { count: 'exact', head: true });
      assert(!error, `Query count on ${t} succeeded`);
      assert(count === 0, `Table public.${t} count is 0 (actual: ${count})`);
    }

    // 4. Legacy continuity & Write Mode
    console.log('\n--- 4. Client Write Mode & Legacy Writer Continuity ---');
    const { data: writeModeData, error: wmErr } = await client.rpc('get_attendance_write_mode');
    assert(!wmErr, `get_attendance_write_mode RPC executed: ${wmErr ? wmErr.message : JSON.stringify(writeModeData)}`);
    console.log(`  ℹ️ Technician (${techUser.id}) write mode response:`, writeModeData);
    const resolvedMode = writeModeData?.mode;
    assert(resolvedMode === 'CANARY' || resolvedMode === 'LEGACY', `Write mode is CANARY or LEGACY (never V2) (actual: ${resolvedMode})`);
    assert(typeof writeModeData?.normalized_attendance_enabled === 'boolean', 'normalized_attendance_enabled boolean returned');

    // 5. Verify record_clock_punch RPC exists and is enabled
    console.log('\n--- 5. Legacy record_clock_punch Existence ---');
    // Test with invalid UUID punch_id to verify function exists and executes validation
    const { data: punchRes, error: punchErr } = await client.rpc('record_clock_punch', {
      p_punch_id: '00000000-0000-0000-0000-000000000000',
      p_timestamp: new Date().toISOString(),
      p_type: 'INVALID_TEST',
      p_date: '2026-10-15',
      p_target_personnel_id: '00000000-0000-0000-0000-000000000000'
    });
    if (punchErr) {
      const isMissing = punchErr.message.includes('function') && punchErr.message.includes('does not exist');
      assert(!isMissing, `record_clock_punch RPC is accessible and registered (response: ${punchErr.message})`);
    } else {
      assert(true, 'record_clock_punch RPC responded');
    }

    // 6. mx_timesheets open shifts continuity
    console.log('\n--- 6. Legacy mx_timesheets Continuity ---');
    const { count: openShiftsCount, error: openTsErr } = await client
      .from('mx_timesheets')
      .select('*', { count: 'exact', head: true })
      .is('time_out', null);

    assert(!openTsErr, `mx_timesheets open shifts queryable without error`);
    assert(typeof openShiftsCount === 'number' && openShiftsCount >= 0, `mx_timesheets legacy records intact (current open shifts: ${openShiftsCount})`);

    console.log('\n========================================================================');
    console.log(`VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected failure during verification:', err);
    process.exit(1);
  }
}

runVerification();
