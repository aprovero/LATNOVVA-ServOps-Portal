import { createClient } from '@supabase/supabase-js';
import { mockClients, mockPersonnel, mockProjects } from '../store/mockData';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing environment variables. Please provide VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function clearTables() {
    console.log('🧹 Clearing existing data (Projects, Clients, Personnel)...');
    // Delete in order to respect foreign keys
    await supabaseAdmin.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('personnel').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

async function seed() {
    await clearTables();
    
    // ==========================================
    // 1. PERSONNEL MAPPING & INSERTION
    // ==========================================
    console.log('🔄 Fetching Auth users to map IDs...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
        console.error('❌ Failed to fetch Auth users:', authError);
        return;
    }

    const authUsers = authData.users;
    const personnelMap = new Map<string, string>(); // oldId -> newUuid

    // Create lookup table from user_metadata.personnel_id
    for (const u of authUsers) {
        if (u.user_metadata?.personnel_id) {
            personnelMap.set(u.user_metadata.personnel_id, u.id);
        }
    }

    // Include GOD MODE
    const personnelToSeed = [
        ...mockPersonnel,
        {
            id: 'PERS-GOD',
            name: 'Andres Provero',
            position: 'GOD MODE',
            employeeNumber: 'EMP-GOD',
            appRole: 'Manager',
            status: 'Active',
            certifications: [],
            email: 'aprovero@latnovva.com'
        }
    ];

    console.log(`👤 Inserting ${personnelToSeed.length} Personnel records...`);
    const formattedPersonnel = personnelToSeed.map(p => {
        // Fallback to generating a uuid if for some reason the auth user doesn't exist
        const mappedId = personnelMap.get(p.id) || crypto.randomUUID(); 
        personnelMap.set(p.id, mappedId); // Ensure mapping exists for projects later
        
        return {
            id: mappedId,
            name: p.name,
            position: p.position,
            employee_number: p.employeeNumber,
            app_role: p.appRole,
            status: p.status,
            certifications: p.certifications,
            email: p.email || null // Assuming the table schema might accept email if altered, though we didn't add it explicitly to the strict schema. 
            // Wait, SQL schema has `email text`. Yes, we added it in the updated schema!
        };
    });

    const { error: pError } = await supabaseAdmin.from('personnel').insert(formattedPersonnel);
    if (pError) console.error('❌ Error inserting personnel:', pError);

    // ==========================================
    // 2. CLIENTS MAPPING & INSERTION
    // ==========================================
    console.log(`🏢 Inserting ${mockClients.length} Clients...`);
    const clientMap = new Map<string, string>(); // CUST_X -> uuid
    
    for (const client of mockClients) {
        const { data: insertedClient, error: cError } = await supabaseAdmin
            .from('clients')
            .insert({
                name: client.name,
                logo: client.logo
            })
            .select('id')
            .single();
            
        if (cError) {
            console.error(`❌ Error inserting client ${client.name}:`, cError);
        } else if (insertedClient) {
            clientMap.set(client.id, insertedClient.id);
        }
    }

    // ==========================================
    // 3. PROJECTS INSERTION
    // ==========================================
    console.log(`📋 Inserting ${mockProjects.length} Projects...`);
    const formattedProjects = mockProjects.map(proj => {
        // Map old client ID to new UUID. If 'Unknown' or not found, we leave it undefined.
        let cId = clientMap.get(proj.clientId) || undefined;

        // Map assigned personnel arrays from old string IDs to new UUIDs
        const mappedTeam = (proj.assignedPersonnel || []).map(oldId => personnelMap.get(oldId) || oldId);

        return {
            client_id: cId,
            name: proj.name,
            type: proj.type,
            status: proj.status,
            progress: proj.progress,
            project_size: proj.projectSize,
            system_type: proj.systemType,
            location: proj.location,
            code_name: proj.codeName,
            scopes: proj.scopes || [],
            assigned_personnel: mappedTeam,
            has_no_defined_scope: proj.hasNoDefinedScope || false,
            disciplines: proj.disciplines || []
        };
    });

    // We will chunk inserts in case 133 is too large for one payload
    const chunkSize = 50;
    for (let i = 0; i < formattedProjects.length; i += chunkSize) {
        const chunk = formattedProjects.slice(i, i + chunkSize);
        const { error: projError } = await supabaseAdmin.from('projects').insert(chunk);
        if (projError) {
            console.error(`❌ Error inserting project chunk ${i}:`, projError);
        } else {
            console.log(`✅ Inserted projects ${i + 1} to ${i + chunk.length}`);
        }
    }

    console.log('🎉 Phase 2 Data Seeding Complete!');
}

seed().catch(console.error);
