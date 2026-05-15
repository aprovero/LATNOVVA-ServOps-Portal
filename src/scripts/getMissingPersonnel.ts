import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function run() {
    const names = [
        "SANTIAGO CASTRO MIGUEL ANGEL",
        "TOMASINI ANZA ALEJANDRO",
        "TRINIDAD OLVERA AURELIO",
        "VALERIO LUNA ARTURO",
        "VILLANUEVA PALMA NICOLE MARINA",
        "YAM ORTIZ JOSUE YOVANI"
    ];

    for (const name of names) {
        const { data } = await supabaseAdmin
            .from('personnel')
            .select('id, name')
            .ilike('name', `%${name}%`);
        
        console.log(`Search for ${name}:`, data);
    }
}
run().catch(console.error);
