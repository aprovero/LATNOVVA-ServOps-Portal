/**
 * bulkResetPasswords.ts
 * -------------------
 * BULK SECURITY RESET: Updates all existing Auth users to standard default password.
 * EXCLUDES: aprovero@latnovva.com
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

const DEFAULT_PASSWORD = 'Latnovva2026!';
const EXCLUDED_EMAIL = 'aprovero@latnovva.com';

async function runReset() {
    console.log(`🔐 Starting Bulk Password Reset to: ${DEFAULT_PASSWORD}\n`);

    // 1. Fetch all users
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    
    if (listErr) {
        console.error(`❌ Failed to list users: ${listErr.message}`);
        return;
    }

    console.log(`📦 Found ${users.length} users in Auth system.`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const user of users) {
        if (user.email === EXCLUDED_EMAIL) {
            console.log(`⚖️ Skipping Excluded Admin: ${user.email}`);
            skipCount++;
            continue;
        }

        process.stdout.write(`⏳ Resetting: ${user.email}... `);
        
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            password: DEFAULT_PASSWORD
        });

        if (updateErr) {
            console.log(`❌ Failed! (${updateErr.message})`);
            failCount++;
        } else {
            console.log(`✅ Success.`);
            successCount++;
        }
    }

    console.log(`\n🎉 Reset Complete!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`⚖️ Skipped: ${skipCount}`);
    console.log(`❌ Failed: ${failCount}`);
}

runReset().catch(console.error);
