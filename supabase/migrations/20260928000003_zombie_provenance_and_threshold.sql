-- ==============================================================================
-- PASS 12I-C: Zombie Provenance & Strict >14h Threshold Migration
-- Target Project: dvkkxwtqonjgrvloisid (LATNOVVA ServiceTool)
-- Replaces canary membership check with exact child provenance
-- Enforces strict elapsed duration > 14 hours threshold (prevents midnight auto-close)
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_close_stale_mx_timesheets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_closed_count integer := 0;
    rec record;
    v_is_normalized boolean := false;
    v_target_time_out text;
    v_target_timestamp timestamptz;
    v_punch_id uuid;
    v_new_punch_json jsonb;
    v_existing_clockout_count integer := 0;
BEGIN
    -- Iterate over open shifts eligible for auto-close STRICTLY exceeding 14 hours elapsed
    FOR rec IN
        SELECT 
            t.id,
            t.personnel_id,
            t.project_id,
            t.date,
            t.time_in,
            t.notes,
            t.created_at,
            t.punches
        FROM public.mx_timesheets t
        WHERE t.time_in IS NOT NULL
          AND t.time_out IS NULL
          AND (
              (t.created_at IS NOT NULL AND (NOW() - t.created_at) > interval '14 hours')
              OR (
                  t.created_at IS NULL 
                  AND t.date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' 
                  AND t.time_in ~ '^[0-9]{2}:[0-9]{2}$'
                  AND (NOW() - (t.date::text || 'T' || t.time_in || ':00-06:00')::timestamptz) > interval '14 hours'
              )
          )
        FOR UPDATE OF t SKIP LOCKED
    LOOP
        -- Calculate target clockOut time string (8 hours after time_in)
        IF rec.time_in ~ '^[0-9]{2}:[0-9]{2}$' THEN
            v_target_time_out := to_char((rec.time_in::time + interval '8 hours'), 'HH24:MI');
        ELSE 
            v_target_time_out := '17:00';
        END IF;

        -- PROVENANCE RULE: Write model is determined STRICTLY by existing child punches on this timesheet
        -- Do NOT use canary membership alone to reinterpret an existing legacy parent as normalized.
        SELECT EXISTS (
            SELECT 1 FROM public.mx_timesheet_punches p
            WHERE p.timesheet_id = rec.id
        ) INTO v_is_normalized;

        IF v_is_normalized THEN
            -- Check idempotency: make sure no clockOut child punch already exists
            SELECT COUNT(*) INTO v_existing_clockout_count
            FROM public.mx_timesheet_punches
            WHERE timesheet_id = rec.id AND type = 'clockOut';

            IF v_existing_clockout_count = 0 THEN
                v_punch_id := gen_random_uuid();
                
                -- Construct target timestamp (Mexico City time zone / -06:00 offset or created_at)
                IF rec.created_at IS NOT NULL THEN
                    v_target_timestamp := rec.created_at + interval '8 hours';
                ELSIF rec.date::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND rec.time_in ~ '^[0-9]{2}:[0-9]{2}$' THEN
                    v_target_timestamp := (rec.date::text || 'T' || rec.time_in || ':00-06:00')::timestamptz + interval '8 hours';
                ELSE
                    v_target_timestamp := NOW();
                END IF;

                -- Insert normalized zombie clockOut child punch
                INSERT INTO public.mx_timesheet_punches (
                    id,
                    timesheet_id,
                    personnel_id,
                    project_id,
                    type,
                    timestamp,
                    is_zombie_close,
                    created_at,
                    updated_at
                ) VALUES (
                    v_punch_id,
                    rec.id,
                    rec.personnel_id,
                    CASE WHEN rec.project_id ~ '^[0-9a-fA-F-]{36}$' THEN rec.project_id::uuid ELSE NULL END,
                    'clockOut',
                    v_target_timestamp,
                    true,
                    NOW(),
                    NOW()
                );

                -- Build updated legacy JSON projection
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', p.id,
                        'type', p.type,
                        'timestamp', p.timestamp,
                        'workMode', p.work_mode,
                        'time', to_char(p.timestamp AT TIME ZONE 'America/Mexico_City', 'HH24:MI'),
                        'isZombieClose', COALESCE(p.is_zombie_close, false)
                    ) ORDER BY p.timestamp ASC
                ), '[]'::jsonb)
                INTO v_new_punch_json
                FROM public.mx_timesheet_punches p
                WHERE p.timesheet_id = rec.id;

                -- Update parent timesheet with scalar 8h credit and legacy JSON projection
                UPDATE public.mx_timesheets
                SET 
                    time_out = v_target_time_out,
                    hours = 8.0,
                    status = 'Pending',
                    notes = CASE 
                        WHEN rec.notes IS NULL OR rec.notes = '' THEN 'System: Auto closed (>14h) - 8h acreditadas'
                        ELSE rec.notes || ' | System: Auto closed (>14h) - 8h acreditadas'
                    END,
                    punches = v_new_punch_json,
                    updated_at = NOW()
                WHERE id = rec.id;

                v_closed_count := v_closed_count + 1;
            END IF;
        ELSE
            -- Legacy user path / Legacy parent path: scalar update on mx_timesheets
            UPDATE public.mx_timesheets
            SET 
                time_out = v_target_time_out,
                hours = 8.0,
                status = 'Pending',
                notes = CASE 
                    WHEN rec.notes IS NULL OR rec.notes = '' THEN 'System: Auto closed (>14h) - 8h acreditadas'
                    ELSE rec.notes || ' | System: Auto closed (>14h) - 8h acreditadas'
                END,
                updated_at = NOW()
            WHERE id = rec.id;

            v_closed_count := v_closed_count + 1;
        END IF;
    END LOOP;

    IF v_closed_count > 0 THEN
        RAISE NOTICE '[auto_close_stale_mx_timesheets] Se cerraron % turnos (>14h provenance-based).', v_closed_count;
    END IF;

    RETURN v_closed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_close_stale_mx_timesheets() TO authenticated, service_role;

COMMIT;
