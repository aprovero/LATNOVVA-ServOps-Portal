/**
 * bulkNormalizeData.ts
 * -------------------
 * BULK DATA NORMALIZATION: Standardizes Names (Title Case) and Phone Numbers (+1 format).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

function normalizeName(name: string): string {
    if (!name) return "";
    return name
        .trim()
        .toLowerCase()
        .replace(/(?:^|\s|-)\S/g, l => l.toUpperCase());
}

function normalizePhoneNumber(phone: any): string {
    if (!phone) return "";
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 0) return "";
    
    // Handle US numbers (prefix with 1 if 10 digits)
    let finalDigits = digits;
    if (digits.length === 10) finalDigits = '1' + digits;
    
    if (finalDigits.length === 11 && finalDigits.startsWith('1')) {
        const area = finalDigits.slice(1, 4);
        const mid = finalDigits.slice(4, 7);
        const last = finalDigits.slice(7);
        return `+1 (${area}) ${mid} ${last}`;
    }
    
    return phone; // Fallback
}

async function runNormalization() {
    console.log(`🧹 Starting Bulk Data Normalization...\n`);

    // 1. Fetch all personnel
    const { data: personnel, error: fetchErr } = await supabaseAdmin
        .from('personnel')
        .select('id, name, phone_number');
    
    if (fetchErr) {
        console.error(`❌ Failed to fetch personnel: ${fetchErr.message}`);
        return;
    }

    console.log(`📦 Found ${personnel.length} personnel records.`);

    let normCount = 0;

    for (const p of personnel) {
        const newName = normalizeName(p.name);
        const newPhone = normalizePhoneNumber(p.phone_number);

        if (newName === p.name && newPhone === p.phone_number) {
            continue; // No change needed
        }

        console.log(`🔄 Normalizing: [${p.name}] -> [${newName}] | [${p.phone_number}] -> [${newPhone}]`);
        
        const { error: updateErr } = await supabaseAdmin
            .from('personnel')
            .update({ 
                name: newName,
                phone_number: newPhone
            })
            .eq('id', p.id);

        if (updateErr) {
            console.error(`   ❌ Failed to update ${p.name}: ${updateErr.message}`);
        } else {
            normCount++;
        }
    }

    console.log(`\n🎉 Normalization Complete!`);
    console.log(`✅ Records Updated: ${normCount}`);
}

runNormalization().catch(console.error);
