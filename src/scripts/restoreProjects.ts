/**
 * restoreProjects.ts
 * -----------------
 * Selective restoration of clients and projects from backup.
 * NOW IDEMPOTENT: Safe to run multiple times (will not duplicate).
 */

import { createClient } from '@supabase/supabase-js';
import { mockClients, mockPersonnel, mockProjects, mockTools } from '../store/mockDataBackup';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables.');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function restore() {
    console.log('🚀 Starting Idempotent Restoration (Clients, Projects, Tools)\n');

    // 1. Fetch Live Personnel
    const { data: livePersonnel } = await supabaseAdmin.from('personnel').select('id, name');
    const personnelIdMap = new Map<string, string>();
    for (const mockP of mockPersonnel) {
        const match = livePersonnel?.find(lp => lp.name.trim().toLowerCase() === mockP.name.trim().toLowerCase());
        if (match) personnelIdMap.set(mockP.id, match.id);
    }
    const godMatch = livePersonnel?.find(lp => lp.name.toLowerCase().includes('andres provero'));
    if (godMatch) personnelIdMap.set('PERS-GOD', godMatch.id);

    // 2. IDEMPOTENT CLIENTS
    console.log(`🏢 Checking ${mockClients.length} Clients...`);
    const clientIdMap = new Map<string, string>();
    const { data: existingClients } = await supabaseAdmin.from('clients').select('id, name');

    for (const client of mockClients) {
        const existing = existingClients?.find(c => c.name === client.name);
        if (existing) {
            clientIdMap.set(client.id, existing.id);
            console.log(`   [SKIP] Client exists: ${client.name}`);
        } else {
            const { data: inserted, error: cErr } = await supabaseAdmin
                .from('clients')
                .insert({ name: client.name, logo: client.logo })
                .select('id')
                .single();
            if (inserted) {
                clientIdMap.set(client.id, inserted.id);
                console.log(`   ✅ Created Client: ${client.name}`);
            }
        }
    }

    // 3. IDEMPOTENT PROJECTS
    console.log(`📋 Checking ${mockProjects.length} Projects...`);
    const { data: existingProjs } = await supabaseAdmin.from('projects').select('id, name');
    
    for (const proj of mockProjects) {
        const existing = existingProjs?.find(p => p.name === proj.name);
        if (existing) {
            console.log(`   [SKIP] Project exists: ${proj.name}`);
            continue;
        }

        const liveClientId = clientIdMap.get(proj.clientId) || null;
        const liveTeamIds = (proj.assignedPersonnel || [])
            .map((mockId: string) => personnelIdMap.get(mockId))
            .filter(Boolean);

        const { error: pErr } = await supabaseAdmin.from('projects').insert({
            client_id: liveClientId,
            name: proj.name,
            type: proj.type,
            status: proj.status,
            progress: proj.progress || 0,
            project_size: proj.projectSize,
            system_type: proj.systemType,
            location: proj.location,
            assigned_personnel: liveTeamIds,
            scopes: proj.scopes || [],
            disciplines: proj.disciplines || []
        });

        if (!pErr) console.log(`   ✅ Created Project: ${proj.name}`);
    }

    // 4. RESTORE TOOLS (The part that failed)
    console.log(`🔧 Restoring ${mockTools.length} Tools...`);
    // Refresh existing projects for tool mapping
    const { data: latestProjs } = await supabaseAdmin.from('projects').select('id, name');

    for (const tool of mockTools) {
        const originalProj = mockProjects.find(p => p.id === tool.assignedProjectId);
        const targetProjUuid = latestProjs?.find(p => p.name === originalProj?.name)?.id || null;

        const { error: tErr } = await supabaseAdmin.from('tools').upsert({
            name: tool.name,
            model: tool.model,
            serial_number: tool.serialNumber,
            certification_expiry: tool.certificationExpiry,
            assigned_project_id: targetProjUuid,
            history: tool.history
        }, { onConflict: 'serial_number' }); // Avoid duplicate tools by serial number

        if (!tErr) console.log(`   ✅ Synced Tool: ${tool.name}`);
    }

    console.log(`\n🎉 Full Sync Successful! Dashboard is ready.`);
}

restore().catch(console.error);
