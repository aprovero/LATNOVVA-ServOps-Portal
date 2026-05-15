import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

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
    console.log(`🚀 Cleaning up temporary timesheets...`);
    
    // 1. Delete the timesheets we just inserted so you don't get duplicates
    const { error: deleteError } = await supabaseAdmin
        .from('timesheets')
        .delete()
        .eq('manual_reason', 'Batch imported from provided payload payload');

    if (deleteError) {
        console.error("❌ Failed to clean up null timesheets:", deleteError);
    } else {
        console.log("✅ Cleaned up the temporary timesheets successfully.");
    }

    console.log(`\n🚀 Creating 2 new Projects...`);

    // The UUID you previously hardcoded in your payload
    const requestedUUID = "c95e8081-3323-4c55-87f5-259207865768";
    
    // 2. Create the projects
    const projectsToInsert = [
        {
            id: requestedUUID, // Re-use the exact ID you had in your payload!
            name: 'EST-LNV-000 MID',
            type: 'BESS',
            status: 'In Progress',
            progress: 0,
            project_size: 'Unknown',
            system_type: 'Unknown',
            location: { lat: 0, lng: 0 },
            code_name: 'EST-LNV-000 MID',
            scopes: [],
            assigned_personnel: [],
            has_no_defined_scope: true,
            disciplines: []
        },
        {
            id: uuidv4(), // Generate a new ID for the second one
            name: 'EST-LNV-000',
            type: 'BESS',
            status: 'In Progress',
            progress: 0,
            project_size: 'Unknown',
            system_type: 'Unknown',
            location: { lat: 0, lng: 0 },
            code_name: 'EST-LNV-000',
            scopes: [],
            assigned_personnel: [],
            has_no_defined_scope: true,
            disciplines: []
        }
    ];

    const { data: insertedProjects, error: insertError } = await supabaseAdmin
        .from('projects')
        .upsert(projectsToInsert) // Use upsert so it doesn't crash if they already exist
        .select('id, name');

    if (insertError) {
        console.error("❌ Failed to create projects:", insertError);
        return;
    }

    console.log(`\n✅ Projects created successfully! Here are their exact UUIDs:\n`);
    
    insertedProjects.forEach(p => {
        console.log(`[Project] ${p.name}`);
        console.log(`   -> ID: ${p.id}`);
        console.log('-----------------------------------');
    });
}

run().catch(console.error);
