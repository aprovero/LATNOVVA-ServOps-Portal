import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const supabaseKey = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W'; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectShifts() {
  // First find the personnel_id for "TOMASINI ANZA ALEJANDRO"
  const { data: personnel, error: pError } = await supabase
    .from('personnel')
    .select('id, name')
    .ilike('name', '%TOMASINI%');

  if (pError || !personnel || personnel.length === 0) {
    console.error('Error finding personnel:', pError || 'Not found');
    return;
  }

  const pId = personnel[0].id;
  console.log('Found personnel:', personnel[0]);

  const { data: timesheets, error } = await supabase
    .from('mx_timesheets')
    .select('*')
    .eq('personnel_id', pId)
    .eq('date', '2026-06-15');

  if (error) {
    console.error('Error fetching timesheets:', error);
    return;
  }

  console.log(`\n======================================`);
  console.log(`Found ${timesheets.length} shifts for ${personnel[0].name} on 2026-06-15.`);
  console.log(`======================================\n`);
  console.log(JSON.stringify(timesheets, null, 2));
}

inspectShifts();
