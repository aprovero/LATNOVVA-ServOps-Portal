/**
 * purgePersonnel.ts
 * -----------------
 * TOTAL WIPE SCRIPT: Erases all business data and non-admin Auth users.
 * This is the FIRST STEP in resolving a "messy" database state.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const PROTECTED_EMAILS = [
    'aprovero@latnovva.com',
    'fasensio@latnovva.com',
    'jreina@latnovva.com',
    'jmdiaz@latnovva.com'
];

async function purgeAll() {
    console.log('⚠️  STARTING TOTAL PURGE OPERATION');
    console.log(`🔒 Protecting Admins: ${PROTECTED_EMAILS.join(', ')}\n`);

    // 1. Fetch current Auth users to identify who to delete
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    if (authErr) {
        console.error('❌ Failed to list users:', authErr.message);
        return;
    }

    const allUsers = authData.users;
    
    // 2. Clear All Business Data (Respecting Foreign Keys)
    console.log('🧹 Wiping all dependent business data...');
    const tablesToClear = ['timesheets', 'reports', 'tools', 'projects', 'clients'];
    
    for (const table of tablesToClear) {
        const { error } = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000' as any);
        if (error) {
            console.log(`   ℹ️  Note: Skipping ${table} (${error.message})`);
        } else {
            console.log(`   ✅ Cleared table: ${table}`);
        }
    }

    // 3. Purge Personnel Table (EXCEPT PROTECTED)
    console.log('👤 Purging Personnel table (keeping admins)...');
    for (const email of PROTECTED_EMAILS) {
        // Just checking existence
    }
    
    const { error: pErr } = await supabaseAdmin
        .from('personnel')
        .delete()
        .not('email', 'in', `(${PROTECTED_EMAILS.join(',')})`);

    if (pErr) console.error('❌ Error purging personnel table:', pErr.message);
    else console.log('✅ Personnel table cleaned.');

    // 4. Purge Auth Users (EXCEPT PROTECTED)
    console.log('🔐 Purging Supabase Auth users...');
    let deletedAuth = 0;
    for (const user of allUsers) {
        const email = user.email?.toLowerCase();
        if (email && PROTECTED_EMAILS.includes(email)) {
            console.log(`   [KEEP] Administrator: ${email}`);
            continue;
        }

        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (delErr) {
            console.error(`   ❌ Failed to delete ${email || user.id}:`, delErr.message);
        } else {
            console.log(`   [DELETE] User Account: ${email || user.id}`);
            deletedAuth++;
        }
    }

    console.log(`\n🎉 Purge complete! Deleted ${deletedAuth} auth users.`);
    console.log('   The system is now ready for a clean import.');
}

purgeAll().catch(console.error);
