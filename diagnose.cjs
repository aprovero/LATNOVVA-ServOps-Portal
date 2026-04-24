const { createClient } = require('@supabase/supabase-js');

const url = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const key = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W';

const supabase = createClient(url, key, { 
    auth: { autoRefreshToken: false, persistSession: false } 
});

async function main() {
    console.log('[Diagnostic] Fetching all users...');
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
        console.error('Failed to list users:', error);
        return;
    }

    const { users } = data;
    console.log(`Found ${users.length} users in auth.users.`);
    
    for (const u of users) {
        console.log(`\nEmail: ${u.email}`);
        console.log(`ID: ${u.id}`);
        console.log(`Role: "${u.role}"`);
        console.log(`Audience (aud): "${u.aud}"`);
        console.log(`Has password: ${u.encrypted_password !== null}`);
        console.log(`Identities Count: ${u.identities?.length || 0}`);
        if (!u.identities || u.identities.length === 0) {
            console.log('  ⚠️ WARNING: User has no identities in auth.identities!');
        }
    }
}

main().catch(console.error);
