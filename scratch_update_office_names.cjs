const { createClient } = require('@supabase/supabase-js');

const url = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const key = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W';

const supabase = createClient(url, key, { 
    auth: { autoRefreshToken: false, persistSession: false } 
});

async function main() {
    console.log('[Info] Updating Mexico City and Merida Office project names...');

    // 1. Update Merida Office
    const { data: meridaRes, error: meridaErr } = await supabase
        .from('projects')
        .update({ name: 'Oficina Mérida' })
        .eq('id', 'c95e8081-3323-4c55-87f5-259207865768')
        .select();
    console.log('Merida update result:', meridaRes, meridaErr);

    // 2. Update Mexico City Office
    const { data: cdmxRes, error: cdmxErr } = await supabase
        .from('projects')
        .update({ name: 'Oficina CDMX' })
        .eq('id', 'a68210e5-d579-4e6f-b2d3-af1a9d3a4911')
        .select();
    console.log('Mexico City update result:', cdmxRes, cdmxErr);
}

main().catch(console.error);
