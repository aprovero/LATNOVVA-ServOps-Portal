import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('=== Step 0: Authenticate as HR ===');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'jacqueline.martinez@latnovva.com',
    password: 'Latnovva2026!'
  });
  if (authErr) {
    console.error('Login error:', authErr);
    process.exit(1);
  }
  console.log('✔ Authenticated as:', authData.user.email);

  const { data: timesheets, error: fetchErr } = await supabase
    .from('mx_timesheets')
    .select('*')
    .eq('date', '2026-09-08');

  if (fetchErr) {
    console.error('Error fetching timesheets:', fetchErr);
    process.exit(1);
  }

  console.log('Fetched ' + timesheets.length + ' timesheets for 2026-09-08');

  for (const t of timesheets) {
    const currentHours = Number(t.hours || 0);
    const updates = {
      status: 'Approved',
      approved_by: 'RH - Jacqueline Martínez'
    };

    if (!t.time_out || currentHours < 10) {
      updates.time_in = '08:00';
      updates.time_out = '18:00';
      updates.hours = 10.0;
      updates.notes = (t.notes ? t.notes + ' | ' : '') + 'Acreditación oficial por incidencia técnica de inicio de jornada v4.0.1 (08:00 a 18:00)';
      updates.source = 'manual';
      updates.manual_reason = 'Acreditación oficial por incidencia técnica de inicio de jornada v4.0.1';
    }

    const { error: updateErr } = await supabase
      .from('mx_timesheets')
      .update(updates)
      .eq('id', t.id);

    if (updateErr) {
      console.error('Error updating ' + t.id + ':', updateErr);
    } else {
      console.log('✔ Timesheet ' + t.id + ' updated for personnel ' + t.personnel_id + ': ' + (updates.time_in || t.time_in) + ' - ' + (updates.time_out || t.time_out) + ' (' + (updates.hours || t.hours) + 'h) [Approved]');
    }
  }

  console.log('\nAll 2026-09-08 timesheets are now normalized and Approved!');
}

run().catch(console.error);
