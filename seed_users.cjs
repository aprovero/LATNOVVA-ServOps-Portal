require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

// We use the same 'persistSession: false' trick here so it runs cleanly
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function run() {
    // 1. Fetch available clients so we can automatically assign the Customer to "Power Electronics"
    const { data: clients, error: clientErr } = await supabase.from('clients').select('id, name');
    if (clientErr) console.warn("Could not fetch clients list:", clientErr.message);

    const getClientId = (name) => {
        if (!clients) return null;
        const client = clients.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
        return client ? client.id : null;
    };

    // 2. Define the team
    const usersToCreate = [
        { email: 'aprovero@gmail.com', role: 'Supervisor', password: 'password123', company: null },
        { email: 'aprovero@hotmail.com', role: 'Tech', password: 'password123', company: null },
        { email: 'aprovero@yahoo.com', role: 'Customer', password: 'password123', company: 'Power Electronics' }
    ];

    console.log("Starting batch user creation via Native GoTrue API...\n");

    for (const u of usersToCreate) {
        let clientId = null;
        if (u.company) {
            clientId = getClientId(u.company);
            if (!clientId) {
                console.log(`  [!] Warning: Could not find company "${u.company}" in database. Skipping assignment.`);
            }
        }

        console.log(`Attempting to create: ${u.email} (${u.role})`);
        
        const { data, error } = await supabase.auth.signUp({
            email: u.email,
            password: u.password,
            options: {
                data: {
                    full_name: u.email.split('@')[0],
                    role: u.role,
                    client_id: clientId
                }
            }
        });

        if (error) {
            // Usually occurs if the user already exists
            console.error(`  [X] Failed: ${error.message}\n`);
        } else {
            console.log(`  [✓] Success! GoTrue User ID: ${data.user?.id}\n`);
        }
        
        // Small delay to be polite to the Supabase API limits
        await new Promise(r => setTimeout(r, 600));
    }

    console.log("Batch creation complete. Check your Supabase Dashboard!");
}

run();
