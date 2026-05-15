import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Project UUIDs
const PROJECT_EST_LNV_000_MID = "c95e8081-3323-4c55-87f5-259207865768";
const PROJECT_EST_LNV_000 = "f0eead03-0e28-43fa-96c2-7480bdd579b7";

// Members of EST-LNV-000 MID
const team_MID = [
    "bdc422cb-4261-431c-a6f4-9ec32a7f2548", // CAAMAL HERNANDEZ LUIS ALBERTO
    "4cdb73e7-4aba-4131-bdf6-ef80055093ae", // FERNANDEZ RIVERA FERNANDO BENJAMIN
    "dd408924-77f9-4059-af8d-ed50773ac592", // FLORES PEREGRINO CESAR EDUARDO
    "9e83f008-b5c6-4d3b-aa2a-14b164802043", // MIRANDA COCOM LUIS ANTONIO
    "eabdaa71-a05c-41a9-8a82-14bcebebb584"  // REYES BAQUEDANO SILVIA MARIELA
];

// Members of EST-LNV-000
const team_Regular = [
    "e8655a11-ee7a-474e-9f08-857431d971c1", // JALDO RONQUILLO DANIEL
    "e929c8f1-13a0-4732-8e85-2715e7165678", // JIMENEZ OLVERA BRENDA EVELYN
    "ec4be14a-7149-4d24-ba2b-a38d6c3252da", // MARIN HERES MARIA DEL ROCIO MAVILA
    "9efbd072-c3ad-4922-bd70-3c976b3be323", // MARTINEZ BRISEÑO JACQUELINE
    "60d5577f-8407-4e6a-b562-2bba752981d1", // MIRANDA MONTIEL MARCO ANTONIO
    "644d56f8-ed44-4bea-bef6-1978722f0bb6", // ORTIZ MEDINA MANUEL JESUS
    "16bd6e89-de14-417c-8701-60da51dfead0", // RANGEL RAMOS NANCY SANDI
    "a5ebfe1d-7941-48bb-b78d-053642a3de8c"  // REYES MONTES DE OCA JUANA DEL CARMEN
];

async function run() {
    console.log(`🚀 Assigning teams to projects...`);

    // 1. Assign Personnel to Projects
    await supabaseAdmin
        .from('projects')
        .update({ assigned_personnel: team_MID })
        .eq('id', PROJECT_EST_LNV_000_MID);
        
    await supabaseAdmin
        .from('projects')
        .update({ assigned_personnel: team_Regular })
        .eq('id', PROJECT_EST_LNV_000);

    console.log(`✅ Assigned ${team_MID.length} personnel to EST-LNV-000 MID`);
    console.log(`✅ Assigned ${team_Regular.length} personnel to EST-LNV-000`);

    console.log(`\n🚀 Correcting timesheets project assignment...`);
    
    // 2. Currently all timesheets are in MID. We need to move the ones that belong to Regular team.
    const { data, error } = await supabaseAdmin
        .from('timesheets')
        .update({ project_id: PROJECT_EST_LNV_000 })
        .in('personnel_id', team_Regular)
        .select('id');

    if (error) {
        console.error("❌ Failed to update timesheets:", error);
    } else {
        console.log(`✅ Successfully moved ${data?.length || 0} timesheets to EST-LNV-000`);
    }

    console.log(`\n🎉 Project assignments complete!`);
}

run().catch(console.error);
