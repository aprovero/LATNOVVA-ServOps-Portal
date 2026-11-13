-- ============================================================================
-- PASS 13J: COMPLETE AUTOMATED PRODUCTION CUTOVER BUNDLE
-- Target: Supabase dvkkxwtqonjgrvloisid
-- Scheduled Window: Saturday 2026-10-17 03:00 America/Mexico_City
-- ============================================================================

-- STEP 1: PHASE A - FREEZE NEW LEGACY CLOCKINS
-- ============================================================================
-- PASS 13J: PHASE A - FREEZE NEW LEGACY CLOCK-INS ONLY
-- Target: Supabase dvkkxwtqonjgrvloisid
-- Allows existing open shifts to clock out cleanly.
-- Blocks all new legacy shift creation.
-- ============================================================================

BEGIN;

-- 1. Create legacy ClockIn guard trigger function on mx_timesheets
CREATE OR REPLACE FUNCTION public.trg_fn_freeze_legacy_clockin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Allow service_role bypass
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Block direct INSERT into mx_timesheets
    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'LEGACY_CLOCKIN_FROZEN: Attendance authority is transitioning to V2. New legacy shifts are disabled. Please update application to Release 50.';
    END IF;

    -- On UPDATE: only allow setting time_out when closing an already open shift (NULL, blank, or whitespace)
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.time_out IS NULL OR trim(OLD.time_out) = '') AND NEW.time_out IS NOT NULL AND trim(NEW.time_out) <> '' THEN
            RETURN NEW; -- Allowed: ClockOut or Cutover Auto-Close closing existing open shift
        END IF;
        IF NEW.time_in IS DISTINCT FROM OLD.time_in THEN
            RAISE EXCEPTION 'LEGACY_CLOCKIN_FROZEN: Editing time_in is disabled during cutover.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_legacy_clockin ON public.mx_timesheets;
CREATE TRIGGER trg_freeze_legacy_clockin
BEFORE INSERT OR UPDATE ON public.mx_timesheets
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_freeze_legacy_clockin();

-- 2. Guard record_clock_punch against p_type = 'clockIn'
-- Updates record_clock_punch to reject new ClockIns with error LEGACY_CLOCKIN_FROZEN
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
    v_target_personnel RECORD;
    v_timesheet_id TEXT;
    v_existing_timesheet RECORD;
    v_existing_punch RECORD;
    v_punches_json JSONB;
    v_time_str TEXT;
    v_calculated_hours NUMERIC(5,2);
    v_clock_in_punch RECORD;
    v_is_forgotten BOOLEAN := FALSE;
