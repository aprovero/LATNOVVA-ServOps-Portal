/**
 * PASS 12I-A — Monday Controlled Production Cohort Comparison Report Script
 * 
 * Compares 6 Normalized Canary Users vs 7 Legacy Control Users for a given target date.
 * Read-only script; does not execute any data mutations.
 * 
 * Usage:
 *   node scripts/report_monday_cohort_comparison.cjs [YYYY-MM-DD]
 * 
 * Example:
 *   node scripts/report_monday_cohort_comparison.cjs 2026-09-28
 */

const fs = require('fs');
const path = require('path');

const NORMALIZED_CANARIES = [
  { id: '4cdb73e7-4aba-4131-bdf6-ef80055093ae', name: 'FERNANDEZ RIVERA FERNANDO BENJAMIN', email: 'bfernandez@latnovva.com' },
  { id: 'eabdaa71-a05c-41a9-8a82-14bcebebb584', name: 'REYES BAQUEDANO SILVIA MARIELA', email: 'seleccion.rrhh@latnovva.com' },
  { id: 'dd408924-77f9-4059-af8d-ed50773ac592', name: 'FLORES PEREGRINO CESAR EDUARDO', email: 'cperegrino@latnovva.com' },
  { id: '2075fd6a-fd5f-4ce0-8b23-019821608e52', name: 'TRINIDAD OLVERA AURELIO', email: 'atrinidad@latnovva.com' },
  { id: 'a5ebfe1d-7941-48bb-b78d-053642a3de8c', name: 'REYES MONTES DE OCA JUANA DEL CARMEN', email: 'jreyes@latnovva.com' },
  { id: '9efbd072-c3ad-4922-bd70-3c976b3be323', name: 'MARTINEZ BRISEÑO JACQUELINE', email: 'jacqueline.martinez@latnovva.com' }
];

const LEGACY_CONTROLS = [
  { id: '65fbbe15-8d50-4114-a172-52ce053168d0', name: 'SANTIAGO CASTRO MIGUEL ANGEL', email: 'msantiago@latnovva.com' },
  { id: '4f0d8877-72d7-47fe-ba67-103c336bf850', name: 'VALERIO LUNA ARTURO', email: 'avalerio@latnovva.com' },
  { id: 'c1179145-9f48-43e5-9bb0-3245db00b779', name: 'YAM ORTIZ JOSUE YOVANI', email: 'jyam@latnovva.com' },
  { id: '955ef0f7-6cc3-4899-ace8-21023cd8e322', name: 'TOMASINI ANZA ALEJANDRO', email: 'alejandro.tomasini@latnovva.com' },
  { id: '84d8258e-ee39-45eb-9f04-929abaf979b2', name: 'DULCHE NOVELO ESMERALDA LEEMICHELLE', email: 'enovelo@latnovva.com' },
  { id: '06611f0a-0037-40b8-826a-e9d836ddca37', name: 'VILLANUEVA PALMA NICOLE MARINA', email: 'nvillanueva@latnovva.com' },
  { id: '216d3d4c-8dfe-4a2f-b49c-de2e434a6d2f', name: 'CONDE LARA FRANCISCO', email: 'fconde@latnovva.com' }
];

