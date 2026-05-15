import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// The 19 IDs of the Mexico personnel
const MX_PERSONNEL_IDS = [
    "bdc422cb-4261-431c-a6f4-9ec32a7f2548", // CAAMAL
    "4cdb73e7-4aba-4131-bdf6-ef80055093ae", // FERNANDEZ
    "dd408924-77f9-4059-af8d-ed50773ac592", // FLORES
    "e8655a11-ee7a-474e-9f08-857431d971c1", // JALDO
    "e929c8f1-13a0-4732-8e85-2715e7165678", // JIMENEZ
    "ec4be14a-7149-4d24-ba2b-a38d6c3252da", // MARIN
    "9efbd072-c3ad-4922-bd70-3c976b3be323", // MARTINEZ
    "9e83f008-b5c6-4d3b-aa2a-14b164802043", // MIRANDA COCOM
    "60d5577f-8407-4e6a-b562-2bba752981d1", // MIRANDA MONTIEL
    "644d56f8-ed44-4bea-bef6-1978722f0bb6", // ORTIZ
    "16bd6e89-de14-417c-8701-60da51dfead0", // RANGEL
    "eabdaa71-a05c-41a9-8a82-14bcebebb584", // REYES BAQUEDANO
    "a5ebfe1d-7941-48bb-b78d-053642a3de8c", // REYES MONTES
    "1f8e6c5a-2e3d-4b5c-8a7b-9c0d1e2f3a4b", // SANTIAGO
    "2a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d", // TOMASINI
    "3b4c5d6e-7f8a-9b0c-1d2e-3f4a5b6c7d8e", // TRINIDAD
    "4c5d6e7f-8a9b-0c1d-2e3f-4a5b6c7d8e9f", // VALERIO
    "5d6e7f8a-9b0c-1d2e-3f4a-5b6c7d8e9f0a", // VILLANUEVA
    "6e7f8a9b-0c1d-2e3f-4a5b-6c7d8e9f0a1b"  // YAM ORTIZ
];

async function run() {
    console.log(`🚀 Bulk updating all MX personnel to 'Office' role...`);
    
    const { data, error } = await supabaseAdmin
        .from('personnel')
        .update({ app_role: 'Office' })
        .eq('subsidiary', 'MX')
        .select('name, app_role');

    if (error) {
        console.error("❌ Failed to update roles:", error);
    } else {
        console.log(`✅ Successfully updated ${data.length} personnel to 'Office' role!`);
        data.forEach(p => console.log(`   - ${p.name}: ${p.app_role}`));
    }
}

run().catch(console.error);
