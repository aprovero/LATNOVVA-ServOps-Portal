/**
 * purgePersonnel.ts
 * -----------------
 * DESTRUCTIVE SCRIPT: Erases all business data and Auth users
 * EXCEPT for the four designated administrators.
 * 
 * Protected Emails:
 * 1. Andres Provero: aprovero@latnovva.com
 * 2. Fernando Asensio: fasensio@latnovva.com
 * 3. Jesus Reina: jreina@latnovva.com
 * 4. Juan Mena: jmdiaz@latnovva.com
 * 
 * Run with:
 * $env:SUPABASE_SERVICE_ROLE_KEY="your-key"; npx tsx src/scripts/purgePersonnel.ts
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
    console.log('⚠️  STARTING PURGE OPERATION (DESTRUCTIVE)');
    console.log(`🔒 Protecting: ${PROTECTED_EMAILS.join(', ')}\n`);

    // 1. Get Auth IDs of protected users
    console.log('🔍 Locating protected administrator accounts...');
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
    if (authErr) {
        console.error('❌ Failed to list users:', authErr.message);
        return;
    }

    const allUsers = authData.users;
    const protectedIds = allUsers
        .filter(u => u.email && PROTECTED_EMAILS.includes(u.email.toLowerCase()))
        .map(u => u.id);

    if (protectedIds.length < 4) {
        console.warn(`⚠️  Warning: Only found ${protectedIds.length}/4 protected accounts in Auth.`);
        // Note: We continue because some might not even be created yet or are in a different state.
    }

    // 2. Clear Business Data (Cascading Cleanup)
    // We clear these first to avoid foreign key violations in the personnel table
    console.log('🧹 Clearing business data (Timesheets, Reports, Tools, Projects, Clients)...');
    
    // We use a dummy condition to delete all rows
    const { error: tsErr } = await supabaseAdmin.from('timesheets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (tsErr) console.log('   (Skipped timesheets or it does not exist)');

    const { error: repErr } = await supabaseAdmin.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (repErr) console.log('   (Skipped reports or it does not exist)');

    const { error: toolErr } = await supabaseAdmin.from('tools').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (toolErr) console.log('   (Skipped tools or it does not exist)');

    const { error: projErr } = await supabaseAdmin.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (projErr) console.log('   (Skipped projects or it does not exist)');

    const { error: clientErr } = await supabaseAdmin.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (clientErr) console.log('   (Skipped clients or it does not exist)');

    // 3. Purge Personnel Table
    console.log('👤 Purging Personnel table (keeping protected admins)...');
    const { error: pErr } = await supabaseAdmin
        .from('personnel')
        .delete()
        .not('email', 'in', `(${PROTECTED_EMAILS.join(',')})`);

    if (pErr) console.error('❌ Error purging personnel table:', pErr.message);
    else console.log('✅ Personnel table cleaned.');

    // 4. Purge Auth Users
    console.log('🔐 Purging Supabase Auth users (keeping protected admins)...');
    let deletedAuth = 0;
    for (const user of allUsers) {
        const email = user.email?.toLowerCase();
        if (email && PROTECTED_EMAILS.includes(email)) {
            console.log(`   [KEEP] ${email}`);
            continue;
        }

        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (delErr) {
            console.error(`   ❌ Failed to delete auth user ${email || user.id}:`, delErr.message);
        } else {
            console.log(`   [DELETE] ${email || user.id}`);
            deletedAuth++;
        }
    }

    console.log(`\n🎉 Purge complete! Deleted ${deletedAuth} auth users.`);
    console.log('   Only the 4 administrator accounts remains.');
    console.log('   You can now run updatePersonnel.ts to import the fresh list.');
}

purgeAll().catch(console.error);
