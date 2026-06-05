const { createClient } = require('@supabase/supabase-js');

const url = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const key = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W';

const supabase = createClient(url, key, { 
    auth: { autoRefreshToken: false, persistSession: false } 
});

async function main() {
    console.log('[Info] Switching Esmeralda assignment to EST-LNV-000 MID...');

    const uid = '84d8258e-ee39-45eb-9f04-929abaf979b2';
    const oldProjId = 'fbf941fd-75ee-4770-b668-c3b4afbe0d94'; // CH-LNVEM-090
    const newProjId = 'c95e8081-3323-4c55-87f5-259207865768'; // EST-LNV-000 MID

    // 1. Fetch current subsidiary_metadata from mx_personnel
    const { data: currentMx, error: mxFetchErr } = await supabase
        .from('mx_personnel')
        .select('subsidiary_metadata')
        .eq('id', uid)
        .single();
    
    if (mxFetchErr) {
        console.error('Failed to fetch current mx_personnel:', mxFetchErr);
        return;
    }

    const updatedMetadata = {
        ...(currentMx.subsidiary_metadata || {}),
        projectAssigned: 'EST-LNV-000 MID'
    };

    // 2. Update mx_personnel
    const { data: mxRes, error: mxErr } = await supabase
        .from('mx_personnel')
        .update({ subsidiary_metadata: updatedMetadata })
        .eq('id', uid)
        .select();
    console.log('mx_personnel updated:', mxRes, mxErr);

    // 3. Update personnel
    const { data: pRes, error: pErr } = await supabase
        .from('personnel')
        .update({ subsidiary_metadata: updatedMetadata })
        .eq('id', uid)
        .select();
    console.log('personnel updated:', pRes, pErr);

    // 4. Remove from CH-LNVEM-090
    const { data: oldProj, error: oldProjErr } = await supabase
        .from('projects')
        .select('assigned_personnel')
        .eq('id', oldProjId)
        .single();
    
    if (oldProj) {
        const listWithoutUid = (oldProj.assigned_personnel || []).filter(id => id !== uid);
        await supabase
            .from('projects')
            .update({ assigned_personnel: listWithoutUid })
            .eq('id', oldProjId);
        console.log('Removed from old project assigned_personnel list.');
    }

    // 5. Add to EST-LNV-000 MID
    const { data: newProj, error: newProjErr } = await supabase
        .from('projects')
        .select('assigned_personnel')
        .eq('id', newProjId)
        .single();
    
    if (newProj) {
        const listWithUid = newProj.assigned_personnel || [];
        if (!listWithUid.includes(uid)) {
            listWithUid.push(uid);
        }
        await supabase
            .from('projects')
            .update({ assigned_personnel: listWithUid })
            .eq('id', newProjId);
        console.log('Added to new project assigned_personnel list.');
    }
}

main().catch(console.error);
