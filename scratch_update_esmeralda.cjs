const { createClient } = require('@supabase/supabase-js');

const url = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const key = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W';

const supabase = createClient(url, key, { 
    auth: { autoRefreshToken: false, persistSession: false } 
});

async function main() {
    console.log('[Info] Searching for project MID...');
    const { data: byCodeName, error: err1 } = await supabase.from('projects').select('*').eq('code_name', 'EST-LNV-000 MID');
    console.log('Search by code_name (EST-LNV-000 MID):', byCodeName, err1);
    
    const { data: byName, error: err2 } = await supabase.from('projects').select('*').ilike('name', '%MID%');
    console.log('Search by name containing MID:', byName, err2);
}

main().catch(console.error);