BEGIN
    -- PHASE A ENFORCEMENT: Fail closed on new legacy ClockIns
    IF p_type = 'clockIn' THEN
        RAISE EXCEPTION 'LEGACY_CLOCKIN_FROZEN: New legacy ClockIns are disabled. Please update to Release 50 and use Attendance V2.';
    END IF;

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

    -- Resolve parent timesheet for ClockOut
    IF p_timesheet_id IS NOT NULL THEN
        v_timesheet_id := p_timesheet_id;
        SELECT * INTO v_existing_timesheet FROM public.mx_timesheets WHERE id = v_timesheet_id;
    END IF;

    IF v_existing_timesheet.id IS NULL THEN
        -- Find existing open shift for target
        SELECT * INTO v_existing_timesheet
        FROM public.mx_timesheets
        WHERE personnel_id = p_target_personnel_id
          AND time_out IS NULL
        ORDER BY date DESC, created_at DESC
        LIMIT 1;

        IF FOUND THEN
            v_timesheet_id := v_existing_timesheet.id;
        ELSE
            RAISE EXCEPTION 'NO_OPEN_SHIFT_FOUND: Cannot clock out because no open shift exists for personnel %.', p_target_personnel_id;
        END IF;
    END IF;

    -- Insert child punch for ClockOut
    INSERT INTO public.mx_timesheet_punches (
        id, timesheet_id, personnel_id, project_id, timestamp, type, work_mode,
        lat, lng, accuracy, time_source, manual_adjustment, adjustment_reason,
        adjustment_note, face_verified, face_bypass_reason, is_outsourced,
        outsourced_name, is_zombie_close, gps_verified, selfie_url, created_at
    ) VALUES (
        p_punch_id, v_timesheet_id, p_target_personnel_id, p_project_id, p_timestamp,
        p_type, p_work_mode, p_lat, p_lng, p_accuracy, p_time_source, p_manual_adjustment,
        p_adjustment_reason, p_adjustment_note, p_face_verified, p_face_bypass_reason,
        p_is_outsourced, p_outsourced_name, p_is_zombie_close, p_gps_verified, p_selfie_url, NOW()
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

    RETURN jsonb_build_object(
        'success', true,
        'punch_id', p_punch_id,
        'timesheet_id', v_timesheet_id,
        'idempotent_retry', false
    );
END;
$$;

COMMIT;


-- STEP 2: INSTALL CUTOVER AUTO-CLOSURE FUNCTION
-- ============================================================================
-- PASS 13J (SECTIONS 14A-14E): FINAL LEGACY OPEN-SHIFT AUTO-CLOSURE AT CUTOVER
-- Target: Supabase dvkkxwtqonjgrvloisid
-- Executes immediately after Phase A (legacy ClockIn freeze) and before the
-- Hardened Zero-Open Gate & Phase B Complete Freeze.
--
-- BUSINESS RULE & ELIGIBILITY:
-- 1. All legitimate Friday (<= 2026-10-16) office/day shifts should have ended
--    by 18:00 America/Mexico_City.
-- 2. At the 03:00 Saturday cutover, any remaining genuine Friday open shift
--    (time_out IS NULL, blank '', or whitespace-only) is treated as a missed
--    ClockOut regardless of whether <14h have elapsed.
-- 3. DO NOT auto-close:
--    - Any shift whose start date/time indicates Saturday (>= 2026-10-17)
--    - Any record that cannot be confidently identified as a genuine open
--      attendance shift (missing personnel_id, non-existent personnel, NULL date,
--      or missing/unparseable time_in)
--    - Corrupted/malformed data whose intended attendance state cannot be determined
-- 4. Semantics match authoritative stale/zombie shift closure:
--    - Original ClockIn evidence preserved
--    - SYSTEM-generated closure (NOT a normal worker ClockOut)
--    - Payable hours = 8.00, automatic overtime = 0
--    - Review/audit state preserved (status = 'Pending', zombie review flag active)
--    - Closure reason: SYSTEM_CUTOVER_STALE_SHIFT_RECONCILIATION
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cutover_auto_close_open_mx_timesheets(
    p_max_eligible_date DATE DEFAULT DATE '2026-10-26'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_open_found INT := 0;
    v_auto_closed INT := 0;
    v_failures INT := 0;
    v_ineligible_skipped INT := 0;
    v_review_flags INT := 0;
    v_open_after INT := 0;
    rec RECORD;
    v_is_normalized BOOLEAN := FALSE;
    v_target_time_out TEXT;
    v_target_timestamp TIMESTAMPTZ;
    v_punch_id UUID;
    v_new_punch_json JSONB;
    v_existing_clockout_count INT := 0;
    v_closure_reason CONSTANT TEXT := 'SYSTEM_CUTOVER_STALE_SHIFT_RECONCILIATION';
    v_closure_note CONSTANT TEXT := 'System: Auto closed (PASS 13J cutover stale-shift reconciliation) - 8h acreditadas';
BEGIN
    -- Allow system auto-close projection updates past canary boundary trigger
    PERFORM set_config('attendance.in_record_clock_punch', 'true', true);

    -- 1. Count all unresolved/open legacy shifts at cutover (NULL, blank, or whitespace time_out)
    SELECT count(*) INTO v_open_found
    FROM public.mx_timesheets t
    WHERE t.time_out IS NULL OR trim(t.time_out) = '';

    -- 2. Iterate over all open/unresolved legacy shifts
    FOR rec IN
        SELECT
            t.id,
            t.personnel_id,
            t.project_id,
            t.date,
            t.time_in,
            t.time_out,
            t.notes,
            t.status,
            t.source,
            t.manual_reason,
            t.created_at,
            t.punches
        FROM public.mx_timesheets t
        WHERE t.time_out IS NULL OR trim(t.time_out) = ''
        ORDER BY t.date ASC NULLS LAST, t.created_at ASC NULLS LAST
        FOR UPDATE OF t SKIP LOCKED
    LOOP
        -- ---------------------------------------------------------------------
        -- SECTION 14C ELIGIBILITY GUARDS:
        -- Do NOT automatically close:
        -- 1) A shift whose start date/time indicates it began on Saturday after Phase A
        -- 2) A record that cannot be confidently identified as a genuine open shift
        -- 3) Corrupted/malformed data whose intended state cannot be determined
        -- ---------------------------------------------------------------------
        IF rec.id IS NULL
           OR rec.personnel_id IS NULL
           OR trim(rec.personnel_id) = ''
           OR NOT EXISTS (SELECT 1 FROM public.mx_personnel mp WHERE mp.id = rec.personnel_id)
           OR rec.date IS NULL
           OR rec.date > p_max_eligible_date
           OR (
               rec.created_at IS NOT NULL
               AND (rec.created_at AT TIME ZONE 'America/Mexico_City')::date > p_max_eligible_date
           )
           OR rec.time_in IS NULL
           OR trim(rec.time_in) = ''
           OR NOT (trim(rec.time_in) ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$')
        THEN
            v_ineligible_skipped := v_ineligible_skipped + 1;
            CONTINUE;
        END IF;

        BEGIN
            -- Canonical 8-hour system auto-close time_out representation (matches auto_close_stale_mx_timesheets)
            v_target_time_out := to_char((trim(rec.time_in)::time + interval '8 hours'), 'HH24:MI');

            -- PROVENANCE RULE (PASS 12I-C): Determine if normalized child punches exist for this timesheet
            SELECT EXISTS (
                SELECT 1 FROM public.mx_timesheet_punches p
                WHERE p.timesheet_id = rec.id
            ) INTO v_is_normalized;

            IF v_is_normalized THEN
                -- Verify idempotency on child clockOut punch
                SELECT count(*) INTO v_existing_clockout_count
                FROM public.mx_timesheet_punches p
                WHERE p.timesheet_id = rec.id AND p.type = 'clockOut';

                IF v_existing_clockout_count = 0 THEN
                    v_punch_id := gen_random_uuid();

                    IF rec.created_at IS NOT NULL THEN
                        v_target_timestamp := rec.created_at + interval '8 hours';
                    ELSE
                        v_target_timestamp := (rec.date::text || 'T' || trim(rec.time_in) || ':00-06:00')::timestamptz + interval '8 hours';
                    END IF;

                    INSERT INTO public.mx_timesheet_punches (
                        id,
                        timesheet_id,
                        personnel_id,
                        project_id,
                        type,
                        timestamp,
                        work_mode,
                        manual_adjustment,
                        adjustment_reason,
                        adjustment_note,
                        face_verified,
                        gps_verified,
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
                        'On Site',
                        false,
                        v_closure_reason,
                        v_closure_note,
                        false,
                        false,
                        true,
                        NOW(),
                        NOW()
                    );
                END IF;

                -- Rebuild shadow punches JSON preserving all original ClockIn evidence + system zombie closure
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', p.id,
                        'type', p.type,
                        'timestamp', p.timestamp,
                        'time', to_char(p.timestamp AT TIME ZONE 'America/Mexico_City', 'HH24:MI'),
                        'workMode', p.work_mode,
                        'lat', p.lat,
                        'lng', p.lng,
                        'accuracy', p.accuracy,
                        'timeSource', COALESCE(p.time_source, CASE WHEN p.is_zombie_close THEN 'system' ELSE 'device' END),
                        'manualAdjustment', COALESCE(p.manual_adjustment, false),
                        'adjustmentReason', p.adjustment_reason,
                        'adjustmentNote', p.adjustment_note,
                        'faceVerified', COALESCE(p.face_verified, false),
                        'faceBypassReason', p.face_bypass_reason,
                        'isOutsourced', COALESCE(p.is_outsourced, false),
                        'outsourcedName', p.outsourced_name,
                        'isZombieClose', COALESCE(p.is_zombie_close, false),
                        'gpsVerified', COALESCE(p.gps_verified, false),
                        'selfieUrl', p.selfie_url
                    ) ORDER BY p.timestamp ASC
                ), '[]'::jsonb)
                INTO v_new_punch_json
                FROM public.mx_timesheet_punches p
                WHERE p.timesheet_id = rec.id;

                UPDATE public.mx_timesheets
                SET
                    time_out = v_target_time_out,
                    hours = 8.00,
                    status = 'Pending',
                    manual_reason = COALESCE(rec.manual_reason, v_closure_reason),
                    notes = CASE
                        WHEN rec.notes IS NULL OR trim(rec.notes) = '' THEN v_closure_note
                        WHEN rec.notes LIKE '%' || v_closure_note || '%' THEN rec.notes
                        ELSE rec.notes || ' | ' || v_closure_note
                    END,
                    punches = v_new_punch_json,
                    updated_at = NOW()
                WHERE id = rec.id;
            ELSE
                -- Legacy parent path: preserve original rec.punches ClockIn evidence intact
                -- Do NOT fabricate a worker-reported clockOut punch in rec.punches; record system zombie closure on parent
                UPDATE public.mx_timesheets
                SET
                    time_out = v_target_time_out,
                    hours = 8.00,
                    status = 'Pending',
                    manual_reason = COALESCE(rec.manual_reason, v_closure_reason),
                    notes = CASE
                        WHEN rec.notes IS NULL OR trim(rec.notes) = '' THEN v_closure_note
                        WHEN rec.notes LIKE '%' || v_closure_note || '%' THEN rec.notes
                        ELSE rec.notes || ' | ' || v_closure_note
                    END,
                    updated_at = NOW()
                WHERE id = rec.id;
            END IF;

            v_auto_closed := v_auto_closed + 1;
            v_review_flags := v_review_flags + 1;
        EXCEPTION
            WHEN OTHERS THEN
                v_failures := v_failures + 1;
                RAISE WARNING '[cutover_auto_close_open_mx_timesheets] Failed to auto-close timesheet %: %', rec.id, SQLERRM;
        END;
    END LOOP;

    -- 3. Recount remaining unresolved/open shifts after reconciliation
    SELECT count(*) INTO v_open_after
    FROM public.mx_timesheets t
    WHERE t.time_out IS NULL OR trim(t.time_out) = '';

    RETURN jsonb_build_object(
        'open_shifts_found_at_cutover', v_open_found,
        'auto_closed', v_auto_closed,
        'auto_closure_failures', v_failures,
        'ineligible_or_malformed_skipped', v_ineligible_skipped,
        'payroll_treatment', '8.00h / 0 automatic OT expected',
        'review_flags_created', v_review_flags,
        'open_shifts_after_reconciliation', v_open_after
    );