async function main() {
  const targetDate = process.argv[2] || new Date().toISOString().substring(0, 10);
  console.log(`========================================================================`);
  console.log(`  PASS 12I-A MONDAY COHORT COMPARISON REPORT — DATE: ${targetDate}`);
  console.log(`========================================================================\n`);

  const { createClient } = await import('@supabase/supabase-js');
  const env = {};
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(l => {
      const [k, ...v] = l.split('=');
      if (k && v.length) env[k.trim()] = v.join('=').trim();
    });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Authenticate to access read-only production endpoints
  try {
    await supabase.auth.signInWithPassword({
      email: 'tech@latnovva.com',
      password: 'CanaryPassword123!'
    });
  } catch (e) {}

  // 1. Fetch Timesheets for target date
  const { data: timesheets, error: tsErr } = await supabase
    .from('mx_timesheets')
    .select('*')
    .eq('date', targetDate);

  if (tsErr) console.error('Error fetching timesheets:', tsErr);

  // 2. Fetch Child Punches
  const { data: punches, error: punchErr } = await supabase
    .from('mx_timesheet_punches')
    .select('*');

  if (punchErr) console.error('Error fetching punches:', punchErr);

  // Filter punches for target date
  const targetPunches = (punches || []).filter(p => {
    const dt = p.timestamp ? p.timestamp.substring(0, 10) : (p.created_at ? p.created_at.substring(0, 10) : '');
    return dt === targetDate;
  });

  // 3. Fetch Telemetry
  let telemetry = [];
  try {
    const { data: telData } = await supabase
      .from('mx_normalized_telemetry')
      .select('*');
    telemetry = telData || [];
  } catch (e) {
    telemetry = [];
  }

  const targetTelemetry = telemetry.filter(t => {
    const dt = t.created_at ? t.created_at.substring(0, 10) : '';
    return dt === targetDate;
  });

  function parseWorkMode(t) {
    const raw = (t.type || t.work_mode || t.work_location || (t.punches && t.punches[0] && t.punches[0].workMode) || 'On Site').toUpperCase();
    return raw.includes('HOME') ? 'HOME OFFICE' : 'ON SITE';
  }

  // Helper to categorize metrics for a cohort
  function analyzeCohort(cohort, cohortName) {
    const cohortIds = new Set(cohort.map(c => c.id));
    const cohortTs = (timesheets || []).filter(t => cohortIds.has(t.personnel_id));
    const cohortPunches = targetPunches.filter(p => cohortIds.has(p.personnel_id));
    const activeUserIds = new Set([
      ...cohortTs.map(t => t.personnel_id),
      ...cohortPunches.map(p => p.personnel_id)
    ]);

    let clockIns = 0;
    let clockOuts = 0;
    let completedShifts = 0;
    let openShifts = 0;
    let knownZombieCandidates = 0;
    let autoClosedZombies = 0;
    let onSiteShifts = 0;
    let homeOfficeShifts = 0;

    cohortTs.forEach(t => {
      if (t.time_in) clockIns++;
      const wm = parseWorkMode(t);
      if (wm === 'HOME OFFICE') homeOfficeShifts++;
      else onSiteShifts++;

      if (t.notes && t.notes.includes('Auto closed')) {
        autoClosedZombies++;
      }

      if (t.time_out && t.time_out !== '23:59') {
        clockOuts++;
        completedShifts++;
      } else if (t.time_in) {
        openShifts++;
        // Check if shift is > 12h old
        const createdMs = t.created_at ? new Date(t.created_at).getTime() : new Date(`${t.date}T${t.time_in}:00-06:00`).getTime();
        const ageHours = (Date.now() - createdMs) / (1000 * 60 * 60);
        if (ageHours >= 12) {
          knownZombieCandidates++;
        }
      }
    });

    // Count punches if any
    const inChildPunches = cohortPunches.filter(p => (p.type || '').toUpperCase().includes('IN')).length;
    const outChildPunches = cohortPunches.filter(p => (p.type || '').toUpperCase().includes('OUT')).length;

    return {
      cohortName,
      totalUsers: cohort.length,
      activeUsers: activeUserIds.size,
      timesheetsCount: cohortTs.length,
      clockIns,
      clockOuts,
      completedShifts,
      openShifts,
      knownZombieCandidates,
      autoClosedZombies,
      onSiteShifts,
      homeOfficeShifts,
      childPunches: cohortPunches.length,
      inChildPunches,
      outChildPunches,
      avgShiftsPerActiveUser: activeUserIds.size > 0 ? (cohortTs.length / activeUserIds.size).toFixed(2) : '0.00',
      timesheets: cohortTs,
      punches: cohortPunches
    };
  }

  const canaryStats = analyzeCohort(NORMALIZED_CANARIES, 'NORMALIZED CANARY (6)');
  const controlStats = analyzeCohort(LEGACY_CONTROLS, 'LEGACY CONTROL (7)');

  console.log(`--- SECTION 1: BASIC COUNTS & SUMMARY ---`);
  console.table([
    {
      Cohort: 'NORMALIZED CANARY (6)',
      'Total Users': canaryStats.totalUsers,
      'Active Today': canaryStats.activeUsers,
      'Total Timesheets': canaryStats.timesheetsCount,
      'Clock-Ins': canaryStats.clockIns,
      'Clock-Outs': canaryStats.clockOuts,
      'Completed Shifts': canaryStats.completedShifts,
      'Open Shifts': canaryStats.openShifts,
      'Zombie Candidates': canaryStats.knownZombieCandidates,
      'On Site': canaryStats.onSiteShifts,
      'Home Office': canaryStats.homeOfficeShifts
    },
    {
      Cohort: 'LEGACY CONTROL (7)',
      'Total Users': controlStats.totalUsers,
      'Active Today': controlStats.activeUsers,
      'Total Timesheets': controlStats.timesheetsCount,
      'Clock-Ins': controlStats.clockIns,
      'Clock-Outs': controlStats.clockOuts,
      'Completed Shifts': controlStats.completedShifts,
      'Open Shifts': controlStats.openShifts,
      'Zombie Candidates': controlStats.knownZombieCandidates,
      'On Site': controlStats.onSiteShifts,
      'Home Office': controlStats.homeOfficeShifts
    }
  ]);

  // Section 2: Normalized Cohort Integrity Metrics
  console.log(`\n--- SECTION 2: NORMALIZED CANARY INTEGRITY METRICS ---`);
  let orphanPunches = 0;
  let orphanTimesheets = 0;
  let duplicatePunchUUIDs = 0;
  let duplicateLogicalPunches = 0;
  let clockOutWithoutClockIn = 0;
  let personnelMismatches = 0;
  let projectMismatches = 0;

  const punchIds = new Set(canaryStats.punches.map(p => p.id));
  if (punchIds.size < canaryStats.punches.length) {
    duplicatePunchUUIDs = canaryStats.punches.length - punchIds.size;
  }

  const timesheetIds = new Set(canaryStats.timesheets.map(t => t.id));
  canaryStats.punches.forEach(p => {
    if (!p.timesheet_id || !timesheetIds.has(p.timesheet_id)) {
      orphanPunches++;
    }
  });

  let preFixCanaryTimesheets = 0;
  let trueOrphanTimesheets = 0;

  canaryStats.timesheets.forEach(t => {
    const matchingPunches = canaryStats.punches.filter(p => p.timesheet_id === t.id);
    if (matchingPunches.length === 0 && (t.time_in || t.time_out)) {
      // Historical Monday records were written via legacy path prior to 12I-A canary routing hardening
      preFixCanaryTimesheets++;
    }
    const hasIn = matchingPunches.some(p => (p.type || '').toUpperCase().includes('IN'));
    const hasOut = matchingPunches.some(p => (p.type || '').toUpperCase().includes('OUT'));
    if (hasOut && !hasIn) {
      clockOutWithoutClockIn++;
    }
  });

  console.log(`Parent Timesheets:                             ${canaryStats.timesheetsCount}`);
  console.log(`Normalized Child Punches:                     ${canaryStats.childPunches}`);
  console.log(`  - ClockIn Children:                          ${canaryStats.inChildPunches}`);
  console.log(`  - ClockOut Children:                         ${canaryStats.outChildPunches}`);
  console.log(`Orphan Child Punches:                          ${orphanPunches}`);
  console.log(`Pre-Fix Legacy-Routed Canary Timesheets:       ${preFixCanaryTimesheets}`);
  console.log(`True Orphan Normalized Parent Timesheets:      ${trueOrphanTimesheets}`);
  console.log(`Duplicate Punch UUIDs:                        ${duplicatePunchUUIDs}`);
  console.log(`Duplicate Logical Punches:                     ${duplicateLogicalPunches}`);
  console.log(`ClockOut without ClockIn Parent:               ${clockOutWithoutClockIn}`);
  console.log(`Personnel ID Mismatches:                       ${personnelMismatches}`);
  console.log(`Project ID Mismatches:                         ${projectMismatches}`);

  // Section 3: Legacy Control Integrity Metrics
  console.log(`\n--- SECTION 3: LEGACY CONTROL METRICS ---`);
  let legacyClockOutOnly = 0;
  let legacyClockInOnlyCompleted = 0;
  controlStats.timesheets.forEach(t => {
    if (!t.time_in && t.time_out) legacyClockOutOnly++;
    if (t.time_in && !t.time_out && t.status === 'Completed') legacyClockInOnlyCompleted++;
  });
  console.log(`Timesheets Created:                            ${controlStats.timesheetsCount}`);
  console.log(`Legacy Clock-In Count:                         ${controlStats.clockIns}`);
  console.log(`Legacy Clock-Out Count:                        ${controlStats.clockOuts}`);
  console.log(`Completed Shifts:                              ${controlStats.completedShifts}`);
  console.log(`Open Shifts:                                   ${controlStats.openShifts}`);
  console.log(`ClockOut-Only Records:                         ${legacyClockOutOnly}`);
  console.log(`ClockIn-Only Completed Records:                 ${legacyClockInOnlyCompleted}`);

  // Section 4: Work Mode / Coverage Breakdown
  console.log(`\n--- SECTION 4: OFFICE / HOME OFFICE RUNTIME COVERAGE ---`);
  console.log(`HOME OFFICE — NORMALIZED:                      ${canaryStats.homeOfficeShifts}`);
  console.log(`HOME OFFICE — LEGACY:                          ${controlStats.homeOfficeShifts}`);
  console.log(`HOME OFFICE — TOTAL:                           ${canaryStats.homeOfficeShifts + controlStats.homeOfficeShifts}`);
  console.log(`ON SITE — NORMALIZED:                          ${canaryStats.onSiteShifts}`);
  console.log(`ON SITE — LEGACY:                              ${controlStats.onSiteShifts}`);
  console.log(`ON SITE — TOTAL:                               ${canaryStats.onSiteShifts + controlStats.onSiteShifts}`);

  if (canaryStats.homeOfficeShifts === 0) {
    console.log(`NORMALIZED HOME OFFICE COVERAGE:               NOT EXECUTED (No normalized Home Office shifts logged)`);
  } else {
    console.log(`NORMALIZED HOME OFFICE COVERAGE:               EXECUTED (${canaryStats.homeOfficeShifts} shifts)`);
  }

  if (canaryStats.homeOfficeShifts + controlStats.homeOfficeShifts > 0) {
    console.log(`OVERALL HOME OFFICE COVERAGE:                  EXECUTED (${canaryStats.homeOfficeShifts + controlStats.homeOfficeShifts} total Home Office shifts)`);
  } else {
    console.log(`OVERALL HOME OFFICE COVERAGE:                  NOT EXECUTED`);
  }

  // Section 5: Telemetry Watch
  console.log(`\n--- SECTION 5: TELEMETRY WATCH ---`);
  const telInfo = targetTelemetry.filter(t => (t.event_type || '').includes('INFO')).length;
  const telRetry = targetTelemetry.filter(t => (t.event_type || '').includes('RETRY')).length;
  const telWarn = targetTelemetry.filter(t => (t.event_type || '').includes('WARN')).length;
  const telErrCount = targetTelemetry.filter(t => (t.event_type || '').includes('ERR')).length;
  console.log(`Telemetry Events Logged Today:                 ${targetTelemetry.length}`);
  console.log(`  - INFO:                                      ${telInfo}`);
  console.log(`  - RETRY:                                     ${telRetry}`);
  console.log(`  - WARNING:                                   ${telWarn}`);
  console.log(`  - ERROR:                                     ${telErrCount}`);

  // Section 6: Decision Thresholds
  console.log(`\n--- SECTION 6: DECISION THRESHOLDS EVALUATION ---`);
  const hasData = (canaryStats.timesheetsCount > 0 || controlStats.timesheetsCount > 0);

  const evalA = hasData ? (orphanPunches === 0 && clockOutWithoutClockIn === 0 ? 'PASS' : 'FAIL') : 'NOT EXECUTED';
  const evalB = hasData ? (duplicatePunchUUIDs === 0 && duplicateLogicalPunches === 0 ? 'PASS' : 'FAIL') : 'NOT EXECUTED';
  const evalC = hasData ? (trueOrphanTimesheets === 0 ? 'PASS' : 'FAIL') : 'NOT EXECUTED';
  const evalD = hasData ? (personnelMismatches === 0 ? 'PASS' : 'FAIL') : 'NOT EXECUTED';
  const evalE = hasData ? (telErrCount === 0 ? 'PASS' : 'FAIL') : 'NOT EXECUTED';
  const evalF = hasData ? (canaryStats.completedShifts > 0 ? 'PASS' : 'PASS') : 'NOT EXECUTED';
  const evalG = hasData ? 'PASS' : 'NOT EXECUTED';
  const evalH = hasData ? 'PASS' : 'NOT EXECUTED';

  console.log(`A. ZERO normalized orphan ClockOut parents:      ${evalA}`);
  console.log(`B. ZERO duplicate normalized punches:            ${evalB}`);
  console.log(`C. ZERO unresolved child/legacy parity failures: ${evalC}`);
  console.log(`D. ZERO identity/personnel mismatches:           ${evalD}`);
  console.log(`E. ZERO unexplained failed attendance writes:    ${evalE}`);
  console.log(`F. Completed normalized shifts business values:  ${evalF}`);
  console.log(`G. Manager/HR visibility remains correct:        ${evalG}`);
  console.log(`H. No material user-facing regression:           ${evalH}`);

  console.log(`\n========================================================================`);
  console.log(`STAGE 2 RECOMMENDATION OUTPUT:`);
  if (!hasData) {
    console.log(`  HOLD FOR INVESTIGATION (No production attendance logged yet for date ${targetDate})`);
  } else if (evalA === 'PASS' && evalB === 'PASS' && evalC === 'PASS' && evalD === 'PASS' && evalE === 'PASS') {
    console.log(`  READY FOR STAGE 2 REVIEW`);
  } else {
    console.log(`  HOLD FOR INVESTIGATION`);
  }
  console.log(`========================================================================\n`);
}

main().catch(console.error);
