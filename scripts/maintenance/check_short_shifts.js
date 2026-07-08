import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const supabaseKey = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W'; // using service role to bypass RLS

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShortShifts() {
  const { data: timesheets, error } = await supabase
    .from('mx_timesheets')
    .select('id, personnel_id, date, time_in, time_out, hours');

  if (error) {
    console.error('Error fetching timesheets:', error);
    return;
  }

  if (!timesheets) {
    console.log('No timesheets found.');
    return;
  }

  let shortShifts = 0;
  let shortShiftsDetails = [];

  timesheets.forEach(t => {
    if (t.time_in && t.time_out) {
      const [inH, inM] = t.time_in.split(':').map(Number);
      const [outH, outM] = t.time_out.split(':').map(Number);
      
      let inMins = inH * 60 + inM;
      let outMins = outH * 60 + outM;
      
      // handle crossing midnight if outMins < inMins
      if (outMins < inMins) outMins += 24 * 60;
      
      const diffMins = outMins - inMins;
      
      if (diffMins < 3 && diffMins >= 0) {
        shortShifts++;
        shortShiftsDetails.push(t);
      }
    }
  });

  console.log(`\n======================================`);
  console.log(`Found ${shortShifts} shifts less than 3 minutes out of ${timesheets.length} total shifts.`);
  console.log(`======================================\n`);
  if (shortShifts > 0) {
      console.log('Sample of short shifts:');
      console.log(JSON.stringify(shortShiftsDetails.slice(0, 5), null, 2));
  }
}

checkShortShifts();