END;
$$;

REVOKE ALL ON FUNCTION public.cutover_auto_close_open_mx_timesheets(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cutover_auto_close_open_mx_timesheets(DATE) TO authenticated, service_role;

COMMIT;


-- STEP 3: EXECUTE CUTOVER AUTO-CLOSURE ON OPEN FRIDAY SHIFTS
SELECT public.cutover_auto_close_open_mx_timesheets(DATE '2026-10-26');

-- STEP 4: ENFORCE HARDENED ZERO-OPEN LEGACY GATE
-- ============================================================================
-- PASS 13J: HARDENED ZERO-OPEN LEGACY ATTENDANCE GATE
-- Target: Supabase dvkkxwtqonjgrvloisid
-- Precondition for Phase B Complete Freeze & V2 Activation.
-- Cutover proceeds ONLY when total_unresolved_count = 0.
-- ============================================================================

-- 1. Detailed Diagnostic Breakdown Query
WITH 
open_null AS (
    SELECT id, personnel_id, date, time_in, time_out, 'NULL_TIMEOUT' AS issue
    FROM public.mx_timesheets
    WHERE time_out IS NULL
),
open_blank AS (
    SELECT id, personnel_id, date, time_in, time_out, 'BLANK_TIMEOUT' AS issue
    FROM public.mx_timesheets
    WHERE time_out IS NOT NULL AND time_out = ''
),
open_whitespace AS (
    SELECT id, personnel_id, date, time_in, time_out, 'WHITESPACE_TIMEOUT' AS issue
    FROM public.mx_timesheets
    WHERE time_out IS NOT NULL AND time_out <> '' AND trim(time_out) = ''
),
open_malformed AS (
    SELECT id, personnel_id, date, time_in, time_out, 'MALFORMED_TIMEOUT' AS issue
    FROM public.mx_timesheets
    WHERE time_out IS NOT NULL 
      AND trim(time_out) <> '' 
      AND NOT (trim(time_out) ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$')
),
unresolved_canary AS (
    SELECT p.id, p.personnel_id, t.date, t.time_in, t.time_out, 'UNRESOLVED_CANARY_PUNCH' AS issue
    FROM public.mx_timesheet_punches p
    JOIN public.mx_timesheets t ON t.id = p.timesheet_id
    WHERE t.time_out IS NULL OR trim(t.time_out) = ''
)
SELECT 
    (SELECT count(*) FROM open_null) AS count_null_timeout,
    (SELECT count(*) FROM open_blank) AS count_blank_timeout,
    (SELECT count(*) FROM open_whitespace) AS count_whitespace_timeout,
    (SELECT count(*) FROM open_malformed) AS count_malformed_timeout,
    (SELECT count(*) FROM unresolved_canary) AS count_unresolved_canary_punches,
    (
        (SELECT count(*) FROM open_null) +
        (SELECT count(*) FROM open_blank) +
        (SELECT count(*) FROM open_whitespace) +
        (SELECT count(*) FROM open_malformed) +
        (SELECT count(*) FROM unresolved_canary)
    ) AS total_unresolved_count;

-- 2. Enforcing Assertion Block (Fails Closed)
DO $$
DECLARE
    v_null INT;
    v_blank INT;
    v_ws INT;
    v_malformed INT;
    v_canary INT;
    v_total INT;
BEGIN
    SELECT count(*) INTO v_null 
    FROM public.mx_timesheets 
    WHERE time_out IS NULL;

    SELECT count(*) INTO v_blank 
    FROM public.mx_timesheets 
    WHERE time_out IS NOT NULL AND time_out = '';

    SELECT count(*) INTO v_ws 
    FROM public.mx_timesheets 
    WHERE time_out IS NOT NULL AND time_out <> '' AND trim(time_out) = '';

    SELECT count(*) INTO v_malformed 
    FROM public.mx_timesheets 
    WHERE time_out IS NOT NULL 
      AND trim(time_out) <> '' 
      AND NOT (trim(time_out) ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$');

    SELECT count(*) INTO v_canary 
    FROM public.mx_timesheet_punches p
    JOIN public.mx_timesheets t ON t.id = p.timesheet_id
    WHERE t.time_out IS NULL OR trim(t.time_out) = '';

    v_total := v_null + v_blank + v_ws + v_malformed + v_canary;

    IF v_total > 0 THEN
        RAISE EXCEPTION 'ZERO_OPEN_LEGACY_GATE_FAILED: % unresolved legacy attendance records remain (null: %, blank: %, ws: %, malformed: %, canary: %). Cutover blocked.',
            v_total, v_null, v_blank, v_ws, v_malformed, v_canary;
    END IF;

    RAISE NOTICE 'ZERO_OPEN_LEGACY_GATE_PASSED: All unresolved legacy records = 0. Proceed to Phase B.';
END $$;


-- STEP 5: PHASE B - COMPLETE LEGACY FREEZE
-- ============================================================================
-- PASS 13J: PHASE B - COMPLETE LEGACY ATTENDANCE FREEZE
-- Target: Supabase dvkkxwtqonjgrvloisid
-- Precondition: Exactly 0 open legacy shifts (mx_timesheets WHERE time_out IS NULL = 0).
-- Completely freezes ALL legacy attendance mutation pathways.
-- ============================================================================

BEGIN;

-- 1. Fail closed: Verify precondition of zero unresolved/open legacy shifts (all 5 predicates)
DO $$
DECLARE
    v_null INT;
    v_blank INT;
    v_ws INT;
    v_malformed INT;
    v_canary INT;
    v_total INT;
BEGIN
    SELECT count(*) INTO v_null FROM public.mx_timesheets WHERE time_out IS NULL;
    SELECT count(*) INTO v_blank FROM public.mx_timesheets WHERE time_out IS NOT NULL AND time_out = '';
    SELECT count(*) INTO v_ws FROM public.mx_timesheets WHERE time_out IS NOT NULL AND time_out <> '' AND trim(time_out) = '';
    SELECT count(*) INTO v_malformed FROM public.mx_timesheets
    WHERE time_out IS NOT NULL AND trim(time_out) <> ''
      AND NOT (trim(time_out) ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$');
    SELECT count(*) INTO v_canary FROM public.mx_timesheet_punches p
    JOIN public.mx_timesheets t ON t.id = p.timesheet_id
    WHERE t.time_out IS NULL OR trim(t.time_out) = '';

    v_total := v_null + v_blank + v_ws + v_malformed + v_canary;

    IF v_total > 0 THEN
        RAISE EXCEPTION 'ZERO_OPEN_SHIFT_GATE_FAILED: Cannot execute Phase B complete freeze with % unresolved legacy records remaining (null: %, blank: %, ws: %, malformed: %, canary: %).',
            v_total, v_null, v_blank, v_ws, v_malformed, v_canary;
    END IF;
END $$;

-- 2. Revoke execute on record_clock_punch and legacy auto-close functions
REVOKE ALL ON FUNCTION public.record_clock_punch FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'auto_close_stale_mx_timesheets'
    ) THEN
        REVOKE ALL ON FUNCTION public.auto_close_stale_mx_timesheets() FROM PUBLIC, anon, authenticated;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'cutover_auto_close_open_mx_timesheets'
    ) THEN
        REVOKE ALL ON FUNCTION public.cutover_auto_close_open_mx_timesheets(DATE) FROM PUBLIC, anon, authenticated;
    END IF;
END $$;

-- 3. Revoke direct write privileges on legacy attendance tables
REVOKE INSERT, UPDATE, DELETE ON TABLE public.mx_timesheets FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.mx_timesheet_punches FROM PUBLIC, anon, authenticated;

-- 4. Install fail-closed freeze trigger on mx_timesheets
CREATE OR REPLACE FUNCTION public.trg_fn_freeze_legacy_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'LEGACY_ATTENDANCE_FROZEN: Legacy attendance system is permanently frozen under Attendance Protocol V2.';
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_legacy_clockin ON public.mx_timesheets;
DROP TRIGGER IF EXISTS trg_freeze_legacy_complete ON public.mx_timesheets;
CREATE TRIGGER trg_freeze_legacy_complete
BEFORE INSERT OR UPDATE OR DELETE ON public.mx_timesheets
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_freeze_legacy_complete();

-- 5. Install fail-closed freeze trigger on mx_timesheet_punches
DROP TRIGGER IF EXISTS trg_freeze_legacy_punches_complete ON public.mx_timesheet_punches;
CREATE TRIGGER trg_freeze_legacy_punches_complete
BEFORE INSERT OR UPDATE OR DELETE ON public.mx_timesheet_punches
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_freeze_legacy_complete();

-- 6. Stamp legacy_frozen_at in attendance_v2_control
UPDATE public.attendance_v2_control
SET legacy_frozen_at = NOW(),
    updated_at = NOW()
WHERE control_id = 1;

COMMIT;


-- STEP 6: ATTENDANCE PROTOCOL V2 ACTIVATION
-- ============================================================================
-- PASS 13J: ATTENDANCE PROTOCOL V2 PRODUCTION ACTIVATION
-- Target: Supabase dvkkxwtqonjgrvloisid
-- Precondition:
-- 1. Pre-cutover snapshot completed (PRE_PASS13J_2026-10-17)
-- 2. Phase A & Phase B complete legacy freeze executed
-- 3. Exactly 0 open legacy shifts verified
-- ============================================================================

BEGIN;

-- 1. Activate Attendance V2 Control State
UPDATE public.attendance_v2_control
SET system_state = 'V2_ACTIVE',
    protocol_version = 2,
    minimum_v2_client_release_id = 51,
    minimum_v2_client_version = '5.1.3',
    v2_activated_at = NOW(),
    updated_at = NOW(),
    updated_by = auth.uid()
WHERE control_id = 1;

-- 2. Ensure Platform Minimum Version is 5.1.3
UPDATE public.platform_settings
SET minimum_client_version = '5.1.3',
    minimum_client_version_effective_at = NOW(),
    minimum_client_version_enabled = true,
    updated_at = NOW()
WHERE id = 'global';

COMMIT;
