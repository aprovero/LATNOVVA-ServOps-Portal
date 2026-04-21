import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
    const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await s.from('personnel').select('name, email, id');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}
check();
