import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    console.log(`🚀 Searching for invalid app_roles...`);
    
    // Fetch all distinct app_roles currently in the database
    const { data, error } = await supabaseAdmin
        .from('personnel')
        .select('id, name, app_role');

    if (error) {
        console.error("❌ Failed to query personnel:", error);
        return;
    }

    const validRoles = ['Tech', 'Manager', 'Admin', 'Customer', 'Office'];
    const invalidRows = data.filter(row => !validRoles.includes(row.app_role));

    if (invalidRows.length > 0) {
        console.log(`⚠️ Found ${invalidRows.length} rows with invalid roles:`);
        const groups: Record<string, number> = {};
        invalidRows.forEach(row => {
            const role = row.app_role === null ? 'NULL' : row.app_role === '' ? 'EMPTY_STRING' : row.app_role;
            groups[role] = (groups[role] || 0) + 1;
            console.log(`   - ${row.name} has role: "${role}"`);
        });

        console.log("\nSummary of invalid roles:");
        console.table(groups);
    } else {
        console.log(`✅ All rows have valid roles!`);
    }
}

run().catch(console.error);
