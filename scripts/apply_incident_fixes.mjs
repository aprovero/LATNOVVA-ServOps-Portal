import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('=== Step 0: Authenticate as HR (Jacqueline Martínez) ===');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'jacqueline.martinez@latnovva.com',
    password: 'Latnovva2026!'
  });
  if (authErr) {
    console.error('HR Login failed:', authErr);
    process.exit(1);
  }
  console.log('✔ Authenticated as HR:', authData.user.email, authData.user.id);

  console.log('\n=== Step 1: Update Mérida Project Coordinates and Geofence ===');
  const meridaId = 'c95e8081-3323-4c55-87f5-259207865768';
  const { data: meridaData, error: meridaErr } = await supabase
    .from('projects')
    .update({
      location: '20.9889,-89.6133',
      subsidiary_metadata: { geofenceRadius: 500 }
    })
    .eq('id', meridaId)
    .select();

  if (meridaErr) {
    console.error('Error updating Mérida project:', meridaErr);
  } else {
    console.log('Successfully updated Mérida project:', meridaData[0]?.name, meridaData[0]?.location);
  }

  console.log('\n=== Step 2: Fetch Active Personnel in Mexico ===');
  const { data: personnel, error: persErr } = await supabase
    .from('mx_personnel')
    .select('*')
    .eq('status', 'Active');

  if (persErr) {
    console.error('Error fetching personnel:', persErr);
    return;
  }
  console.log(`Found ${personnel.length} active personnel in Mexico.`);

  // Known Mérida collaborator IDs
  const meridaIds = new Set([
    'c1179145-9f48-43e5-9bb0-3245db00b779', // Josué Yam
    '06611f0a-0037-40b8-826a-e9d836ddca37', // Nicole Villanueva
    'eabdaa71-a05c-41a9-8a82-14bcebebb584', // Silvia Reyes
    '955ef0f7-6cc3-4899-ace8-21023cd8e322', // Alejandro Tomasini
    '4cdb73e7-4aba-4131-bdf6-ef80055093ae', // Benjamín Fernández
    '84d8258e-ee39-45eb-9f04-929abaf979b2', // Esmeralda Dulché
    'bdc422cb-4261-431c-a6f4-9ec32a7f2548', // Luis Caamal
    'dd408924-77f9-4059-af8d-ed50773ac592', // César Flores
    '9e83f008-b5c6-4d3b-aa2a-14b164802043'  // Luis Miranda
  ]);

  // Separate into Merida and CDMX groups
  const meridaStaff = [];
  const cdmxStaff = [];

  for (const p of personnel) {
    if (meridaIds.has(p.id)) {
      meridaStaff.push(p);
    } else {
      cdmxStaff.push(p);
    }
  }

  console.log(`Mérida Staff (${meridaStaff.length}):`, meridaStaff.map(p => p.name));
  console.log(`CDMX Staff (${cdmxStaff.length}):`, cdmxStaff.map(p => p.name));

  const cdmxIds = cdmxStaff.map(p => p.id);

  console.log('\n=== Step 3: Update CDMX Projects Assigned Personnel ===');
  // Update both CDMX projects so dropdown is populated everywhere
  const cdmxProjectIds = [
    'a68210e5-d579-4e6f-b2d3-af1a9d3a4911', // EST-LNV-000 CDMX
    'f0eead03-0e28-43fa-96c2-7480bdd579b7'  // EST-LNV-000
  ];

  for (const pid of cdmxProjectIds) {
    const { data: projUpdate, error: projErr } = await supabase
      .from('projects')
      .update({ assigned_personnel: cdmxIds })
      .eq('id', pid)
      .select();
    if (projErr) {
      console.error(`Error updating assigned personnel for project ${pid}:`, projErr);
    } else {
      console.log(`Updated project ${pid} (${projUpdate[0]?.name}): ${projUpdate[0]?.assigned_personnel?.length} collaborators assigned.`);
    }
  }

  console.log('\n=== Step 4: Check existing timesheets for 2026-09-08 ===');
  const today = '2026-09-08';
  const { data: existingTimesheets, error: existErr } = await supabase
    .from('mx_timesheets')
    .select('id, personnel_id, date')
    .eq('date', today);

  if (existErr) {
    console.error('Error checking existing timesheets:', existErr);
  }
  const existingPersonnelIds = new Set((existingTimesheets || []).map(t => t.personnel_id));
  console.log(`Existing timesheets count for ${today}: ${existingPersonnelIds.size}`);

  console.log('\n=== Step 5: Insert Shifts for Today (08:00 - 18:00, 10h) ===');
  const allTargetStaff = [...meridaStaff.map(p => ({ ...p, office: 'MID', projectId: meridaId })), ...cdmxStaff.map(p => ({ ...p, office: 'CDMX', projectId: 'f0eead03-0e28-43fa-96c2-7480bdd579b7' }))];

  let insertedCount = 0;
  let skippedCount = 0;

  for (const staff of allTargetStaff) {
    if (existingPersonnelIds.has(staff.id)) {
      console.log(`Skipping ${staff.name} (already has timesheet for ${today})`);
      skippedCount++;
      continue;
    }

    const timesheetId = crypto.randomUUID();
    const payload = {
      id: timesheetId,
      personnel_id: staff.id,
      project_id: staff.projectId,
      date: today,
      time_in: '08:00',
      time_out: '18:00',
      hours: 10.0,
      type: 'On Site',
      classification: 'Regular',
      status: 'Approved',
      approved_by: 'RH - Jacqueline Martínez',
      source: 'manual',
      manual_reason: 'Acreditación oficial por incidencia técnica de inicio de jornada v4.0.1 (08:00 a 18:00)',
      notes: 'Acreditación oficial por incidencia técnica de inicio de jornada v4.0.1',
      punches: [
        {
          timestamp: `${today}T08:00:00.000Z`,
          lat: 0,
          lng: 0,
          accuracy: 0,
          type: 'clockIn',
          timeSource: 'manual',
          workMode: 'On Site',
          manualAdjustment: true,
          adjustmentNote: 'Acreditación oficial RH'
        },
        {
          timestamp: `${today}T18:00:00.000Z`,
          lat: 0,
          lng: 0,
          accuracy: 0,
          type: 'clockOut',
          timeSource: 'manual',
          workMode: 'On Site',
          manualAdjustment: true,
          adjustmentNote: 'Acreditación oficial RH'
        }
      ]
    };

    const { error: insertErr } = await supabase
      .from('mx_timesheets')
      .insert(payload);

    if (insertErr) {
      console.error(`Error inserting timesheet for ${staff.name} (${staff.id}):`, insertErr);
    } else {
      console.log(`✔ Inserted 10h shift for ${staff.name} [${staff.office}]`);
      insertedCount++;
    }
  }

  console.log(`\nDone! Inserted: ${insertedCount}, Skipped: ${skippedCount}`);
}

run().catch(console.error);
