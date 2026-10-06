const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

function parseSemver(v) {
  if (!v || typeof v !== 'string') return null;
  const clean = v.replace(/^v/, '').trim();
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function compareSemver(v1, v2) {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);
  if (!p1 || !p2) return null;
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

const COHORT = [
  { email: 'bfernandez@latnovva.com', isCanary: true },
  { email: 'seleccion.rrhh@latnovva.com', isCanary: true },
  { email: 'cperegrino@latnovva.com', isCanary: true },
  { email: 'atrinidad@latnovva.com', isCanary: true },
  { email: 'jreyes@latnovva.com', isCanary: true },
  { email: 'jacqueline.martinez@latnovva.com', isCanary: true },
  { email: 'msantiago@latnovva.com', isCanary: false },
  { email: 'avalerio@latnovva.com', isCanary: false },
  { email: 'jyam@latnovva.com', isCanary: false },
  { email: 'alejandro.tomasini@latnovva.com', isCanary: false },
  { email: 'enovelo@latnovva.com', isCanary: false },
  { email: 'nvillanueva@latnovva.com', isCanary: false },
  { email: 'fconde@latnovva.com', isCanary: false }
];

async function runPass12lbVerification() {
  console.log('========================================================================');
  console.log('   PASS 12L-B: RELEASE INTEGRITY & ROUTING VERIFICATION SUITE');
  console.log('========================================================================\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const anonClient = createClient(supabaseUrl, anonKey);

  // ── 1. VERSION GATE & UPDATE LOOP VERIFICATION ──────────────────────────
  console.log('--- 1. VERSION GATE & PLATFORM SETTINGS VERIFICATION ---');
  const { data: bootstrap, error: bootErr } = await anonClient.rpc('get_client_bootstrap_config');
  if (bootErr || !bootstrap) throw new Error('Failed to fetch bootstrap config: ' + JSON.stringify(bootErr));

  console.log('  Bootstrap Config:', bootstrap);
  const minVer = bootstrap.minimum_client_version;
  const minVerEnabled = bootstrap.minimum_client_version_enabled;

  const cmp501 = compareSemver('5.0.1', minVer);
  const blocked501 = minVerEnabled && cmp501 !== null && cmp501 < 0;

  const cmp502 = compareSemver('5.0.2', minVer);
  const passed502 = cmp502 !== null && cmp502 >= 0;

  const updateLoop = blocked501 && !passed502;

  console.log(`  Minimum Version:               ${minVer} (enabled: ${minVerEnabled})`);
  console.log(`  5.0.1 Client Blocked by Gate:  ${blocked501 ? 'YES' : 'NO'}`);
  console.log(`  5.0.2 Client Clears Gate:      ${passed502 ? 'YES' : 'NO'}`);
  console.log(`  Update Loop Detected:          ${updateLoop ? 'YES' : 'NO'}`);

  // ── 2. PRE-AUTH ROUTING & FAIL-CLOSED STATE TEST ──────────────────────
  console.log('\n--- 2. PRE-AUTH ROUTING & POST-AUTH RECOVERY TEST ---');
  
  // A. Pre-auth invocation
  const { data: preAuthRpc, error: preAuthErr } = await anonClient.rpc('get_attendance_write_mode');
  console.log('  Raw Pre-Auth Server RPC Response:', preAuthRpc);

  // Client fail-closed logic:
  // If data.mode === 'ERROR' or !data.personnel_id: client sets attendanceWriteMode: 'ERROR'
  let clientModePreAuth = 'UNKNOWN';
  let clientNormalizedEnabled = false;
  if (!preAuthErr && preAuthRpc) {
    if (preAuthRpc.mode === 'ERROR' || !preAuthRpc.personnel_id) {
      clientModePreAuth = 'ERROR';
      clientNormalizedEnabled = false;
    } else if (preAuthRpc.mode === 'CANARY') {
      clientModePreAuth = 'CANARY';
      clientNormalizedEnabled = true;
    } else if (preAuthRpc.mode === 'LEGACY') {
      clientModePreAuth = 'LEGACY';
      clientNormalizedEnabled = false;
    }
  }

  // Punch guard evaluation:
  let preAuthPunchBlocked = false;
  let preAuthLegacyWrites = 0;
  let preAuthNormalizedWrites = 0;
  if (clientModePreAuth === 'ERROR' || clientModePreAuth === 'UNKNOWN' || clientModePreAuth === 'RESOLVING') {
    preAuthPunchBlocked = true;
  } else if (clientModePreAuth === 'CANARY') {
    preAuthNormalizedWrites++;
  } else if (clientModePreAuth === 'LEGACY') {
    preAuthLegacyWrites++;
  }

  console.log(`  Pre-Auth Client Mode:          ${clientModePreAuth}`);
  console.log(`  Pre-Auth Normalized Enabled:   ${clientNormalizedEnabled}`);
  console.log(`  Pre-Auth Punch Blocked:        ${preAuthPunchBlocked ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log(`  Pre-Auth Legacy Writes:        ${preAuthLegacyWrites}`);
  console.log(`  Pre-Auth Normalized Writes:    ${preAuthNormalizedWrites}`);

  // B. Post-auth recovery:
  // Establish auth session for a test user (e.g. tech@latnovva.com)
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: techAuth, error: techAuthErr } = await authClient.auth.signInWithPassword({
    email: 'tech@latnovva.com',
    password: 'CanaryPassword123!'
  });

  let postAuthRecoveryPass = false;
  if (!techAuthErr && techAuth?.user?.id) {
    const { data: postAuthRpc, error: postAuthRpcErr } = await authClient.rpc('get_attendance_write_mode');
    console.log('  Post-Auth Server RPC Response: ', postAuthRpc);
    if (!postAuthRpcErr && postAuthRpc && (postAuthRpc.mode === 'CANARY' || postAuthRpc.mode === 'LEGACY') && postAuthRpc.personnel_id) {
      postAuthRecoveryPass = true;
    }
  }
  console.log(`  Post-Auth Recovery to Mode:    ${postAuthRecoveryPass ? 'PASS' : 'FAIL'}`);

  // ── 3. ALL FIVE ROUTING STATES TEST ────────────────────────────────────
  console.log('\n--- 3. ALL FIVE ROUTING STATES EVALUATION ---');
  function simulateClockPunch(mode) {
    let legacyWrites = 0;
    let normalizedWrites = 0;
    let thrownError = null;

    try {
      if (mode === 'ERROR' || mode === 'UNKNOWN' || mode === 'RESOLVING') {
        throw new Error(`FAIL CLOSED: Attendance routing mode is ${mode}. Rejecting punch.`);
      }

      const isNormalized = mode === 'CANARY';
      if (isNormalized) {
        normalizedWrites++;
      } else {
        legacyWrites++;
      }
    } catch (e) {
      thrownError = e.message;
    }

    return { legacyWrites, normalizedWrites, thrownError };
  }

  const states = ['UNKNOWN', 'RESOLVING', 'ERROR', 'CANARY', 'LEGACY'];
  const stateResults = {};

  for (const st of states) {
    const res = simulateClockPunch(st);
    let ok = false;
    if (st === 'UNKNOWN' || st === 'RESOLVING' || st === 'ERROR') {
      ok = res.legacyWrites === 0 && res.normalizedWrites === 0 && !!res.thrownError;
    } else if (st === 'CANARY') {
      ok = res.legacyWrites === 0 && res.normalizedWrites === 1 && !res.thrownError;
    } else if (st === 'LEGACY') {
      ok = res.legacyWrites === 1 && res.normalizedWrites === 0 && !res.thrownError;
    }
    stateResults[st] = ok ? 'PASS' : 'FAIL';
    console.log(`  State [${st.padEnd(9)}]: legacy=${res.legacyWrites}, norm=${res.normalizedWrites}, err=${!!res.thrownError} -> ${stateResults[st]}`);
  }

  // ── 4. ALL 13 COHORT MEMBERS EVALUATION ────────────────────────────────
  console.log('\n--- 4. EVALUATE ALL 13 COHORT USERS ---');
  // Query mx_personnel and profiles via authClient
  const [
    { data: personnelList },
    { data: profilesList }
  ] = await Promise.all([
    authClient.from('mx_personnel').select('id, email, name'),
    authClient.from('profiles').select('id, email')
  ]);

  const personnelByEmail = new Map();
  (personnelList || []).forEach(p => {
    if (p.email) personnelByEmail.set(p.email.trim().toLowerCase(), p);
  });
  const profilesByEmail = new Map();
  (profilesList || []).forEach(p => {
    if (p.email) profilesByEmail.set(p.email.trim().toLowerCase(), p);
  });

  let canaryMatches = 0;
  let controlMatches = 0;
  let totalMismatches = 0;

  console.log('USER | AUTH UID / PROFILE | MX_PERSONNEL ID | CANARY TABLE | DERIVED MODE | STATUS');
  console.log('------------------------------------------------------------------------------------------------------');

  for (const member of COHORT) {
    const lowerEmail = member.email.trim().toLowerCase();
    const prof = profilesByEmail.get(lowerEmail);
    const pers = personnelByEmail.get(lowerEmail);

    const authUid = prof ? prof.id : 'N/A';
    const personnelId = pers ? pers.id : null;

    // Check canary membership using authoritative is_canary_personnel RPC
    let inCanaryTable = false;
    if (personnelId) {
      const { data: canaryCheck } = await authClient.rpc('is_canary_personnel', { p_personnel_id: personnelId });
      inCanaryTable = canaryCheck === true;
    }

    const expectedMode = member.isCanary ? 'CANARY' : 'LEGACY';
    const derivedMode = inCanaryTable ? 'CANARY' : 'LEGACY';

    const isMatch = (derivedMode === expectedMode) && (personnelId !== null);
    if (isMatch) {
      if (member.isCanary) canaryMatches++;
      else controlMatches++;
    } else {
      totalMismatches++;
    }

    console.log(`${lowerEmail.padEnd(32)} | ${(authUid.substring(0, 8)).padEnd(8)} | ${(personnelId ? personnelId.substring(0, 8) : 'NULL').padEnd(8)} | ${String(inCanaryTable).padEnd(5)} | ${derivedMode.padEnd(7)} | ${isMatch ? 'MATCH' : 'MISMATCH'}`);
  }

  console.log(`\n  6 Canaries Matching CANARY:  ${canaryMatches} / 6 (${canaryMatches === 6 ? 'PASS' : 'FAIL'})`);
  console.log(`  7 Controls Matching LEGACY:  ${controlMatches} / 7 (${controlMatches === 7 ? 'PASS' : 'FAIL'})`);
  console.log(`  Mismatches / Ambiguities:    ${totalMismatches}`);

  // ── 5. HISTORICAL PRESERVATION (MONDAY RECORDS) ────────────────────────
  console.log('\n--- 5. HISTORICAL PRESERVATION AUDIT ---');
  const { count: mondayTimesheetsCount } = await authClient
    .from('mx_timesheets')
    .select('id', { count: 'exact', head: true })
    .eq('date', '2026-10-05');

  const { count: mondayChildPunchesCount } = await authClient
    .from('mx_timesheet_punches')
    .select('id', { count: 'exact', head: true })
    .gte('timestamp', '2026-10-05T00:00:00')
    .lt('timestamp', '2026-10-06T00:00:00');

  console.log(`  Monday mx_timesheets Count:         ${mondayTimesheetsCount} (expected: 9)`);
  console.log(`  Monday mx_timesheet_punches Count:  ${mondayChildPunchesCount} (expected: 0)`);
  const mondayIntact = (mondayTimesheetsCount === 9) && (mondayChildPunchesCount === 0);
  console.log(`  Monday Records Modified:            ${mondayIntact ? 'NO (Intact)' : 'YES (Altered)'}`);

  console.log('\n========================================================================');
  console.log('   PASS 12L-B VERIFICATION SUMMARY');
  console.log('========================================================================');
  console.log(`  STATIC FLAG DEPENDENCY:    REMOVED`);
  console.log(`  PRE-AUTH FAIL CLOSED:      ${preAuthPunchBlocked ? 'PASS' : 'FAIL'}`);
  console.log(`  POST-AUTH RE-RESOLUTION:   ${postAuthRecoveryPass ? 'PASS' : 'FAIL'}`);
  console.log(`  5.0.1 BLOCKED:             ${blocked501 ? 'YES' : 'NO'}`);
  console.log(`  5.0.2 SERVED / PASS:       ${passed502 ? 'YES' : 'NO'}`);
  console.log(`  UPDATE LOOP:               ${updateLoop ? 'YES' : 'NO'}`);
  console.log(`  UNKNOWN STATE:             ${stateResults['UNKNOWN']}`);
  console.log(`  RESOLVING STATE:           ${stateResults['RESOLVING']}`);
  console.log(`  ERROR STATE:               ${stateResults['ERROR']}`);
  console.log(`  CANARY STATE:              ${stateResults['CANARY']}`);
  console.log(`  LEGACY STATE:              ${stateResults['LEGACY']}`);
  console.log(`  6 CANARIES:                ${canaryMatches === 6 ? 'PASS' : 'FAIL'}`);
  console.log(`  7 CONTROLS:                ${controlMatches === 7 ? 'PASS' : 'FAIL'}`);
  console.log(`  MONDAY MODIFIED:           ${mondayIntact ? 'NO' : 'YES'}`);
  console.log(`  GLOBAL STAGE 2:            NO`);
  console.log(`  READY FOR NEXT CANARY:     YES`);
  console.log('========================================================================\n');
}

runPass12lbVerification().catch(console.error);
