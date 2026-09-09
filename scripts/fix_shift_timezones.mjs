import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('=== Authenticate as HR ===');
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'jacqueline.martinez@latnovva.com',
    password: 'Latnovva2026!'
  });
  if (authErr) {
    console.error('Login error:', authErr);
    process.exit(1);
  }
  console.log('✔ Authenticated as HR');

  const { data: timesheets, error: fetchErr } = await supabase
    .from('mx_timesheets')
    .select('*')
    .eq('date', '2026-09-08');

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    process.exit(1);
  }

  console.log('Found ' + timesheets.length + ' timesheets for 2026-09-08');

  // Mexico is UTC-6:
  // 08:00 AM local = 14:00:00.000Z
  // 18:00 (06:00 PM) local = 2026-09-09T00:00:00.000Z
  const correctInTimestamp = '2026-09-08T14:00:00.000Z';
  const correctOutTimestamp = '2026-09-09T00:00:00.000Z';

  for (const t of timesheets) {
    // Determine if collaborator already had actual user punches from earlier today:
    const existingPunches = t.punches || [];
    let updatedPunches = [];

    // Check if they had punches with "2026-09-08T08:00:00.000Z" (which was 2 AM)
    const hasBadUtc8am = existingPunches.some(p => p.timestamp === '2026-09-08T08:00:00.000Z');
    const hasBadUtc6pm = existingPunches.some(p => p.timestamp === '2026-09-08T18:00:00.000Z');

    if (hasBadUtc8am || hasBadUtc6pm || existingPunches.length <= 1) {
      // Re-create proper 8:00 AM to 6:00 PM local punches
      updatedPunches = [
        {
          timestamp: correctInTimestamp,
          lat: 0,
          lng: 0,
          accuracy: 0,
          type: 'clockIn',
          timeSource: 'manual',
          workMode: 'On Site',
          manualAdjustment: true,
          adjustmentNote: 'Acreditación oficial RH (08:00 AM)'
        },
        {
          timestamp: correctOutTimestamp,
          lat: 0,
          lng: 0,
          accuracy: 0,
          type: 'clockOut',
          timeSource: 'manual',
          workMode: 'On Site',
          manualAdjustment: true,
          adjustmentNote: 'Acreditación oficial RH (06:00 PM)'
        }
      ];
    } else {
      // If user had actual clock-in/out timestamps (like Nicole at 07:42, Aurelio at 08:53), keep them or fix
      updatedPunches = existingPunches.map(p => {
        if (p.timestamp === '2026-09-08T08:00:00.000Z') {
          return { ...p, timestamp: correctInTimestamp };
        }
        if (p.timestamp === '2026-09-08T18:00:00.000Z') {
          return { ...p, timestamp: correctOutTimestamp };
        }
        return p;
      });
    }

    const { error: updateErr } = await supabase
      .from('mx_timesheets')
      .update({
        punches: updatedPunches,
        time_in: t.time_in || '08:00',
        time_out: t.time_out || '18:00',
        hours: t.hours && Number(t.hours) >= 10 ? t.hours : 10.0,
        status: 'Approved',
        approved_by: 'RH - Jacqueline Martínez'
      })
      .eq('id', t.id);

    if (updateErr) {
      console.error('Error updating ' + t.id + ':', updateErr);
    } else {
      console.log('✔ Updated ' + t.id + ' (' + t.personnel_id + ') punches to local times (08:00 AM / 06:00 PM)');
    }
  }

  console.log('\nAll timesheet punch timestamps corrected!');
}

run().catch(console.error);
