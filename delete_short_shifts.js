import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const supabaseKey = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W'; // using service role to bypass RLS

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteShortShifts() {
  const idsToDelete = [
    "99ff2a65-0b1b-4561-8a3c-e394f85d6401",
    "d8c07c7f-fcf8-4dd2-b717-70cc2c353d00",
    "c630f7ae-b6af-4a7f-a853-66a30522f0f2",
    "4f0d19ea-6f67-4ce0-97ee-442ffcf94096"
  ];

  const { data, error } = await supabase
    .from('mx_timesheets')
    .delete()
    .in('id', idsToDelete)
    .select();

  if (error) {
    console.error('Error deleting timesheets:', error);
    return;
  }

  console.log(`Successfully deleted ${data.length} shifts.`);
  console.log('Deleted IDs:', data.map(d => d.id));
}

deleteShortShifts();
