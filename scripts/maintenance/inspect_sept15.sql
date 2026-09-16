SELECT id, personnel_id, time_in, time_out, jsonb_array_length(CASE WHEN jsonb_typeof(punches) = 'array' THEN punches ELSE '[]'::jsonb END) as punch_count
FROM mx_timesheets
WHERE date = '2026-09-15'
ORDER BY personnel_id, id;
