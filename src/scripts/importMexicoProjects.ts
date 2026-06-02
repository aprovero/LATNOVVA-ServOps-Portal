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

const NEW_PROJECTS = [
    { name: 'GE-LNV-123', location: 'PEROTE' },
    { name: 'CH-LNVEM-090', location: 'C. 56 500, Itzimná, 97100 Mérida, Yuc.' },
    { name: 'EST-LNV-000 CDMX', location: 'Río Nilo 80, Cuauhtémoc, 06500 Ciudad de México, CDMX' },
    { name: 'EST-LNV-000 MID', location: 'C. 56 500, Itzimná, 97100 Mérida, Yuc.' },
    { name: 'GR-LNV-094', location: 'MEXICALI' },
    { name: 'GR-LNV-095', location: 'PLAYA DEL CARMEN' },
    { name: 'LNVEM-LNV-068', location: 'MERIDA' },
    { name: 'OPDE-LNV-085', location: 'AGUASCALIENTES' },
    { name: 'VM-LNV-098', location: 'MONTERREY' }
];

async function run() {
    console.log(`🚀 Starting Mexico Projects Batch Import...`);
    
    // First, verify if any exist to avoid duplicates
    const { data: existing } = await supabaseAdmin.from('projects').select('name').eq('subsidiary', 'MX');
    const existingNames = new Set(existing?.map(p => p.name) || []);
    
    const projectsToInsert = NEW_PROJECTS.filter(p => !existingNames.has(p.name)).map(p => ({
        id: uuidv4(),
        name: p.name,
        code_name: p.name,
        type: 'Solar',
        status: 'Active',
        location: p.location,
        subsidiary: 'MX',
        subsidiary_metadata: {}
    }));

    if (projectsToInsert.length === 0) {
        console.log('✅ All projects already exist!');
        return;
    }

    const { data, error } = await supabaseAdmin.from('projects').insert(projectsToInsert).select();
    if (error) console.error("❌ Error inserting projects:", error);
    else console.log(`✅ Successfully inserted ${data.length} projects!`);
}

run().catch(console.error);
