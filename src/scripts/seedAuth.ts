import { createClient } from '@supabase/supabase-js';
import { mockPersonnel } from '../store/mockDataBackup';
import * as dotenv from 'dotenv';
// Load variables from .env file in the current working directory
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  console.error("You MUST provide the Service Role Key (from Supabase dashboard -> Settings -> API -> service_role/secret) to create users.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Generates an email matching the rule: first initial + last name
 * E.g., RICARDO OLIVA -> roliva@latnovva.com
 */
function generateEmail(name: string): string {
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length === 1) {
        return `${parts[0].toLowerCase()}@latnovva.com`;
    }
    const firstInitial = parts[0][0].toLowerCase();
    const lastName = parts[parts.length - 1].toLowerCase();
    return `${firstInitial}${lastName}@latnovva.com`;
}

async function seed() {
    // Include GOD mode user per the user's specific request
    const personnelToSeed = [
        ...mockPersonnel,
        {
            id: 'PERS-GOD',
            name: 'Andres Provero', // Or any desired full name
            position: 'GOD MODE',
            employeeNumber: 'EMP-GOD',
            appRole: 'Manager',
            status: 'Active',
            certifications: [],
            email: 'aprovero@latnovva.com' // Explicit override
        }
    ];

    console.log(`Starting to seed ${personnelToSeed.length} users into Supabase Auth...`);
    let successCount = 0;
    
    for (const person of personnelToSeed) {
        // @ts-ignore - Email might not exist on all mock Personnel interfaces technically
        const email = person.email || generateEmail(person.name);
        
        console.log(`Processing: ${person.name} -> ${email}`);
        
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            email_confirm: true, // Confirm immediately so magic links work
            user_metadata: {
                full_name: person.name,
                role: person.appRole,
                personnel_id: person.id
            }
        });
        
        if (error) {
            // Check if error is 'user already exists' to skip gracefully
            if (error.message.includes('User already registered')) {
                 console.log(`⚠️ User already exists: ${email}`);
            } else {
                 console.error(`❌ Failed to create ${email}:`, error.message);
            }
        } else {
            console.log(`✅ Created ${email} (Auth ID: ${data.user.id})`);
            successCount++;
        }
    }
    
    console.log(`\n🎉 Finished seeding! Created ${successCount} new users.`);
}

seed().catch(console.error);
