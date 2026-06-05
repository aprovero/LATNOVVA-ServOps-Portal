const { createClient } = require('@supabase/supabase-js');

const url = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const key = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W';

const supabase = createClient(url, key, { 
    auth: { autoRefreshToken: false, persistSession: false } 
});

async function main() {
    console.log('[Info] Fetching Mexico City / Merida projects...');
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .or('code_name.ilike.%MID%,code_name.ilike.%CDMX%,name.ilike.%Office%');
    
    if (error) {
        console.error(error);
        return;
    }
    
    for (const p of data) {
        console.log(`\nID: ${p.id}`);
        console.log(`Name: "${p.name}"`);
        console.log(`Code Name: "${p.code_name}"`);
        console.log(`Subsidiary: ${p.subsidiary}`);
    }
}

main().catch(console.error);
