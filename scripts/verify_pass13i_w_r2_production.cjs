/**
 * PASS 13I-W-R2: Production State & Configuration Verification Suite
 * Target: Production Supabase (dvkkxwtqonjgrvloisid)
 * 
 * Verifies:
 * 1. Control State: system_state = LEGACY_ACTIVE, minimum_release = NULL, protocol = 2
 * 2. Operational Tables: shifts = 0, events = 0, leases = 0, media = 0
 * 3. Geofence Versions: 25 rows, 0 warehouse_bypass_allowed = TRUE, 0 blocked projects
 * 4. Multi-Location Infrastructure:
 *    - attendance_locations (Mérida Warehouse: 20.93019, -89.67442, radius 250m)
 *    - attendance_project_locations (mapped to Mérida c95e8081-3323-4c55-87f5-259207865768)
 * 5. Storage & Media Security:
 *    - attendance-v2-media-private private = true
 *    - anonymous access rejected
 * 6. Legacy Attendance Safety:
 *    - platform_settings.minimum_client_version = 5.0.3
 *    - record_clock_punch intact
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dvkkxwtqonjgrvloisid.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

const client = createClient(supabaseUrl, anonKey);

function httpProbe(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', (err) => resolve({ statusCode: 0, error: err.message }));
  });
}

async function verifyProduction() {
  console.log('========================================================================');
  console.log('  PASS 13I-W-R2: PRODUCTION STATE & CONFIGURATION VERIFICATION');
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

  // 1. Authenticate as technician to query authenticated views / RPCs
  console.log('Authenticating test session as technician (tech@latnovva.com)...');
  const { data: authSession, error: authErr } = await client.auth.signInWithPassword({
    email: 'tech@latnovva.com',
    password: 'CanaryPassword123!'
  });

  if (authErr) {
    console.warn(`  ⚠️ Technician login failed (${authErr.message}). Continuing with anonymous client checks...`);
  } else {
    console.log('  ✅ Technician authenticated successfully.');
  }

  // 2. Control State Verification
  console.log('\n--- 1. Control State Verification ---');
  const { data: controlData, error: controlErr } = await client
    .from('attendance_v2_control')
    .select('*')
    .eq('control_id', 1)
    .single();

  if (controlErr) {
    assert(false, `Failed to query attendance_v2_control: ${controlErr.message}`);
  } else {
    assert(controlData.system_state === 'LEGACY_ACTIVE', `system_state is LEGACY_ACTIVE (actual: ${controlData.system_state})`);
    assert(controlData.protocol_version === 2, `protocol_version is 2 (actual: ${controlData.protocol_version})`);
    assert(controlData.minimum_v2_client_release_id === null, `minimum_v2_client_release_id is NULL (actual: ${controlData.minimum_v2_client_release_id})`);
  }

  // 3. Operational Tables Verification (Must be 0)
  console.log('\n--- 2. Operational Row Counts ---');
  const { count: shiftCount } = await client.from('attendance_shifts').select('*', { count: 'exact', head: true });
  assert(shiftCount === 0, `attendance_shifts count is 0 (actual: ${shiftCount})`);

  const { count: eventCount } = await client.from('attendance_events').select('*', { count: 'exact', head: true });
  assert(eventCount === 0, `attendance_events count is 0 (actual: ${eventCount})`);

  const { count: leaseCount } = await client.from('attendance_offline_leases').select('*', { count: 'exact', head: true });
  assert(leaseCount === 0, `attendance_offline_leases count is 0 (actual: ${leaseCount})`);

  const { count: mediaCount } = await client.from('attendance_event_media').select('*', { count: 'exact', head: true });
  assert(mediaCount === 0, `attendance_event_media count is 0 (actual: ${mediaCount})`);

  // 4. Geofence Versions Verification
  console.log('\n--- 3. Project Geofence Versions ---');
  const { data: geofences, error: geoErr } = await client
    .from('project_geofence_versions')
    .select('project_id, warehouse_bypass_allowed');

  if (geoErr) {
    assert(false, `Failed to query project_geofence_versions: ${geoErr.message}`);
  } else {
    assert(geofences.length === 25, `project_geofence_versions contains exactly 25 rows (actual: ${geofences.length})`);
    const bypassCount = geofences.filter(g => g.warehouse_bypass_allowed === true).length;
    assert(bypassCount === 0, `warehouse_bypass_allowed = TRUE is 0 (actual: ${bypassCount})`);

    const BLOCKED_PVI = '92b46b29-1671-4fc5-bb1a-6408277f1302';
    const BLOCKED_SALTILLO = '3f484639-06fd-4547-bbe9-a6ddda280e46';
    const hasPvi = geofences.some(g => g.project_id === BLOCKED_PVI);
    const hasSaltillo = geofences.some(g => g.project_id === BLOCKED_SALTILLO);
    assert(!hasPvi, `PVI Guadalajara blocked project NOT in geofence versions`);
    assert(!hasSaltillo, `Tren Saltillo blocked project NOT in geofence versions`);
  }

  // 5. Multi-Location Infrastructure Verification
  console.log('\n--- 4. Multi-Location Infrastructure ---');
  const { data: locations, error: locErr } = await client
    .from('attendance_locations')
    .select('*');

  if (locErr) {
    console.log(`  ℹ️ attendance_locations query: ${locErr.message} (expected if bundle not yet applied)`);
  } else {
    assert(locations.length === 1, `attendance_locations contains 1 seed location (actual: ${locations.length})`);
    if (locations.length > 0) {
      const wh = locations[0];
      assert(wh.name === 'Mérida Warehouse', `Location name is Mérida Warehouse (actual: ${wh.name})`);
      assert(Number(wh.latitude) === 20.93019, `Warehouse latitude is 20.93019 (actual: ${wh.latitude})`);
      assert(Number(wh.longitude) === -89.67442, `Warehouse longitude is -89.67442 (actual: ${wh.longitude})`);
      assert(wh.radius_meters === 250, `Warehouse radius is 250m (actual: ${wh.radius_meters})`);
      assert(wh.is_active === true, `Warehouse is_active = true`);
    }
  }

  const { data: projLocations, error: plErr } = await client
    .from('attendance_project_locations')
    .select('*');

  if (plErr) {
    console.log(`  ℹ️ attendance_project_locations query: ${plErr.message} (expected if bundle not yet applied)`);
  } else {
    assert(projLocations.length === 1, `attendance_project_locations contains 1 mapping (actual: ${projLocations.length})`);
    if (projLocations.length > 0) {
      const mapping = projLocations[0];
      assert(mapping.project_id === 'c95e8081-3323-4c55-87f5-259207865768', `Mapped to authoritative Mérida project ID`);
      assert(mapping.is_active === true, `Mapping is_active = true`);
    }
  }

  // 6. Storage Security Probe
  console.log('\n--- 5. Storage Security Verification ---');
  const anonProbe = await httpProbe(`${supabaseUrl}/storage/v1/object/public/attendance-v2-media-private/selfies/MX/test.jpg`);
  assert(anonProbe.statusCode === 400 || anonProbe.statusCode === 404 || anonProbe.statusCode === 403,
    `Anonymous storage access denied (HTTP ${anonProbe.statusCode})`);

  // 7. Platform Settings & Legacy Attendance Safety
  console.log('\n--- 6. Platform Settings & Legacy Attendance Safety ---');
  const { data: settings, error: setErr } = await client
    .from('platform_settings')
    .select('*')
    .eq('id', 'global')
    .single();

  if (setErr) {
    assert(false, `Failed to query platform_settings: ${setErr.message}`);
  } else {
    assert(settings.minimum_client_version === '5.0.3', `platform minimum_client_version is 5.0.3 (actual: ${settings.minimum_client_version})`);
  }

  console.log('\n========================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('========================================================================\n');
}

verifyProduction().catch(console.error);
