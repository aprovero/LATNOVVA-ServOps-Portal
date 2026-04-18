/**
 * patchUserRoles.ts
 * -----------------
 * Bulk-sets app_metadata.role for all existing Supabase Auth users.
 * Also sets app_metadata.personnel_id so the app can link auth identity
 * back to the personnel record without a DB join.
 *
 * Run with:
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"; npx tsx src/scripts/patchUserRoles.ts
 *
 * Requires: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env or .env file.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('   Get the service role key from: Supabase Dashboard → Settings → API → service_role (secret)');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// ---------------------------------------------------------------------------
// Role map: email → { role, personnel_id }
// This is derived from mockPersonnel. Add or edit entries here as needed.
// ---------------------------------------------------------------------------
function generateEmail(name: string): string {
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length === 1) return `${parts[0].toLowerCase()}@latnovva.com`;
    const firstInitial = parts[0][0].toLowerCase();
    const lastName = parts[parts.length - 1].toLowerCase();
    return `${firstInitial}${lastName}@latnovva.com`;
}

const ROLE_MAP: Record<string, { role: string; personnel_id: string }> = {
    // ── Supervisors ──────────────────────────────────────────────────────────
    [generateEmail('RICARDO OLIVA')]:              { role: 'Supervisor', personnel_id: 'PERS-SV1'  },
    [generateEmail('MAYLENE TORRES MALDONADO')]:   { role: 'Supervisor', personnel_id: 'PERS-TW1'  },
    [generateEmail('SEBASTIAN YANCA')]:            { role: 'Supervisor', personnel_id: 'PERS-BF1'  },
    [generateEmail('JAIME VAZQUEZ')]:              { role: 'Supervisor', personnel_id: 'PERS-PR1'  },
    'mledezma@latnovva.com':                       { role: 'Supervisor', personnel_id: 'PERS-BY2'  },

    // ── Managers ─────────────────────────────────────────────────────────────
    [generateEmail('JUAN MANUEL RUBIO')]:          { role: 'Manager',    personnel_id: 'PERS-MR1'  },
    'fasensio@latnovva.com':                       { role: 'Manager',    personnel_id: 'PERS-NEW1' },
    'jreina@latnovva.com':                         { role: 'Manager',    personnel_id: 'PERS-NEW2' },
    'jmdiaz@latnovva.com':                         { role: 'Manager',    personnel_id: 'PERS-NEW3' },
    'aprovero@latnovva.com':                       { role: 'Manager',    personnel_id: 'PERS-GOD'  },

    // ── Techs ─────────────────────────────────────────────────────────────────
    [generateEmail('PEDRO LUIS RAMIREZ MORENO')]:  { role: 'Tech',       personnel_id: 'PERS-SV2'  },
    [generateEmail('JUAN ALBERTO GARCIA SARIOL')]: { role: 'Tech',       personnel_id: 'PERS-SV3'  },
    [generateEmail('JORGE LUIS CALDERON PEREZ')]:  { role: 'Tech',       personnel_id: 'PERS-SV4'  },
    [generateEmail('LAZARO RODRIGUEZ MARTINEZ')]:  { role: 'Tech',       personnel_id: 'PERS-TW2'  },
    [generateEmail('JOHN ANTHONY AGUILAR JR')]:    { role: 'Tech',       personnel_id: 'PERS-BF2'  },
    [generateEmail('JUAN GONZALEZ')]:              { role: 'Tech',       personnel_id: 'PERS-BF3'  },
    [generateEmail('EDIAGNEL RIVERA')]:            { role: 'Tech',       personnel_id: 'PERS-BF4'  },
    [generateEmail('BRAINE GAMBOA')]:              { role: 'Tech',       personnel_id: 'PERS-BF5'  },
    [generateEmail('RICHARD RADAMES NUNES ROMERO')]: { role: 'Tech',     personnel_id: 'PERS-BF6'  },
    [generateEmail('JOSHUA SANCHEZ')]:             { role: 'Tech',       personnel_id: 'PERS-BF7'  },
    [generateEmail('VINCENT TORRES MALDONADO')]:   { role: 'Tech',       personnel_id: 'PERS-BF8'  },
    [generateEmail('ARIEL CABALLERO')]:            { role: 'Tech',       personnel_id: 'PERS-BF9'  },
    [generateEmail('FRANCISCO MARTINEZ MARRERO')]: { role: 'Tech',       personnel_id: 'PERS-BF10' },
    [generateEmail('JOSE LOPEZ')]:                 { role: 'Tech',       personnel_id: 'PERS-BF11' },
    [generateEmail('GEORDANIS RODRIGUEZ')]:        { role: 'Tech',       personnel_id: 'PERS-BF12' },
    [generateEmail('LUIS ANGEL GONZALEZ ROMERO')]: { role: 'Tech',       personnel_id: 'PERS-BF13' },
    [generateEmail('CRISTIAN FURE HERNANDEZ')]:    { role: 'Tech',       personnel_id: 'PERS-BF14' },
    [generateEmail('JESUS ORTEGA')]:               { role: 'Tech',       personnel_id: 'PERS-AL1'  },
    [generateEmail('ADRIAN RASCON')]:              { role: 'Tech',       personnel_id: 'PERS-AL2'  },
    [generateEmail('MILDRED BAYARD BOLANOS')]:     { role: 'Tech',       personnel_id: 'PERS-BY1'  },
    [generateEmail('ROSARIO GONZALEZ')]:           { role: 'Tech',       personnel_id: 'PERS-RG1'  },
};

// ---------------------------------------------------------------------------

async function patchAllUsers() {
    console.log('🔍 Fetching all users from Supabase Auth...\n');

    // Fetch all pages of users (Supabase returns max 1000 per page)
    let page = 1;
    let allUsers: Array<{ id: string; email?: string }> = [];

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) {
            console.error('❌ Failed to list users:', error.message);
            process.exit(1);
        }
        allUsers = [...allUsers, ...data.users];
        if (data.users.length < 1000) break;
        page++;
    }

    console.log(`Found ${allUsers.length} users in Supabase Auth.\n`);

    let patched = 0;
    let skipped = 0;
    let unmatched: string[] = [];

    for (const user of allUsers) {
        const email = user.email?.toLowerCase();
        if (!email) { skipped++; continue; }

        const mapping = ROLE_MAP[email];
        if (!mapping) {
            unmatched.push(email);
            continue;
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            app_metadata: {
                role: mapping.role,
                personnel_id: mapping.personnel_id,
            }
        });

        if (error) {
            console.error(`❌ Failed to patch ${email}:`, error.message);
        } else {
            console.log(`✅ ${email.padEnd(40)} → role: ${mapping.role.padEnd(12)} | personnel_id: ${mapping.personnel_id}`);
            patched++;
        }
    }

    console.log('\n─────────────────────────────────────────');
    console.log(`✅ Patched:   ${patched}`);
    console.log(`⏭️  Skipped:   ${skipped} (no email)`);

    if (unmatched.length > 0) {
        console.log(`\n⚠️  ${unmatched.length} user(s) not found in ROLE_MAP (left unchanged):`);
        unmatched.forEach(e => console.log(`   - ${e}`));
        console.log('\n   Add these to ROLE_MAP in patchUserRoles.ts if they need a role.');
    }

    console.log('\n🎉 Done! Users will receive their new role on next login (JWT refresh).');
    console.log('   To force immediate effect, ask affected users to sign out and back in.');
}

patchAllUsers().catch(console.error);
