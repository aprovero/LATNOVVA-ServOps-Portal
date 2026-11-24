/**
 * TONIGHT 10:00 PM CLEAN-SLATE SHIFT CLOSURE SCRIPT
 * Closes any remaining OPEN shifts in public.attendance_shifts with 8.00h standard
 * via public.reconcile_shift so tomorrow morning starts with 0 stale open shifts.
 *
 * Usage:
 *   node scripts/tonight_10pm_close_open_shifts.cjs --dry-run   (preview only)
 *   node scripts/tonight_10pm_close_open_shifts.cjs --execute   (close open shifts)
 */
const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');

  const env = {};
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(l => {
      const [k, ...v] = l.split('=');
      if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/\r/g, '');
    });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'rrhh@latnovva.com',
    password: process.env.HR_PASSWORD || 'Latnovva2026!'
  });
  if (authErr) {
    console.error('❌ HR auth failed:', authErr.message);
    process.exit(1);
  }

  const { data: openShifts, error: fetchErr } = await supabase
    .from('attendance_shifts')
    .select('shift_id, personnel_id, project_id, work_type, first_clock_in_at, status')
    .eq('status', 'OPEN')
    .order('first_clock_in_at', { ascending: true });

  if (fetchErr) {
    console.error('❌ Failed to fetch open shifts:', fetchErr.message);
    process.exit(1);
  }

  console.log(`\n=== OPEN SHIFTS FOUND: ${(openShifts || []).length} ===`);
  if (!openShifts || openShifts.length === 0) {
    console.log('✅ Zero open shifts remaining. Database is already clean for tomorrow!');
    return;
  }

  const personnelIds = [...new Set(openShifts.map(s => s.personnel_id))];
  const { data: personnelRows } = await supabase
    .from('personnel')
    .select('id, name, email')
    .in('id', personnelIds);
  const pMap = new Map((personnelRows || []).map(p => [p.id, p]));

  for (const s of openShifts) {
    const p = pMap.get(s.personnel_id);
    console.log(`- Shift ${s.shift_id} | ${p?.name || s.personnel_id} (${p?.email || 'N/A'}) | In: ${s.first_clock_in_at} | Mode: ${s.work_type}`);
  }

  if (!execute) {
    console.log('\n[DRY-RUN] No shifts modified. Pass --execute at 10 PM tonight to close these with 8.00h standard.');
    return;
  }

  console.log('\n=== CLOSING OPEN SHIFTS WITH 8.00h STANDARD ===');
  let closedCount = 0;
  for (const s of openShifts) {
    const p = pMap.get(s.personnel_id);
    const { data, error } = await supabase.rpc('reconcile_shift', {
      p_shift_id: s.shift_id,
      p_payable_hours: 8.0,
      p_overtime_hours: 0.0,
      p_reason: 'Cierre nocturno estándar 8.00h (mantenimiento Pass 14A - inicio limpio)'
    });
    if (error || !data?.success) {
      console.error(`❌ Failed to close ${s.shift_id} (${p?.name}):`, error?.message || data?.error);
    } else {
      console.log(`✅ Closed ${s.shift_id} (${p?.name || s.personnel_id}) -> 8.00h COMPLETED`);
      closedCount++;
    }
  }

  const { data: remaining } = await supabase
    .from('attendance_shifts')
    .select('shift_id')
    .eq('status', 'OPEN');
  console.log(`\nDone: Closed ${closedCount}/${openShifts.length}. Remaining OPEN shifts: ${(remaining || []).length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
