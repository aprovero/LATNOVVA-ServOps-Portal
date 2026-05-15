import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    console.log(`🚀 Checking and Updating personnel_app_role_check...`);
    
    // We will attempt to drop the old constraint and add a new one that allows 'Office'
    // First, let's execute raw SQL to do this using a stored procedure if available, or just RPC.
    // If not, we will just use app_role: 'Tech' for now in the previous script.
    
    const { data, error } = await supabaseAdmin.rpc('run_sql', {
        sql_query: `
            ALTER TABLE personnel DROP CONSTRAINT IF EXISTS personnel_app_role_check;
            ALTER TABLE personnel ADD CONSTRAINT personnel_app_role_check CHECK (app_role IN ('Tech', 'Manager', 'Admin', 'Customer', 'Office'));
        `
    });

    if (error) {
        console.log("❌ RPC run_sql failed. This means we can't alter the constraint directly via API.", error.message);
        console.log("⚠️ We will run the update script again using 'Tech' for everyone, and the user can change it later if 'Office' is officially added.");
    } else {
        console.log("✅ Successfully updated check constraint!");
    }
}

run().catch(console.error);
