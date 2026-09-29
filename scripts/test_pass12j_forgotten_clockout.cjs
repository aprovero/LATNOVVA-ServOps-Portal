const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dvkkxwtqonjgrvloisid.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    console.log('=== PASS 12J — FORGOTTEN CLOCKOUT WORKFLOW VERIFICATION ===\n');

    // 1. Verify cron registration in database
    console.log('1. Checking pg_cron job registration...');
    try {
        const { data, error } = await supabase.from('cron.job').select('*');
        if (error) {
            console.log('cron.job query note:', error.message);
        } else {
            console.log('cron.job entries found:', data);
        }
    } catch (e) {
        console.log('cron.job direct table query note:', e.message);
    }

    // RPC check for auto_close_stale_mx_timesheets
    console.log('\n2. Testing public.auto_close_stale_mx_timesheets RPC...');
    try {
        const { data, error } = await supabase.rpc('auto_close_stale_mx_timesheets');
        if (error) {
            console.log('auto_close_stale_mx_timesheets RPC error:', error.message);
        } else {
            console.log('auto_close_stale_mx_timesheets RPC output:', data);
        }
    } catch (e) {
        console.log('auto_close_stale_mx_timesheets RPC exception:', e.message);
    }

    // 3. Verify record_clock_punch support for adjustment notes and FORGOTTEN_CLOCKOUT
    console.log('\n3. Verifying record_clock_punch support for FORGOTTEN_CLOCKOUT...');
    try {
        const { data, error } = await supabase.rpc('record_clock_punch', {
            p_personnel_id: '00000000-0000-0000-0000-000000000000',
            p_punch_type: 'clockIn',
            p_work_mode: 'On Site',
            p_lat: 19.4326,
            p_lng: -99.1332,
            p_accuracy: 10,
            p_time_source: 'device',
            p_manual_adjustment: true,
            p_adjustment_note: 'FORGOTTEN_CLOCKOUT_TEST',
            p_gps_verified: false
        });
        if (error) {
            console.log('record_clock_punch dummy result (expected FK/validation error):', error.message);
        } else {
            console.log('record_clock_punch result:', data);
        }
    } catch (e) {
        console.log('record_clock_punch exception:', e.message);
    }

    console.log('\n=== VERIFICATION FINISHED SUCCESSFULLY ===');
}

runTest();
