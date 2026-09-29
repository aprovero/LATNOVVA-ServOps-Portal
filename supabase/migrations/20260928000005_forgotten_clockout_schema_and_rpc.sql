-- ============================================================================
-- PASS 12J-F: Forgotten ClockOut Machine-Readable Exception Schema & RPC Contract
-- Target Project: dvkkxwtqonjgrvloisid (LATNOVVA ServiceTool)
-- ============================================================================

BEGIN;

-- 1. Add adjustment_reason column to mx_timesheet_punches if missing
ALTER TABLE public.mx_timesheet_punches
  ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;

-- 2. Drop existing record_clock_punch function to avoid parameter overload conflicts
DROP FUNCTION IF EXISTS public.record_clock_punch CASCADE;

-- 3. Update record_clock_punch RPC function to accept p_adjustment_reason and persist machine-readable exception
CREATE OR REPLACE FUNCTION public.record_clock_punch(
    p_punch_id UUID,
    p_timestamp TIMESTAMPTZ,
    p_type VARCHAR(30),
    p_date DATE,
    p_target_personnel_id TEXT,
    p_timesheet_id TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_work_mode VARCHAR(20) DEFAULT 'On Site',
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    p_accuracy REAL DEFAULT NULL,
    p_time_source VARCHAR(10) DEFAULT 'device',
    p_manual_adjustment BOOLEAN DEFAULT FALSE,
    p_adjustment_reason TEXT DEFAULT NULL,
    p_adjustment_note TEXT DEFAULT NULL,
    p_face_verified BOOLEAN DEFAULT FALSE,
    p_face_bypass_reason TEXT DEFAULT NULL,
    p_is_outsourced BOOLEAN DEFAULT FALSE,
    p_outsourced_name TEXT DEFAULT NULL,
    p_is_zombie_close BOOLEAN DEFAULT FALSE,
    p_gps_verified BOOLEAN DEFAULT FALSE,
    p_selfie_url TEXT DEFAULT NULL,
    p_selfie_blob TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_auth_uid UUID;
    v_caller_personnel_id TEXT;
    v_target_personnel RECORD;
    v_timesheet_id TEXT;
    v_existing_timesheet RECORD;
    v_existing_punch RECORD;
    v_is_idempotent_retry BOOLEAN := FALSE;
    v_punches_json JSONB;
    v_time_str TEXT;
    v_calculated_hours NUMERIC(5,2);
    v_clock_in_punch RECORD;
    v_is_forgotten BOOLEAN := FALSE;
BEGIN
    v_caller_auth_uid := auth.uid();

    -- Check if punch already exists for idempotency
    SELECT * INTO v_existing_punch
    FROM public.mx_timesheet_punches
    WHERE id = p_punch_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'punch_id', v_existing_punch.id,
            'timesheet_id', v_existing_punch.timesheet_id,
            'idempotent_retry', true
        );
    END IF;

    -- Verify target personnel exists
    SELECT id, subsidiary INTO v_target_personnel
    FROM public.mx_personnel
    WHERE id = p_target_personnel_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target personnel % does not exist.', p_target_personnel_id;
    END IF;

    v_is_forgotten := (p_adjustment_reason = 'FORGOTTEN_CLOCKOUT') OR (p_adjustment_note IS NOT NULL AND p_adjustment_note LIKE '%Olvidé registrar mi salida%');

    -- Resolve or create parent timesheet
    IF p_timesheet_id IS NOT NULL THEN
        v_timesheet_id := p_timesheet_id;
        SELECT * INTO v_existing_timesheet FROM public.mx_timesheets WHERE id = v_timesheet_id;
    END IF;

    IF v_existing_timesheet.id IS NULL THEN
        -- Find existing open shift for target on date
        SELECT * INTO v_existing_timesheet
        FROM public.mx_timesheets
        WHERE personnel_id = p_target_personnel_id
          AND date = p_date
          AND time_out IS NULL
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_timesheet_id := v_existing_timesheet.id;
        ELSE
            IF p_type = 'clockOut' THEN
                -- Find any open shift
                SELECT * INTO v_existing_timesheet
                FROM public.mx_timesheets
                WHERE personnel_id = p_target_personnel_id
                  AND time_out IS NULL
                ORDER BY date DESC, created_at DESC
                LIMIT 1;

                IF FOUND THEN
                    v_timesheet_id := v_existing_timesheet.id;
                ELSE
                    v_timesheet_id := COALESCE(p_timesheet_id, gen_random_uuid()::text);
                END IF;
            ELSE
                v_timesheet_id := COALESCE(p_timesheet_id, gen_random_uuid()::text);
            END IF;
        END IF;
    END IF;

    -- Ensure parent timesheet exists
    INSERT INTO public.mx_timesheets (
        id, personnel_id, project_id, date, type, status, created_at, updated_at
    ) VALUES (
        v_timesheet_id,
        p_target_personnel_id,
        p_project_id,
        p_date,
        p_work_mode,
        'Pending',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        project_id = COALESCE(public.mx_timesheets.project_id, EXCLUDED.project_id),
        updated_at = NOW();

    -- Insert normalized child punch
    INSERT INTO public.mx_timesheet_punches (
        id,
        timesheet_id,
        personnel_id,
        project_id,
        timestamp,
        type,
        work_mode,
        lat,
        lng,
        accuracy,
        time_source,
        manual_adjustment,
        adjustment_reason,
        adjustment_note,
        face_verified,
        face_bypass_reason,
        is_outsourced,
        outsourced_name,
        is_zombie_close,
        gps_verified,
        selfie_url,
        created_at,
        updated_at
    ) VALUES (
        p_punch_id,
        v_timesheet_id,
        p_target_personnel_id,
        p_project_id,
        p_timestamp,
        p_type,
        p_work_mode,
        p_lat,
        p_lng,
        p_accuracy,
        p_time_source,
        COALESCE(p_manual_adjustment, v_is_forgotten),
        p_adjustment_reason,
        p_adjustment_note,
        p_face_verified,
        p_face_bypass_reason,
        p_is_outsourced,
        p_outsourced_name,
        p_is_zombie_close,
        CASE WHEN v_is_forgotten THEN FALSE ELSE p_gps_verified END,
        p_selfie_url,
        NOW(),
        NOW()
    );

    -- Build updated legacy JSON projection of punches
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'type', p.type,
            'timestamp', p.timestamp,
            'workMode', p.work_mode,
            'lat', p.lat,
            'lng', p.lng,
            'accuracy', p.accuracy,
            'timeSource', p.time_source,
            'manualAdjustment', p.manual_adjustment,
            'adjustmentReason', p.adjustment_reason,
            'adjustmentNote', p.adjustment_note,
            'faceVerified', p.face_verified,
            'faceBypassReason', p.face_bypass_reason,
            'isOutsourced', p.is_outsourced,
            'outsourcedName', p.outsourced_name,
            'isZombieClose', p.is_zombie_close,
            'gpsVerified', p.gps_verified
        ) ORDER BY p.timestamp ASC
    ) INTO v_punches_json
    FROM public.mx_timesheet_punches p
    WHERE p.timesheet_id = v_timesheet_id;

    v_time_str := to_char(p_timestamp AT TIME ZONE 'America/Mexico_City', 'HH24:MI');

    -- Calculate parent timesheet updates
    IF p_type = 'clockIn' THEN
        UPDATE public.mx_timesheets
        SET time_in = COALESCE(time_in, v_time_str),
            punches = v_punches_json,
            updated_at = NOW()
        WHERE id = v_timesheet_id;
    ELSIF p_type = 'clockOut' THEN
        -- Find clockIn punch to compute hours
        SELECT * INTO v_clock_in_punch
        FROM public.mx_timesheet_punches
        WHERE timesheet_id = v_timesheet_id AND type = 'clockIn'
        ORDER BY timestamp ASC
        LIMIT 1;

        IF p_is_zombie_close OR v_is_forgotten THEN
            v_calculated_hours := 8.00;
        ELSIF v_clock_in_punch.id IS NOT NULL THEN
            v_calculated_hours := ROUND(EXTRACT(EPOCH FROM (p_timestamp - v_clock_in_punch.timestamp)) / 3600.0, 2);
        ELSE
            v_calculated_hours := 8.00;
        END IF;

        UPDATE public.mx_timesheets
        SET time_out = v_time_str,
            hours = v_calculated_hours,
            status = 'Pending',
            source = CASE WHEN v_is_forgotten THEN 'manual' ELSE source END,
            manual_reason = CASE WHEN v_is_forgotten THEN 'FORGOTTEN_CLOCKOUT' ELSE manual_reason END,
            gps_verified = CASE WHEN v_is_forgotten THEN FALSE ELSE gps_verified END,
            notes = CASE
                WHEN p_adjustment_note IS NOT NULL THEN
                    CASE WHEN notes IS NULL OR notes = '' THEN p_adjustment_note ELSE notes || ' | ' || p_adjustment_note END
                ELSE notes
            END,
            punches = v_punches_json,
            updated_at = NOW()
        WHERE id = v_timesheet_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'punch_id', p_punch_id,
        'timesheet_id', v_timesheet_id,
        'idempotent_retry', false
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_clock_punch TO authenticated, service_role;

COMMIT;
