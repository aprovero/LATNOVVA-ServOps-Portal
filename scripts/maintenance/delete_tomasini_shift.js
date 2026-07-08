import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvkkxwtqonjgrvloisid.supabase.co';
const supabaseKey = 'sb_secret_CHbU1u_d3WT4_MHm5ySEKw_CkW1Lo2W'; 

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteShift() {
  const idsToDelete = [
    "7f943b67-f42d-4a6b-bc04-006348fc6ebd"
  ];

  const { data, error } = await supabase
    .from('mx_timesheets')
    .delete()
    .in('id', idsToDelete)
    .select();

  if (error) {
    console.error('Error deleting timesheet:', error);
    return;
  }

  console.log(`Successfully deleted ${data?.length || 0} shift(s).`);
  console.log('Deleted IDs:', data?.map(d => d.id));
}

deleteShift();
