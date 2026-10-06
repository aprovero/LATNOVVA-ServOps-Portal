-- ============================================================================
-- PASS 12N: Mandatory Release Gate + Canary Server Write Boundary
-- Target Project: dvkkxwtqonjgrvloisid (LATNOVVA ServiceTool)
-- ============================================================================

BEGIN;

-- 1. Extend platform_settings with required_client_release
ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS required_client_release INTEGER DEFAULT 43;

UPDATE public.platform_settings
SET required_client_release = 43,
    minimum_client_version = '5.0.3',
    minimum_client_version_enabled = true,
    minimum_client_version_effective_at = NOW()
WHERE id = 'global';

-- 2. Authoritative get_client_bootstrap_config returning required_client_release
CREATE OR REPLACE FUNCTION public.get_client_bootstrap_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT minimum_client_version, minimum_client_version_effective_at, minimum_client_version_enabled,
           required_password_policy_version, password_rotation_effective_at, password_rotation_enabled,
           required_client_release
    INTO v_rec
    FROM public.platform_settings WHERE id = 'global';

    RETURN jsonb_build_object(
        'minimum_client_version', COALESCE(v_rec.minimum_client_version, '5.0.3'),
        'minimum_client_version_effective_at', v_rec.minimum_client_version_effective_at,
        'minimum_client_version_enabled', COALESCE(v_rec.minimum_client_version_enabled, true),
        'required_client_release', COALESCE(v_rec.required_client_release, 43),
        'required_password_policy_version', COALESCE(v_rec.required_password_policy_version, 1),
        'password_rotation_effective_at', v_rec.password_rotation_effective_at,
        'password_rotation_enabled', COALESCE(v_rec.password_rotation_enabled, true)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_bootstrap_config() TO anon, authenticated, public;

-- 3. Update record_clock_punch to set local transaction context flag
-- Sets attendance.in_record_clock_punch = 'true' so legacy projection write is allowed
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
    -- Set session flag local to transaction to allow projection writes
    PERFORM set_config('attendance.in_record_clock_punch', 'true', true);

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
        created_at
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
        p_manual_adjustment,
        p_adjustment_reason,
        p_adjustment_note,
        p_face_verified,
        p_face_bypass_reason,
        p_is_outsourced,
        p_outsourced_name,
        p_is_zombie_close,
        p_gps_verified,
        p_selfie_url,
        NOW()
    );

    -- Build shadow punches JSON
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'timestamp', p.timestamp,
            'type', p.type,
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
            'gpsVerified', p.gps_verified,
            'selfieUrl', p.selfie_url
        ) ORDER BY p.timestamp ASC
    ), '[]'::jsonb) INTO v_punches_json
    FROM public.mx_timesheet_punches p
    WHERE p.timesheet_id = v_timesheet_id;

    v_time_str := TO_CHAR(p_timestamp AT TIME ZONE 'UTC', 'HH24:MI');

    IF p_type = 'clockIn' THEN
        UPDATE public.mx_timesheets SET
            time_in = COALESCE(time_in, v_time_str),
            punches = v_punches_json,
            gps_verified = p_gps_verified,
            updated_at = NOW()
        WHERE id = v_timesheet_id;
    ELSIF p_type = 'clockOut' THEN
        IF p_is_zombie_close OR v_is_forgotten THEN
            v_calculated_hours := 8.00;
        ELSE
            SELECT * INTO v_clock_in_punch
            FROM public.mx_timesheet_punches
            WHERE timesheet_id = v_timesheet_id AND type = 'clockIn'
            ORDER BY timestamp ASC LIMIT 1;

            IF FOUND THEN
                v_calculated_hours := ROUND(
                    EXTRACT(EPOCH FROM (p_timestamp - v_clock_in_punch.timestamp)) / 3600.0,
                    2
                );
            ELSE
                v_calculated_hours := 0.00;
            END IF;
        END IF;

        UPDATE public.mx_timesheets SET
            time_out = v_time_str,
            hours = v_calculated_hours,
            punches = v_punches_json,
            status = 'Pending',
            notes = CASE 
                WHEN p_adjustment_reason = 'FORGOTTEN_CLOCKOUT' THEN 
                    COALESCE(notes || ' | ', '') || 'Salida registrada: ' || COALESCE(p_adjustment_note, 'FORGOTTEN_CLOCKOUT')
                ELSE notes
            END,
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

-- 4. Server-Side Canary Write Boundary Trigger on mx_timesheets
CREATE OR REPLACE FUNCTION public.enforce_canary_normalized_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_personnel_id TEXT;
    v_is_canary BOOLEAN := FALSE;
    v_in_record_clock_punch TEXT;
    v_role TEXT;
BEGIN
    -- Context Check: If executing inside record_clock_punch or auto_close projection, allow
    v_in_record_clock_punch := current_setting('attendance.in_record_clock_punch', true);
    IF v_in_record_clock_punch = 'true' THEN
        RETURN NEW;
    END IF;

    -- Allow service_role bypass
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Resolve authoritative personnel ID for current caller
    v_caller_personnel_id := public.get_authoritative_personnel_id();

    -- If caller identity is completely unresolved
    IF v_caller_personnel_id IS NULL THEN
        -- If the target record belongs to an active canary, block unauthenticated/unresolved mutation
        IF EXISTS (SELECT 1 FROM public.mx_normalized_punch_canary WHERE personnel_id = NEW.personnel_id) THEN
            RAISE EXCEPTION 'CANARY_NORMALIZED_WRITE_REQUIRED';
        END IF;
        RETURN NEW;
    END IF;

    -- Check if target employee or caller is an active canary
    SELECT EXISTS (
        SELECT 1 FROM public.mx_normalized_punch_canary
        WHERE personnel_id = NEW.personnel_id OR personnel_id = v_caller_personnel_id
    ) INTO v_is_canary;

    IF v_is_canary THEN
        -- Check if caller is supervisor/admin performing an approved management correction on another employee
        IF v_caller_personnel_id != NEW.personnel_id THEN
            SELECT role INTO v_role FROM public.mx_personnel WHERE id = v_caller_personnel_id;
            IF v_role IN ('Admin', 'Director', 'Supervisor', 'HR', 'Gerente', 'Directivo') THEN
                RETURN NEW; -- Authorized supervisor correction
            END IF;
        END IF;

        -- Direct legacy mutation by canary worker is unconditionally DENIED
        RAISE EXCEPTION 'CANARY_NORMALIZED_WRITE_REQUIRED';
    END IF;

    -- Non-canary (Legacy control) is allowed
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_canary_normalized_writes ON public.mx_timesheets;
CREATE TRIGGER trg_enforce_canary_normalized_writes
BEFORE INSERT OR UPDATE ON public.mx_timesheets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_canary_normalized_writes();

COMMIT;
