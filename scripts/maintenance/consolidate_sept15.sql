DO $$
DECLARE
    rec RECORD;
    v_primary_id TEXT;
    v_min_in TEXT;
    v_max_out TEXT;
    v_merged_punches JSONB;
BEGIN
    FOR rec IN (
        SELECT personnel_id
        FROM mx_timesheets
        WHERE date = '2026-09-15'
        GROUP BY personnel_id
        HAVING count(*) > 1
    ) LOOP
        -- Select primary row as the one with non-null time_in or smallest id
        SELECT id INTO v_primary_id
        FROM mx_timesheets
        WHERE date = '2026-09-15' AND personnel_id = rec.personnel_id
        ORDER BY (time_in IS NOT NULL) DESC, id ASC
        LIMIT 1;

        -- Get min time_in and max time_out
        SELECT min(time_in), max(time_out)
        INTO v_min_in, v_max_out
        FROM mx_timesheets
        WHERE date = '2026-09-15' AND personnel_id = rec.personnel_id;

        -- Merge all punches
        SELECT jsonb_agg(punch ORDER BY (punch->>'timestamp') ASC)
        INTO v_merged_punches
        FROM (
            SELECT jsonb_array_elements(
                CASE WHEN jsonb_typeof(punches) = 'array' THEN punches ELSE '[]'::jsonb END
            ) AS punch
            FROM mx_timesheets
            WHERE date = '2026-09-15' AND personnel_id = rec.personnel_id
        ) sub;

        -- Update primary row
        UPDATE mx_timesheets
        SET time_in = v_min_in,
            time_out = v_max_out,
            punches = COALESCE(v_merged_punches, '[]'::jsonb),
            hours = CASE 
                WHEN v_min_in IS NOT NULL AND v_max_out IS NOT NULL THEN
                    ROUND(
                        ABS(EXTRACT(EPOCH FROM (v_max_out::time - v_min_in::time)) / 3600.0)::numeric, 
                        2
                    )
                ELSE hours
            END
        WHERE id = v_primary_id;

        -- Delete the non-primary rows
        DELETE FROM mx_timesheets
        WHERE date = '2026-09-15'
          AND personnel_id = rec.personnel_id
          AND id != v_primary_id;

    END LOOP;
END $$;
