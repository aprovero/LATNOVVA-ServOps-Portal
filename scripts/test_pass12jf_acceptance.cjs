const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dvkkxwtqonjgrvloisid.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAcceptanceTest() {
    console.log('==================================================');
    console.log('PASS 12J-F FORGOTTEN CLOCKOUT ACCEPTANCE VERIFICATION');
    console.log('==================================================\n');

    let passed = true;

    // Authenticate as test tech user
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'tech@latnovva.com',
        password: 'CanaryPassword123!'
    });

    if (authErr) {
        console.error('Authentication error:', authErr);
        process.exit(1);
    }
    console.log(`Authenticated as: ${authData.user.email}`);

    // Get personnel record for tech user
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
    const testPersonnelId = profile ? profile.id : authData.user.id;

    console.log('--- 1. Machine-Readable DB Persistence Check ---');
    const testTimesheetId = 'ts_test_' + Date.now();
    const testDate = '2026-09-29';
    const clockInTime = new Date('2026-09-29T08:00:00Z').toISOString();
    const clockOutTime = new Date('2026-09-29T18:30:00Z').toISOString(); // 10.5h elapsed

    console.log(`Test Personnel ID: ${testPersonnelId}`);
    console.log(`Simulating ClockIn at ${clockInTime}...`);
    
    // Step A: Clock In
    const clockInPunchId = 'a' + Date.now().toString(16).padStart(31, '0').slice(0, 35);
    const resIn = await supabase.rpc('record_clock_punch', {
        p_punch_id: clockInPunchId,
        p_timestamp: clockInTime,
        p_type: 'clockIn',
        p_date: testDate,
        p_target_personnel_id: testPersonnelId,
        p_timesheet_id: testTimesheetId,
        p_work_mode: 'On Site',
        p_lat: 19.4326,
        p_lng: -99.1332,
        p_accuracy: 10,
        p_gps_verified: true
    });

    if (resIn.error) {
        console.error('ClockIn RPC error:', resIn.error);
        passed = false;
    } else {
        console.log('ClockIn succeeded:', resIn.data);
    }

    // Step B: Clock Out with FORGOTTEN_CLOCKOUT
    console.log(`Simulating Forgotten ClockOut at ${clockOutTime} (10.5 hours elapsed)...`);
    const clockOutPunchId = 'b' + Date.now().toString(16).padStart(31, '0').slice(0, 35);
    const resOut = await supabase.rpc('record_clock_punch', {
        p_punch_id: clockOutPunchId,
        p_timestamp: clockOutTime,
        p_type: 'clockOut',
        p_date: testDate,
        p_target_personnel_id: testPersonnelId,
        p_timesheet_id: testTimesheetId,
        p_work_mode: 'On Site',
        p_lat: 19.4500,
        p_lng: -99.1500,
        p_accuracy: 50,
        p_manual_adjustment: true,
        p_adjustment_reason: 'FORGOTTEN_CLOCKOUT',
        p_adjustment_note: 'Olvidé registrar mi salida — salida aproximada 18:00',
        p_gps_verified: false
    });

    if (resOut.error) {
        console.error('ClockOut RPC error:', resOut.error);
        passed = false;
    } else {
        console.log('ClockOut FORGOTTEN_CLOCKOUT succeeded:', resOut.data);
    }

    // Step C: Verify DB persistence in mx_timesheet_punches
    console.log('\n--- 2. Verifying mx_timesheet_punches Table State ---');
    const { data: punches, error: punchErr } = await supabase
        .from('mx_timesheet_punches')
        .select('*')
        .eq('timesheet_id', testTimesheetId);

    if (punchErr || !punches) {
        console.error('Error fetching punches:', punchErr);
        passed = false;
    } else {
        console.log(`Fetched ${punches.length} child punches:`);
        punches.forEach(p => {
            console.log(`  - Punch ${p.id} (${p.type}): adjustment_reason='${p.adjustment_reason}', manual_adjustment=${p.manual_adjustment}, gps_verified=${p.gps_verified}`);
        });
        const outPunch = punches.find(p => p.type === 'clockOut');
        if (outPunch && outPunch.adjustment_reason === 'FORGOTTEN_CLOCKOUT') {
            console.log('✅ PASS: mx_timesheet_punches.adjustment_reason = FORGOTTEN_CLOCKOUT');
        } else {
            console.error('❌ FAIL: mx_timesheet_punches.adjustment_reason mismatch!', outPunch);
            passed = false;
        }
    }

    // Step D: Verify DB persistence in mx_timesheets parent table
    console.log('\n--- 3. Verifying mx_timesheets Parent Table State ---');
    const { data: ts, error: tsErr } = await supabase
        .from('mx_timesheets')
        .select('*')
        .eq('id', testTimesheetId)
        .single();

    if (tsErr || !ts) {
        console.error('Error fetching timesheet:', tsErr);
        passed = false;
    } else {
        console.log(`Timesheet hours: ${ts.hours}`);
        console.log(`Timesheet source: ${ts.source}`);
        console.log(`Timesheet manual_reason: ${ts.manual_reason}`);
        console.log(`Timesheet gps_verified: ${ts.gps_verified}`);
        console.log(`Timesheet punches JSON count: ${ts.punches ? ts.punches.length : 0}`);

        if (Number(ts.hours) === 8.00 && ts.manual_reason === 'FORGOTTEN_CLOCKOUT' && ts.source === 'manual') {
            console.log('✅ PASS: Parent mx_timesheets.hours = 8.00, manual_reason = FORGOTTEN_CLOCKOUT, source = manual');
        } else {
            console.error('❌ FAIL: Parent mx_timesheets values incorrect!', ts);
            passed = false;
        }

        const jsonOutPunch = ts.punches ? ts.punches.find(p => p.type === 'clockOut') : null;
        if (jsonOutPunch && jsonOutPunch.adjustmentReason === 'FORGOTTEN_CLOCKOUT') {
            console.log('✅ PASS: Legacy JSON projection contains adjustmentReason = FORGOTTEN_CLOCKOUT');
        } else {
            console.error('❌ FAIL: Legacy JSON projection missing adjustmentReason!', jsonOutPunch);
            passed = false;
        }
    }

    // Clean up test records
    console.log('\n--- Cleaning up test records ---');
    await supabase.from('mx_timesheet_punches').delete().eq('timesheet_id', testTimesheetId);
    await supabase.from('mx_timesheets').delete().eq('id', testTimesheetId);
    console.log('Test records cleaned up cleanly.');

    console.log('\n==================================================');
    console.log(passed ? '🎉 ALL PASS 12J-F FORENSIC ACCEPTANCE TESTS PASSED!' : '❌ FORENSIC ACCEPTANCE TESTS FAILED');
    console.log('==================================================');
}

runAcceptanceTest();
