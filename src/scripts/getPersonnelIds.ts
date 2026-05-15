import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log(`🚀 Fetching Mexico Personnel IDs...`);
    
    const { data, error } = await supabaseAdmin
        .from('personnel')
        .select('id, employee_number, name')
        .eq('subsidiary', 'MX')
        .order('employee_number', { ascending: true });

    if (error) {
        console.error("❌ Error fetching personnel:", error);
        return;
    }

    console.log(`\n✅ Found ${data.length} MX Employees:\n`);
    
    // Create a structured object you can copy-paste into your timesheet script
    const mapping: Record<string, string> = {};

    data.forEach(p => {
        mapping[p.employee_number] = p.id;
        console.log(`[${p.employee_number}] ${p.name}`);
        console.log(`   -> ID: ${p.id}`);
        console.log('-----------------------------------');
    });

    console.log("\n💡 JSON MAPPING DICTIONARY (Copy this into your timesheet script):");
    console.log(JSON.stringify(mapping, null, 2));
}

run().catch(console.error);
