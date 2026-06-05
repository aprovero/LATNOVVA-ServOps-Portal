const { createClient } = require('@supabase/supabase-js');

const url = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const key = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W';

const supabase = createClient(url, key, { 
    auth: { autoRefreshToken: false, persistSession: false } 
});

async function main() {
    console.log('[Info] Fetching some mx_personnel entries...');
    const { data, error } = await supabase.from('mx_personnel').select('*').limit(5);
    if (error) {
        console.error(error);
        return;
    }
    for (const row of data) {
        console.log(`\nName: ${row.name}`);
        console.log(`Employee Number: ${row.employee_number}`);
        console.log(`subsidiary_metadata:`, row.subsidiary_metadata);
    }
}

main().catch(console.error);
