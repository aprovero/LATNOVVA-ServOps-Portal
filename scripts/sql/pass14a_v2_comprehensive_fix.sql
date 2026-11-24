-- ==============================================================================
-- PASS 14A: COMPREHENSIVE ATTENDANCE V2 STABILIZATION & SECURITY FIXES
-- ==============================================================================
-- Target: Production Supabase (dvkkxwtqonjgrvloisid)
-- Safe to run idempotently via Supabase SQL Editor or postgres pooler.
--
-- Fixes included:
--   1. Lock down public.attendance_event_media (RLS, REVOKE, immutability, default bucket)
--   2. Drop idx_attendance_shifts_open_auth_user (idx_attendance_shifts_open_personnel
--      already enforces 1 open shift per worker; dropping auth_user index unblocks
--      Supervisor batch / manual shift creation)
--   3. Harden can_read_attendance_shift & can_read_attendance_media (IS DISTINCT FROM
--      for NULL subsidiary, allow Admin, allow Office/Supervisor own selfies)
--   4. Scope RLS on attendance_audit_log, attendance_offline_leases, lease_scopes
--   5. Fix issue_attendance_offline_lease (v_sec_loc unassigned crash on 0 secondary locs,
--      duration bounds, release check)
--   6. Fix record_attendance_event:
--      - Auto-close >14h OPEN shifts as ZOMBIE_PENDING_RECONCILIATION (8.00h) on CLOCK_IN
--      - Supervisor/Manager/HR/Admin authorized delegation for Batch Mode
--      - Safe NULLIF(TRIM(project_id), '')::uuid parsing
--      - CLOCK_OUT derives/validates project_id from active shift & skips PROJECT_NOT_ASSIGNED
--      - FORGOTTEN_CLOCKOUT validates reported_departure, sets final_clock_out_at = reported_departure,
--        credits 8.00 standard hours, and allows offline sync
--      - SHORT_SHIFT_DISCARD closes accidental <3 min punch with 0.00h & review_status='REJECTED'
--      - Evaluates ALL active secondary locations (removes LIMIT 1)
--      - Enforces home_office_allowed and online ON_SITE CLOCK_OUT GPS verification
--   7. Fix reconcile_shift (allow Admin, enforce IS DISTINCT FROM subsidiary check for
--      Supervisors, advisory lock, validate hours/reason, support closing OPEN shifts)
--   8. Add V2 HR/Manager/Supervisor management RPCs:
--      - public.v2_approve_or_reject_shift(UUID, TEXT, TEXT)
--      - public.v2_void_shift(UUID, TEXT)
--      - public.v2_approve_gps_override(UUID, TEXT)
--      - public.v2_create_manual_shift(TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, TEXT)
--   9. Update get_attendance_write_mode() to consult attendance_v2_control & revoke anon/public
--  10. Schedule pg_cron job for run_zombie_shift_closure(14.00) every 30 minutes
--      and unschedule legacy autoclose-mx-timesheets
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. LOCK DOWN public.attendance_event_media
-- ------------------------------------------------------------------------------
ALTER TABLE public.attendance_event_media
    ALTER COLUMN storage_bucket SET DEFAULT 'attendance-v2-media-private';

ALTER TABLE public.attendance_event_media ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.attendance_event_media FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.attendance_event_media TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_attendance_media_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'IMMUTABLE_ATTENDANCE_MEDIA: UPDATE/DELETE forbidden on attendance_event_media';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_attendance_media_mutation ON public.attendance_event_media;
CREATE TRIGGER trg_prevent_attendance_media_mutation
    BEFORE UPDATE OR DELETE ON public.attendance_event_media
    FOR EACH ROW EXECUTE FUNCTION public.prevent_attendance_media_mutation();

-- ------------------------------------------------------------------------------
-- 2. UNBLOCK SUPERVISOR BATCH / MANUAL SHIFTS (ONE OPEN SHIFT PER PERSONNEL_ID)
-- ------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_attendance_shifts_open_auth_user;

-- ------------------------------------------------------------------------------
-- 3. HARDEN can_read_attendance_shift & can_read_attendance_media
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_attendance_shift(
    p_shift_personnel_id TEXT,
    p_shift_project_id UUID,
    p_shift_subsidiary TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_personnel_id TEXT;
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_caller_client_id UUID;
    v_is_supervisor_of BOOLEAN := FALSE;
    v_is_assigned_project BOOLEAN := FALSE;
BEGIN
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Own attendance
    v_caller_personnel_id := public.get_authoritative_personnel_id();
    IF v_caller_personnel_id IS NOT NULL AND v_caller_personnel_id = p_shift_personnel_id THEN
        RETURN TRUE;
    END IF;

    SELECT role, subsidiary, client_id
    INTO v_caller_role, v_caller_subsidiary, v_caller_client_id
    FROM public.profiles
    WHERE id = v_uid;

    IF v_caller_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin / SuperAdmin: Full visibility
    IF v_caller_role IN ('Admin', 'SuperAdmin') THEN
        RETURN TRUE;
    END IF;

    -- Fail-closed cross-subsidiary boundary (IS DISTINCT FROM handles NULL safely)
    IF v_caller_role <> 'Customer' AND v_caller_subsidiary IS DISTINCT FROM p_shift_subsidiary THEN
        RETURN FALSE;
    END IF;

    -- Manager / HR: Full visibility within subsidiary
    IF v_caller_role IN ('Manager', 'HR') THEN
        RETURN TRUE;
    END IF;

    -- Supervisor: Direct reports + assigned projects / site leads within subsidiary
    IF v_caller_role = 'Supervisor' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.mx_personnel
            WHERE id = p_shift_personnel_id AND supervisor_id = v_caller_personnel_id
        ) INTO v_is_supervisor_of;
        IF v_is_supervisor_of THEN RETURN TRUE; END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_shift_project_id
              AND (
                  to_jsonb(assigned_personnel) ? (v_uid::text) OR
                  (v_caller_personnel_id IS NOT NULL AND to_jsonb(assigned_personnel) ? v_caller_personnel_id) OR
                  to_jsonb(site_lead_ids) ? (v_uid::text) OR
                  (v_caller_personnel_id IS NOT NULL AND to_jsonb(site_lead_ids) ? v_caller_personnel_id)
              )
        ) INTO v_is_assigned_project;
        IF v_is_assigned_project THEN RETURN TRUE; END IF;
    END IF;

    -- Office: Assigned projects within subsidiary
    IF v_caller_role = 'Office' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_shift_project_id
              AND (
                  to_jsonb(assigned_personnel) ? (v_uid::text) OR
                  (v_caller_personnel_id IS NOT NULL AND to_jsonb(assigned_personnel) ? v_caller_personnel_id)
              )
        ) INTO v_is_assigned_project;
        IF v_is_assigned_project THEN RETURN TRUE; END IF;
    END IF;

    -- Customer: Assigned client projects only
    IF v_caller_role = 'Customer' AND v_caller_client_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_shift_project_id AND client_id = v_caller_client_id
        );
    END IF;

    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_attendance_media(p_storage_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_caller_personnel_id TEXT;
    v_shift RECORD;
    v_is_supervisor_of BOOLEAN := FALSE;
    v_is_assigned_project BOOLEAN := FALSE;
BEGIN
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role, subsidiary INTO v_caller_role, v_caller_subsidiary
    FROM public.profiles
    WHERE id = v_uid;

    IF v_caller_role IS NULL OR v_caller_role = 'Customer' THEN
        RETURN FALSE;
    END IF;

    SELECT s.personnel_id, s.project_id, s.subsidiary
    INTO v_shift
    FROM public.attendance_event_media m
    JOIN public.attendance_events e ON e.event_id = m.event_id
    JOIN public.attendance_shifts s ON s.shift_id = e.shift_id
    WHERE m.storage_path = p_storage_path;

    IF v_shift.personnel_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin / SuperAdmin
    IF v_caller_role IN ('Admin', 'SuperAdmin') THEN
        RETURN TRUE;
    END IF;

    -- Own media (allowed for Tech, Office, Supervisor, Manager, HR)
    v_caller_personnel_id := public.get_authoritative_personnel_id();
    IF v_caller_personnel_id IS NOT NULL AND v_caller_personnel_id = v_shift.personnel_id THEN
        RETURN TRUE;
    END IF;

    -- Office cannot view other workers' biometric selfies
    IF v_caller_role = 'Office' THEN
        RETURN FALSE;
    END IF;

    -- Fail-closed cross-subsidiary boundary
    IF v_caller_subsidiary IS DISTINCT FROM v_shift.subsidiary THEN
        RETURN FALSE;
    END IF;

    IF v_caller_role IN ('Manager', 'HR') THEN
        RETURN TRUE;
    END IF;

    IF v_caller_role = 'Supervisor' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.mx_personnel
            WHERE id = v_shift.personnel_id AND supervisor_id = v_caller_personnel_id
        ) INTO v_is_supervisor_of;
        IF v_is_supervisor_of THEN RETURN TRUE; END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = v_shift.project_id
              AND (
                  to_jsonb(assigned_personnel) ? (v_uid::text) OR
                  (v_caller_personnel_id IS NOT NULL AND to_jsonb(assigned_personnel) ? v_caller_personnel_id) OR
                  to_jsonb(site_lead_ids) ? (v_uid::text) OR
                  (v_caller_personnel_id IS NOT NULL AND to_jsonb(site_lead_ids) ? v_caller_personnel_id)
              )
        ) INTO v_is_assigned_project;
        RETURN v_is_assigned_project;
    END IF;

    RETURN FALSE;
END;
$$;

DROP POLICY IF EXISTS "p_select_attendance_event_media" ON public.attendance_event_media;
CREATE POLICY "p_select_attendance_event_media"
ON public.attendance_event_media
FOR SELECT
TO authenticated
USING (public.can_read_attendance_media(storage_path));

-- ------------------------------------------------------------------------------
-- 4. SCOPE RLS ON AUDIT LOG & OFFLINE LEASES BY SUBSIDIARY
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "p_select_attendance_audit_log" ON public.attendance_audit_log;
CREATE POLICY "p_select_attendance_audit_log"
ON public.attendance_audit_log
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('Admin', 'SuperAdmin', 'Manager', 'HR')
    )
);

DROP POLICY IF EXISTS "p_select_attendance_offline_leases" ON public.attendance_offline_leases;
CREATE POLICY "p_select_attendance_offline_leases"
ON public.attendance_offline_leases
FOR SELECT
TO authenticated
USING (
    auth_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        LEFT JOIN public.mx_personnel mp ON mp.id = attendance_offline_leases.personnel_id
        WHERE p.id = auth.uid()
          AND (
              p.role IN ('Admin', 'SuperAdmin')
              OR (p.role IN ('Manager', 'HR') AND p.subsidiary IS NOT DISTINCT FROM COALESCE(mp.subsidiary, 'MX'))
          )
    )
);

DROP POLICY IF EXISTS "p_select_attendance_offline_lease_scopes" ON public.attendance_offline_lease_scopes;
CREATE POLICY "p_select_attendance_offline_lease_scopes"
ON public.attendance_offline_lease_scopes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.attendance_offline_leases l
        WHERE l.lease_id = attendance_offline_lease_scopes.lease_id
          AND (
              l.auth_user_id = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.profiles p
                  LEFT JOIN public.mx_personnel mp ON mp.id = l.personnel_id
                  WHERE p.id = auth.uid()
                    AND (
                        p.role IN ('Admin', 'SuperAdmin')
                        OR (p.role IN ('Manager', 'HR') AND p.subsidiary IS NOT DISTINCT FROM COALESCE(mp.subsidiary, 'MX'))
                    )
              )
          )
    )
);

-- ------------------------------------------------------------------------------
-- 5. FIX issue_attendance_offline_lease (EXACT SCHEMA COLUMNS, DROP OLD OVERLOAD)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.issue_attendance_offline_lease(TEXT, INT, INT, TEXT);

CREATE OR REPLACE FUNCTION public.issue_attendance_offline_lease(
    p_device_id TEXT,
    p_device_platform TEXT,
    p_client_release_id INTEGER DEFAULT 52,
    p_client_app_version TEXT DEFAULT '5.1.4',
    p_duration_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_personnel_id TEXT;
    v_subsidiary TEXT;
    v_system_state TEXT;
    v_max_duration INTEGER;
    v_min_release INTEGER;
    v_lease_id UUID := gen_random_uuid();
    v_valid_until TIMESTAMPTZ;
    v_proj RECORD;
    v_geo RECORD;
    v_sec_loc_id UUID;
    v_sec_proj_loc_id UUID;
    v_sec_locations JSONB;
    v_scopes JSONB := '[]'::jsonb;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    IF NULLIF(TRIM(p_device_id), '') IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_DEVICE_ID');
    END IF;

    v_personnel_id := public.get_authoritative_personnel_id();
    IF v_personnel_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'IDENTITY_UNRESOLVED');
    END IF;

    SELECT COALESCE(subsidiary, 'MX') INTO v_subsidiary FROM public.mx_personnel WHERE id = v_personnel_id;
    IF v_subsidiary IS NULL THEN v_subsidiary := 'MX'; END IF;

    SELECT system_state, max_offline_lease_duration_hours, minimum_v2_client_release_id
    INTO v_system_state, v_max_duration, v_min_release
    FROM public.attendance_v2_control WHERE control_id = 1;

    IF v_system_state NOT IN ('V2_ACTIVE', 'V2_DEGRADED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'V2_NOT_ACTIVE');
    END IF;

    IF v_min_release IS NOT NULL AND (p_client_release_id IS NULL OR p_client_release_id < v_min_release) THEN
        RETURN jsonb_build_object('success', false, 'error', 'CLIENT_VERSION_DEPRECATED');
    END IF;

    IF p_duration_hours IS NULL OR p_duration_hours <= 0 OR p_duration_hours > COALESCE(v_max_duration, 72) THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_LEASE_DURATION');
    END IF;

    v_valid_until := now() + (p_duration_hours || ' hours')::interval;

    INSERT INTO public.attendance_offline_leases (
        lease_id, auth_user_id, personnel_id, subsidiary, device_id,
        attendance_protocol_version, client_release_id, client_app_version,
        valid_from, valid_until
    ) VALUES (
        v_lease_id, v_uid, v_personnel_id, v_subsidiary, TRIM(p_device_id),
        2, COALESCE(p_client_release_id, 52), COALESCE(NULLIF(TRIM(p_client_app_version), ''), '5.1.4'),
        now(), v_valid_until
    );

    FOR v_proj IN
        SELECT p.id AS project_id, p.name AS project_name
        FROM public.projects p
        WHERE p.status IN ('Active', 'In Progress')
          AND (
              to_jsonb(p.assigned_personnel) ? v_personnel_id
              OR to_jsonb(p.assigned_personnel) ? (v_uid::text)
          )
    LOOP
        SELECT * INTO v_geo
        FROM public.project_geofence_versions
        WHERE project_id = v_proj.project_id
        ORDER BY effective_from DESC LIMIT 1;

        IF v_geo.version_id IS NOT NULL THEN
            -- Safely resolve optional secondary locations (scalar variables avoid unassigned RECORD crash)
            v_sec_loc_id := NULL;
            v_sec_proj_loc_id := NULL;
            SELECT l.location_id, pl.project_location_id
            INTO v_sec_loc_id, v_sec_proj_loc_id
            FROM public.attendance_project_locations pl
            JOIN public.attendance_locations l ON l.location_id = pl.location_id
            WHERE pl.project_id = v_proj.project_id
              AND pl.is_active = TRUE
              AND pl.valid_from <= now()
              AND (pl.valid_until IS NULL OR pl.valid_until > now())
              AND l.is_active = TRUE
              AND l.valid_from <= now()
              AND (l.valid_until IS NULL OR l.valid_until > now())
            ORDER BY pl.created_at ASC
            LIMIT 1;

            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'location_id', l.location_id,
                'project_location_id', pl.project_location_id,
                'name', l.name,
                'latitude', l.latitude,
                'longitude', l.longitude,
                'radius_meters', l.radius_meters,
                'accuracy_threshold_meters', l.accuracy_threshold_meters
            )), '[]'::jsonb)
            INTO v_sec_locations
            FROM public.attendance_project_locations pl
            JOIN public.attendance_locations l ON l.location_id = pl.location_id
            WHERE pl.project_id = v_proj.project_id
              AND pl.is_active = TRUE
              AND pl.valid_from <= now()
              AND (pl.valid_until IS NULL OR pl.valid_until > now())
              AND l.is_active = TRUE
              AND l.valid_from <= now()
              AND (l.valid_until IS NULL OR l.valid_until > now());

            INSERT INTO public.attendance_offline_lease_scopes (
                lease_id, project_id, geofence_version_id,
                secondary_location_id, project_location_id,
                warehouse_bypass_allowed, home_office_allowed
            ) VALUES (
                v_lease_id, v_proj.project_id, v_geo.version_id,
                v_sec_loc_id, v_sec_proj_loc_id,
                COALESCE(v_geo.warehouse_bypass_allowed, FALSE),
                COALESCE(v_geo.home_office_allowed, TRUE)
            );

            v_scopes := v_scopes || jsonb_build_object(
                'project_id', v_proj.project_id,
                'project_name', v_proj.project_name,
                'geofence_version_id', v_geo.version_id,
                'latitude', v_geo.latitude,
                'longitude', v_geo.longitude,
                'radius_meters', v_geo.radius_meters,
                'accuracy_threshold_meters', v_geo.accuracy_threshold_meters,
                'warehouse_bypass_allowed', COALESCE(v_geo.warehouse_bypass_allowed, FALSE),
                'home_office_allowed', COALESCE(v_geo.home_office_allowed, TRUE),
                'secondary_location_id', v_sec_loc_id,
                'secondary_locations', v_sec_locations
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'lease_id', v_lease_id,
        'personnel_id', v_personnel_id,
        'subsidiary', v_subsidiary,
        'valid_from', now(),
        'valid_until', v_valid_until,
        'scopes', v_scopes
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_attendance_offline_lease(TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_attendance_offline_lease(TEXT, TEXT, INTEGER, TEXT, INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5B. SAFE compute_canonical_event_hash (HANDLES EMPTY project_id ON CLOCK_OUT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_canonical_event_hash(p_event jsonb)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_canonical jsonb;
    v_canonical_text text;
    v_proj_str text := NULLIF(TRIM(p_event->>'project_id'), '');
    v_geo_ver_str text := NULLIF(TRIM(p_event->>'geofence_version_id'), '');
    v_lease_str text := NULLIF(TRIM(p_event->>'offline_lease_id'), '');
    v_rep_dep_str text := NULLIF(TRIM(p_event->>'reported_departure_timestamp'), '');
BEGIN
    v_canonical := jsonb_build_object(
        'accuracy_meters', CASE WHEN NULLIF(TRIM(p_event->>'accuracy_meters'), '') IS NULL THEN jsonb 'null' ELSE to_jsonb(round((p_event->>'accuracy_meters')::numeric, 2)) END,
        'adjustment_reason', CASE WHEN NULLIF(TRIM(p_event->>'adjustment_reason'), '') IS NULL THEN jsonb 'null' ELSE to_jsonb(p_event->>'adjustment_reason') END,
        'attendance_protocol_version', to_jsonb(COALESCE(NULLIF(TRIM(p_event->>'attendance_protocol_version'), '')::int, 2)),
        'client_app_version', to_jsonb(COALESCE(p_event->>'client_app_version', '')),
        'client_commit_hash', to_jsonb(lower(COALESCE(p_event->>'client_commit_hash', ''))),
        'client_release_id', to_jsonb(COALESCE(NULLIF(TRIM(p_event->>'client_release_id'), '')::int, 0)),
        'created_offline', to_jsonb(coalesce((p_event->>'created_offline')::boolean, false)),
        'device_event_timestamp', to_jsonb(to_char((p_event->>'device_event_timestamp')::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        'device_id', to_jsonb(COALESCE(p_event->>'device_id', '')),
        'device_platform', to_jsonb(COALESCE(p_event->>'device_platform', '')),
        'event_id', to_jsonb(lower((p_event->>'event_id')::uuid::text)),
        'event_type', to_jsonb(upper(COALESCE(p_event->>'event_type', ''))),
        'face_bypass_reason', CASE WHEN NULLIF(TRIM(p_event->>'face_bypass_reason'), '') IS NULL THEN jsonb 'null' ELSE to_jsonb(p_event->>'face_bypass_reason') END,
        'face_verified', to_jsonb(COALESCE((p_event->>'face_verified')::boolean, false)),
        'geofence_distance_meters', CASE WHEN NULLIF(TRIM(p_event->>'geofence_distance_meters'), '') IS NULL THEN jsonb 'null' ELSE to_jsonb(round((p_event->>'geofence_distance_meters')::numeric, 2)) END,
        'geofence_status', to_jsonb(upper(COALESCE(NULLIF(TRIM(p_event->>'geofence_status'), ''), 'UNKNOWN'))),
        'geofence_version_id', CASE WHEN v_geo_ver_str IS NULL THEN jsonb 'null' ELSE to_jsonb(lower(v_geo_ver_str::uuid::text)) END,
        'gps_verified', to_jsonb(COALESCE((p_event->>'gps_verified')::boolean, false)),
        'is_manual_adjustment', to_jsonb(coalesce((p_event->>'is_manual_adjustment')::boolean, false)),
        'latitude', CASE WHEN NULLIF(TRIM(p_event->>'latitude'), '') IS NULL THEN jsonb 'null' ELSE to_jsonb(round((p_event->>'latitude')::numeric, 7)) END,
        'longitude', CASE WHEN NULLIF(TRIM(p_event->>'longitude'), '') IS NULL THEN jsonb 'null' ELSE to_jsonb(round((p_event->>'longitude')::numeric, 7)) END,
        'offline_lease_id', CASE WHEN v_lease_str IS NULL THEN jsonb 'null' ELSE to_jsonb(lower(v_lease_str::uuid::text)) END,
        'personnel_id', to_jsonb(COALESCE(p_event->>'personnel_id', '')),
        'project_id', CASE WHEN v_proj_str IS NULL THEN jsonb 'null' ELSE to_jsonb(lower(v_proj_str::uuid::text)) END,
        'reported_departure_timestamp', CASE WHEN v_rep_dep_str IS NULL THEN jsonb 'null' ELSE to_jsonb(to_char(v_rep_dep_str::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) END,
        'shift_id', to_jsonb(lower((p_event->>'shift_id')::uuid::text)),
        'timezone_offset_minutes', to_jsonb(COALESCE(NULLIF(TRIM(p_event->>'timezone_offset_minutes'), '')::smallint, 0)),
        'work_type', to_jsonb(upper(COALESCE(p_event->>'work_type', 'ON_SITE'))),
        'worker_explanation', CASE WHEN NULLIF(TRIM(p_event->>'worker_explanation'), '') IS NULL THEN jsonb 'null' ELSE to_jsonb(p_event->>'worker_explanation') END
    );

    v_canonical_text := v_canonical::text;
    RETURN encode(sha256(convert_to(v_canonical_text, 'UTF8')), 'hex');
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. HARDENED record_attendance_event(JSONB)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance_event(p_event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_caller_personnel_id TEXT;
    v_personnel_id TEXT;
    v_target_personnel_id TEXT;
    v_is_proxy_punch BOOLEAN := FALSE;
    v_subsidiary TEXT;
    v_system_state TEXT;
    v_min_release_id INT;
    v_zombie_threshold_hours NUMERIC;
    v_event_id UUID;
    v_shift_id UUID;
    v_project_id UUID;
    v_event_type TEXT;
    v_work_type TEXT;
    v_device_event_timestamp TIMESTAMPTZ;
    v_tz_offset SMALLINT;
    v_device_id TEXT;
    v_device_platform TEXT;
    v_client_app_version TEXT;
    v_client_release_id INT;
    v_client_commit_hash TEXT;
    v_protocol_version INT;
    v_created_offline BOOLEAN;
    v_offline_lease_id UUID;
    v_lat NUMERIC;
    v_lon NUMERIC;
    v_accuracy NUMERIC;
    v_gps_verified BOOLEAN;
    v_geofence_status TEXT;
    v_geofence_distance NUMERIC;
    v_geofence_version_id UUID;
    v_face_verified BOOLEAN;
    v_face_bypass_reason TEXT;
    v_is_manual_adjustment BOOLEAN;
    v_adjustment_reason TEXT;
    v_reported_departure TIMESTAMPTZ;
    v_worker_explanation TEXT;
    v_canonical_hash TEXT;
    v_existing_event RECORD;
    v_active_shift RECORD;
    v_lease RECORD;
    v_scope RECORD;
    v_active_geofence RECORD;
    v_sec_loc RECORD;
    v_server_distance NUMERIC := NULL;
    v_secondary_distance NUMERIC := NULL;
    v_server_geofence_status TEXT := 'UNKNOWN';
    v_attendance_location_id UUID := NULL;
    v_project_location_id UUID := NULL;
    v_is_assigned_project BOOLEAN := FALSE;
    v_duration_minutes INT := 0;
    v_payable_hours NUMERIC(5,2) := 0.00;
    v_overtime_hours NUMERIC(5,2) := 0.00;
    v_close_method TEXT := 'NORMAL_CLOCK_OUT';
    v_final_status TEXT := 'COMPLETED';
    v_requires_review BOOLEAN := FALSE;
    v_review_status TEXT := 'NONE';
    v_effective_clock_out TIMESTAMPTZ;
    v_matched_secondary BOOLEAN := FALSE;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'NOT_AUTHENTICATED');
    END IF;

    SELECT system_state, minimum_v2_client_release_id, COALESCE(zombie_shift_threshold_hours, 14)
    INTO v_system_state, v_min_release_id, v_zombie_threshold_hours
    FROM public.attendance_v2_control WHERE control_id = 1;

    IF v_system_state NOT IN ('V2_ACTIVE', 'V2_DEGRADED') THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'V2_NOT_ACTIVE');
    END IF;

    -- Parse payload safely (NULLIF prevents ''::uuid cast crash)
    v_event_id := COALESCE(NULLIF(TRIM(p_event->>'event_id'), '')::uuid, gen_random_uuid());
    v_shift_id := NULLIF(TRIM(p_event->>'shift_id'), '')::uuid;
    v_project_id := NULLIF(TRIM(p_event->>'project_id'), '')::uuid;
    v_target_personnel_id := NULLIF(TRIM(p_event->>'personnel_id'), '');
    v_event_type := UPPER(COALESCE(NULLIF(TRIM(p_event->>'event_type'), ''), ''));
    v_work_type := CASE WHEN UPPER(COALESCE(NULLIF(TRIM(p_event->>'work_type'), ''), 'ON_SITE')) IN ('HOME_OFFICE', 'HOME OFFICE') THEN 'HOME_OFFICE' ELSE 'ON_SITE' END;
    v_device_event_timestamp := COALESCE(NULLIF(TRIM(p_event->>'device_event_timestamp'), '')::timestamptz, now());
    v_tz_offset := COALESCE(NULLIF(TRIM(p_event->>'timezone_offset_minutes'), '')::smallint, 0);
    v_device_id := COALESCE(NULLIF(TRIM(p_event->>'device_id'), ''), 'unknown');
    v_device_platform := COALESCE(NULLIF(TRIM(p_event->>'device_platform'), ''), 'web');
    v_client_app_version := COALESCE(NULLIF(TRIM(p_event->>'client_app_version'), ''), '5.1.4');
    v_client_release_id := NULLIF(TRIM(p_event->>'client_release_id'), '')::int;
    v_client_commit_hash := COALESCE(NULLIF(TRIM(p_event->>'client_commit_hash'), ''), 'unknown');
    v_protocol_version := COALESCE(NULLIF(TRIM(p_event->>'attendance_protocol_version'), '')::int, 2);
    v_created_offline := COALESCE((p_event->>'created_offline')::boolean, FALSE);
    v_offline_lease_id := NULLIF(TRIM(p_event->>'offline_lease_id'), '')::uuid;
    v_lat := NULLIF(TRIM(p_event->>'latitude'), '')::numeric;
    v_lon := NULLIF(TRIM(p_event->>'longitude'), '')::numeric;
    v_accuracy := NULLIF(TRIM(p_event->>'accuracy_meters'), '')::numeric;
    v_gps_verified := COALESCE((p_event->>'gps_verified')::boolean, FALSE);
    v_geofence_status := UPPER(COALESCE(NULLIF(TRIM(p_event->>'geofence_status'), ''), 'UNKNOWN'));
    IF v_geofence_status NOT IN ('INSIDE', 'OUTSIDE', 'UNKNOWN', 'BYPASS_AUTHORIZED', 'NOT_APPLICABLE') THEN
        v_geofence_status := 'UNKNOWN';
    END IF;
    v_geofence_distance := NULLIF(TRIM(p_event->>'geofence_distance_meters'), '')::numeric;
    v_geofence_version_id := NULLIF(TRIM(p_event->>'geofence_version_id'), '')::uuid;
    v_face_verified := COALESCE((p_event->>'face_verified')::boolean, FALSE);
    v_face_bypass_reason := NULLIF(TRIM(p_event->>'face_bypass_reason'), '');
    v_is_manual_adjustment := COALESCE((p_event->>'is_manual_adjustment')::boolean, FALSE);
    v_adjustment_reason := NULLIF(TRIM(p_event->>'adjustment_reason'), '');
    v_reported_departure := NULLIF(TRIM(p_event->>'reported_departure_timestamp'), '')::timestamptz;
    v_worker_explanation := NULLIF(TRIM(p_event->>'worker_explanation'), '');

    IF v_face_verified THEN
        v_face_bypass_reason := NULL;
    ELSIF v_face_bypass_reason IS NULL THEN
        v_face_bypass_reason := 'UNSPECIFIED_BYPASS';
    END IF;

    -- Idempotency check
    v_canonical_hash := public.compute_canonical_event_hash(p_event);
    SELECT * INTO v_existing_event FROM public.attendance_events WHERE event_id = v_event_id;
    IF v_existing_event.event_id IS NOT NULL THEN
        IF v_existing_event.canonical_hash = v_canonical_hash THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'ALREADY_APPLIED',
                'event_id', v_event_id,
                'shift_id', v_existing_event.shift_id
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'status', 'REJECTED',
                'error', 'CANONICAL_HASH_MISMATCH'
            );
        END IF;
    END IF;

    -- Identity Verification (Self OR Authorized Supervisor/Manager/HR/Admin Delegation)
    v_caller_personnel_id := public.get_authoritative_personnel_id();
    SELECT role, subsidiary INTO v_caller_role, v_caller_subsidiary
    FROM public.profiles WHERE id = v_uid;

    IF v_target_personnel_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'IDENTITY_UNRESOLVED');
    END IF;

    IF v_caller_personnel_id IS NOT NULL AND v_caller_personnel_id = v_target_personnel_id THEN
        v_personnel_id := v_caller_personnel_id;
        v_is_proxy_punch := FALSE;
    ELSIF v_caller_role IN ('Supervisor', 'Manager', 'HR', 'Admin', 'SuperAdmin') THEN
        SELECT COALESCE(subsidiary, 'MX') INTO v_subsidiary FROM public.mx_personnel WHERE id = v_target_personnel_id;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'TARGET_PERSONNEL_NOT_FOUND');
        END IF;
        IF v_caller_role NOT IN ('Admin', 'SuperAdmin') AND v_caller_subsidiary IS DISTINCT FROM v_subsidiary THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CROSS_SUBSIDIARY_FORBIDDEN');
        END IF;
        v_personnel_id := v_target_personnel_id;
        v_is_proxy_punch := TRUE;
    ELSE
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'IDENTITY_SPOOF_ATTEMPT');
    END IF;

    SELECT COALESCE(subsidiary, 'MX') INTO v_subsidiary FROM public.mx_personnel WHERE id = v_personnel_id;

    -- Client Release Gate
    IF v_min_release_id IS NOT NULL AND (v_client_release_id IS NULL OR v_client_release_id < v_min_release_id) THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CLIENT_VERSION_DEPRECATED');
    END IF;

    -- --------------------------------------------------------------------------
    -- CLOCK_IN ROUTING
    -- --------------------------------------------------------------------------
    IF v_event_type = 'CLOCK_IN' THEN
        IF v_shift_id IS NULL OR v_project_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'MISSING_SHIFT_OR_PROJECT_ID');
        END IF;

        -- Project Assignment Check (CLOCK_IN only; Supervisors/Managers/HR/Admins can batch-punch)
        IF NOT v_is_proxy_punch THEN
            SELECT EXISTS (
                SELECT 1 FROM public.projects
                WHERE id = v_project_id
                  AND (
                      to_jsonb(assigned_personnel) ? v_personnel_id
                      OR to_jsonb(assigned_personnel) ? (v_uid::text)
                  )
            ) INTO v_is_assigned_project;

            IF NOT v_is_assigned_project THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'PROJECT_NOT_ASSIGNED');
            END IF;
        END IF;

        -- Offline lease check if created_offline
        IF v_created_offline THEN
            IF v_offline_lease_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_MISSING');
            END IF;
            SELECT * INTO v_lease FROM public.attendance_offline_leases WHERE lease_id = v_offline_lease_id;
            IF v_lease.lease_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_NOT_FOUND');
            END IF;
            IF v_lease.personnel_id <> v_personnel_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_IDENTITY_MISMATCH');
            END IF;
            IF v_device_event_timestamp < v_lease.valid_from OR v_device_event_timestamp > v_lease.valid_until THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_EXPIRED');
            END IF;
            IF v_lease.is_revoked AND v_lease.revoked_at <= v_device_event_timestamp THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_REVOKED');
            END IF;
            SELECT * INTO v_scope FROM public.attendance_offline_lease_scopes
            WHERE lease_id = v_offline_lease_id AND project_id = v_project_id;
            IF v_scope.scope_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_PROJECT_NOT_SCOPED');
            END IF;
        END IF;

        PERFORM pg_advisory_xact_lock(hashtextextended(v_personnel_id, 0));

        SELECT * INTO v_active_shift
        FROM public.attendance_shifts
        WHERE personnel_id = v_personnel_id AND status = 'OPEN';

        IF v_active_shift.shift_id IS NOT NULL THEN
            IF v_active_shift.shift_id = v_shift_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'CONFLICT', 'error', 'CLOCK_IN_ALREADY_EXISTS');
            ELSIF now() - v_active_shift.first_clock_in_at > (v_zombie_threshold_hours || ' hours')::interval THEN
                -- Auto-close stale/zombie shift with 8.00 standard hours so worker is never locked out
                UPDATE public.attendance_shifts
                SET status = 'ZOMBIE_PENDING_RECONCILIATION',
                    final_clock_out_at = v_active_shift.first_clock_in_at + interval '8 hours',
                    physical_duration_minutes = 480,
                    payable_hours = 8.00,
                    overtime_hours = 0.00,
                    close_method = 'ZOMBIE_AUTO_CLOSE_8H',
                    requires_review = TRUE,
                    review_status = 'PENDING',
                    review_notes = 'Auto-cerrado por turno pendiente >' || v_zombie_threshold_hours || 'h (8.00h estándar)',
                    updated_at = now()
                WHERE shift_id = v_active_shift.shift_id;
            ELSE
                RETURN jsonb_build_object('success', false, 'status', 'ACTIVE_SHIFT_CONFLICT', 'error', 'Worker already has an active OPEN shift');
            END IF;
        END IF;

        -- Geofence & Home Office Validation
        SELECT * INTO v_active_geofence
        FROM public.project_geofence_versions
        WHERE project_id = v_project_id
        ORDER BY effective_from DESC LIMIT 1;

        IF v_work_type = 'HOME_OFFICE' THEN
            IF v_active_geofence.version_id IS NOT NULL AND v_active_geofence.home_office_allowed = FALSE THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'HOME_OFFICE_NOT_ALLOWED');
            END IF;
            v_server_geofence_status := 'NOT_APPLICABLE';
        ELSIF v_work_type = 'ON_SITE' THEN
            IF v_active_geofence.version_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GEOFENCE_NOT_CONFIGURED');
            END IF;
            v_geofence_version_id := v_active_geofence.version_id;

            IF v_lat IS NULL OR v_lon IS NULL OR NOT v_gps_verified THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_UNVERIFIED');
            END IF;

            v_server_distance := public.calculate_geofence_distance_meters(
                v_lat::double precision, v_lon::double precision,
                v_active_geofence.latitude, v_active_geofence.longitude
            );

            IF (v_accuracy IS NOT NULL AND v_accuracy <= v_active_geofence.accuracy_threshold_meters)
               AND v_server_distance <= v_active_geofence.radius_meters THEN
                v_server_geofence_status := 'PRIMARY_GEOFENCE';
            ELSE
                -- Check ALL active secondary physical locations (not LIMIT 1)
                v_matched_secondary := FALSE;
                FOR v_sec_loc IN
                    SELECT pl.project_location_id, l.location_id, l.latitude, l.longitude,
                           l.radius_meters, l.accuracy_threshold_meters
                    FROM public.attendance_project_locations pl
                    JOIN public.attendance_locations l ON l.location_id = pl.location_id
                    WHERE pl.project_id = v_project_id
                      AND pl.is_active = TRUE
                      AND pl.valid_from <= now()
                      AND (pl.valid_until IS NULL OR pl.valid_until > now())
                      AND l.is_active = TRUE
                      AND l.valid_from <= now()
                      AND (l.valid_until IS NULL OR l.valid_until > now())
                LOOP
                    v_secondary_distance := public.calculate_geofence_distance_meters(
                        v_lat::double precision, v_lon::double precision,
                        v_sec_loc.latitude, v_sec_loc.longitude
                    );
                    IF (v_accuracy IS NOT NULL AND v_accuracy <= v_sec_loc.accuracy_threshold_meters)
                       AND v_secondary_distance <= v_sec_loc.radius_meters THEN
                        v_server_distance := v_secondary_distance;
                        v_server_geofence_status := 'SECONDARY_GEOFENCE';
                        v_attendance_location_id := v_sec_loc.location_id;
                        v_project_location_id := v_sec_loc.project_location_id;
                        v_matched_secondary := TRUE;
                        EXIT;
                    END IF;
                END LOOP;

                IF NOT v_matched_secondary THEN
                    IF v_accuracy IS NOT NULL AND v_accuracy > v_active_geofence.accuracy_threshold_meters THEN
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                    ELSE
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                    END IF;
                END IF;
            END IF;
        END IF;

        INSERT INTO public.attendance_shifts (
            shift_id, auth_user_id, personnel_id, project_id, subsidiary, work_type,
            first_clock_in_at, final_clock_out_at, status, requires_review, review_status
        ) VALUES (
            v_shift_id, v_uid, v_personnel_id, v_project_id, v_subsidiary, v_work_type,
            v_device_event_timestamp, NULL, 'OPEN', FALSE, 'NONE'
        );

        INSERT INTO public.attendance_events (
            event_id, shift_id, personnel_id, project_id,
            event_type, work_type, device_event_timestamp, timezone_offset_minutes,
            device_id, device_platform, client_app_version, client_release_id, client_commit_hash,
            attendance_protocol_version, created_offline, offline_lease_id,
            latitude, longitude, accuracy_meters, gps_verified, geofence_status,
            geofence_distance_meters, geofence_version_id, attendance_location_id, project_location_id,
            face_verified, face_bypass_reason,
            is_manual_adjustment, adjustment_reason, reported_departure_timestamp, worker_explanation,
            auth_user_id, server_received_at, canonical_hash, server_authorization_outcome,
            server_geofence_distance_meters, server_geofence_status
        ) VALUES (
            v_event_id, v_shift_id, v_personnel_id, v_project_id,
            'CLOCK_IN', v_work_type, v_device_event_timestamp, v_tz_offset,
            v_device_id, v_device_platform, v_client_app_version, v_client_release_id, v_client_commit_hash,
            v_protocol_version, v_created_offline, v_offline_lease_id,
            v_lat, v_lon, v_accuracy, v_gps_verified, v_geofence_status,
            v_geofence_distance, v_geofence_version_id, v_attendance_location_id, v_project_location_id,
            v_face_verified, v_face_bypass_reason,
            v_is_manual_adjustment, v_adjustment_reason, v_reported_departure, v_worker_explanation,
            v_uid, now(), v_canonical_hash, 'AUTHORIZED',
            v_server_distance, v_server_geofence_status
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'APPLIED',
            'event_id', v_event_id,
            'shift_id', v_shift_id,
            'event_type', 'CLOCK_IN',
            'authorization_policy', v_server_geofence_status
        );

    -- --------------------------------------------------------------------------
    -- CLOCK_OUT ROUTING
    -- --------------------------------------------------------------------------
    ELSIF v_event_type = 'CLOCK_OUT' THEN
        IF v_shift_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'MISSING_SHIFT_ID');
        END IF;

        PERFORM pg_advisory_xact_lock(hashtextextended(v_shift_id::text, 0));

        SELECT * INTO v_active_shift
        FROM public.attendance_shifts
        WHERE shift_id = v_shift_id;

        IF v_active_shift.shift_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'ACTIVE_SHIFT_NOT_FOUND');
        END IF;

        IF v_active_shift.personnel_id <> v_personnel_id THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'SHIFT_OWNERSHIP_MISMATCH');
        END IF;

        IF v_active_shift.status NOT IN ('OPEN', 'ZOMBIE_PENDING_RECONCILIATION') THEN
            RETURN jsonb_build_object('success', false, 'status', 'CONFLICT', 'error', 'SHIFT_ALREADY_CLOSED');
        END IF;

        -- Always bind CLOCK_OUT project_id & work_type to the authoritative active shift
        v_project_id := v_active_shift.project_id;
        v_work_type := v_active_shift.work_type;

        -- Offline lease validation for offline CLOCK_OUT (prevents chk_events_offline_lease crash)
        IF v_created_offline THEN
            IF v_offline_lease_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_MISSING');
            END IF;
            SELECT * INTO v_lease FROM public.attendance_offline_leases WHERE lease_id = v_offline_lease_id;
            IF v_lease.lease_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_NOT_FOUND');
            END IF;
            IF v_lease.personnel_id <> v_personnel_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_IDENTITY_MISMATCH');
            END IF;
            IF v_device_event_timestamp < v_lease.valid_from OR v_device_event_timestamp > v_lease.valid_until THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_EXPIRED');
            END IF;
            IF v_lease.is_revoked AND v_lease.revoked_at <= v_device_event_timestamp THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_REVOKED');
            END IF;
        END IF;

        IF v_device_event_timestamp < v_active_shift.first_clock_in_at THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CLOCK_OUT_BEFORE_CLOCK_IN');
        END IF;

        IF v_adjustment_reason = 'SHORT_SHIFT_DISCARD' THEN
            -- Accidental <3 min punch discard -> 0.00h, Rejected
            v_effective_clock_out := v_device_event_timestamp;
            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_effective_clock_out - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := 0.00;
            v_overtime_hours := 0.00;
            v_close_method := 'MANUAL_SUPERVISOR_ADJUSTMENT';
            v_final_status := 'COMPLETED';
            v_requires_review := FALSE;
            v_review_status := 'REJECTED';
            v_server_geofence_status := 'BYPASS_AUTHORIZED';

        ELSIF v_adjustment_reason = 'FORGOTTEN_CLOCKOUT' THEN
            -- Stale / Forgotten clock-out -> 8.00 standard hours, Pending review
            IF v_reported_departure IS NOT NULL AND v_reported_departure >= v_active_shift.first_clock_in_at THEN
                v_effective_clock_out := v_reported_departure;
            ELSE
                v_effective_clock_out := v_active_shift.first_clock_in_at + interval '8 hours';
            END IF;
            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_effective_clock_out - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := 8.00;
            v_overtime_hours := 0.00;
            v_close_method := 'FORGOTTEN_CLOCKOUT_8H';
            v_final_status := 'COMPLETED_FORGOTTEN_8H';
            v_requires_review := TRUE;
            v_review_status := 'PENDING';
            v_server_geofence_status := 'BYPASS_AUTHORIZED';
            IF v_worker_explanation IS NULL THEN
                v_worker_explanation := 'Olvidé registrar mi salida (cierre estándar 8.00h)';
            END IF;
            v_reported_departure := v_effective_clock_out;
            v_gps_verified := FALSE;
            v_is_manual_adjustment := TRUE;

        ELSE
            -- Normal Clock-Out
            v_effective_clock_out := v_device_event_timestamp;
            IF v_work_type = 'ON_SITE' AND NOT v_created_offline THEN
                SELECT * INTO v_active_geofence
                FROM public.project_geofence_versions
                WHERE project_id = v_project_id
                ORDER BY effective_from DESC LIMIT 1;

                IF v_active_geofence.version_id IS NOT NULL THEN
                    v_geofence_version_id := v_active_geofence.version_id;
                    IF v_lat IS NOT NULL AND v_lon IS NOT NULL AND v_gps_verified THEN
                        v_server_distance := public.calculate_geofence_distance_meters(
                            v_lat::double precision, v_lon::double precision,
                            v_active_geofence.latitude, v_active_geofence.longitude
                        );
                        IF (v_accuracy IS NOT NULL AND v_accuracy <= v_active_geofence.accuracy_threshold_meters)
                           AND v_server_distance <= v_active_geofence.radius_meters THEN
                            v_server_geofence_status := 'PRIMARY_GEOFENCE';
                        ELSE
                            v_matched_secondary := FALSE;
                            FOR v_sec_loc IN
                                SELECT pl.project_location_id, l.location_id, l.latitude, l.longitude,
                                       l.radius_meters, l.accuracy_threshold_meters
                                FROM public.attendance_project_locations pl
                                JOIN public.attendance_locations l ON l.location_id = pl.location_id
                                WHERE pl.project_id = v_project_id
                                  AND pl.is_active = TRUE
                                  AND pl.valid_from <= now()
                                  AND (pl.valid_until IS NULL OR pl.valid_until > now())
                                  AND l.is_active = TRUE
                                  AND l.valid_from <= now()
                                  AND (l.valid_until IS NULL OR l.valid_until > now())
                            LOOP
                                v_secondary_distance := public.calculate_geofence_distance_meters(
                                    v_lat::double precision, v_lon::double precision,
                                    v_sec_loc.latitude, v_sec_loc.longitude
                                );
                                IF (v_accuracy IS NOT NULL AND v_accuracy <= v_sec_loc.accuracy_threshold_meters)
                                   AND v_secondary_distance <= v_sec_loc.radius_meters THEN
                                    v_server_distance := v_secondary_distance;
                                    v_server_geofence_status := 'SECONDARY_GEOFENCE';
                                    v_attendance_location_id := v_sec_loc.location_id;
                                    v_project_location_id := v_sec_loc.project_location_id;
                                    v_matched_secondary := TRUE;
                                    EXIT;
                                END IF;
                            END LOOP;
                            IF NOT v_matched_secondary THEN
                                v_server_geofence_status := 'OUTSIDE';
                                v_requires_review := TRUE;
                                v_review_status := 'PENDING';
                            END IF;
                        END IF;
                    ELSE
                        v_server_geofence_status := 'UNKNOWN';
                        v_requires_review := TRUE;
                        v_review_status := 'PENDING';
                    END IF;
                END IF;
            ELSE
                v_server_geofence_status := 'NOT_APPLICABLE';
            END IF;

            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_effective_clock_out - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := LEAST(8.00, ROUND((v_duration_minutes / 60.0)::numeric, 2));
            v_overtime_hours := GREATEST(0.00, ROUND(((v_duration_minutes / 60.0) - 8.0)::numeric, 2));
            v_close_method := 'NORMAL_CLOCK_OUT';
            v_final_status := 'COMPLETED';
        END IF;

        INSERT INTO public.attendance_events (
            event_id, shift_id, personnel_id, project_id,
            event_type, work_type, device_event_timestamp, timezone_offset_minutes,
            device_id, device_platform, client_app_version, client_release_id, client_commit_hash,
            attendance_protocol_version, created_offline, offline_lease_id,
            latitude, longitude, accuracy_meters, gps_verified, geofence_status,
            geofence_distance_meters, geofence_version_id, attendance_location_id, project_location_id,
            face_verified, face_bypass_reason,
            is_manual_adjustment, adjustment_reason, reported_departure_timestamp, worker_explanation,
            auth_user_id, server_received_at, canonical_hash, server_authorization_outcome,
            server_geofence_distance_meters, server_geofence_status
        ) VALUES (
            v_event_id, v_shift_id, v_personnel_id, v_project_id,
            'CLOCK_OUT', v_work_type, v_device_event_timestamp, v_tz_offset,
            v_device_id, v_device_platform, v_client_app_version, v_client_release_id, v_client_commit_hash,
            v_protocol_version, v_created_offline, v_offline_lease_id,
            v_lat, v_lon, v_accuracy, v_gps_verified, v_geofence_status,
            v_geofence_distance, v_geofence_version_id, v_attendance_location_id, v_project_location_id,
            v_face_verified, v_face_bypass_reason,
            v_is_manual_adjustment, v_adjustment_reason, v_reported_departure, v_worker_explanation,
            v_uid, now(), v_canonical_hash, 'AUTHORIZED',
            v_server_distance, v_server_geofence_status
        );

        UPDATE public.attendance_shifts
        SET final_clock_out_at = v_effective_clock_out,
            physical_duration_minutes = v_duration_minutes,
            payable_hours = CASE WHEN v_adjustment_reason = 'SHORT_SHIFT_DISCARD' THEN 0.00 WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN 8.00 ELSE v_payable_hours END,
            overtime_hours = CASE WHEN v_adjustment_reason = 'SHORT_SHIFT_DISCARD' THEN 0.00 WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN 0.00 ELSE v_overtime_hours END,
            status = CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' AND v_adjustment_reason IS NULL THEN 'ZOMBIE_PENDING_RECONCILIATION' ELSE v_final_status END,
            close_method = v_close_method,
            requires_review = CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' AND v_adjustment_reason IS NULL THEN TRUE ELSE v_requires_review END,
            review_status = CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' AND v_adjustment_reason IS NULL THEN 'PENDING' ELSE v_review_status END,
            review_notes = COALESCE(v_worker_explanation, review_notes),
            updated_at = now()
        WHERE shift_id = v_shift_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'APPLIED',
            'event_id', v_event_id,
            'shift_id', v_shift_id,
            'event_type', 'CLOCK_OUT',
            'payable_hours', CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN 8.00 ELSE v_payable_hours END,
            'overtime_hours', CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN 0.00 ELSE v_overtime_hours END
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'INVALID_EVENT_TYPE');
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_attendance_event(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_attendance_event(JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. HARDEN reconcile_shift & ADD V2 MANAGEMENT RPCS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_shift(
    p_shift_id UUID,
    p_payable_hours NUMERIC,
    p_overtime_hours NUMERIC,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_actor_type TEXT;
    v_shift RECORD;
    v_adj_id UUID := gen_random_uuid();
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    SELECT role, subsidiary INTO v_caller_role, v_caller_subsidiary
    FROM public.profiles WHERE id = v_uid;

    IF v_caller_role NOT IN ('Manager', 'HR', 'Supervisor', 'Admin', 'SuperAdmin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ROLE');
    END IF;

    IF p_payable_hours IS NULL OR p_payable_hours < 0 OR p_payable_hours > 24
       OR p_overtime_hours IS NULL OR p_overtime_hours < 0 OR p_overtime_hours > 24 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_HOURS_RANGE');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_shift_id::text, 0));

    SELECT * INTO v_shift FROM public.attendance_shifts WHERE shift_id = p_shift_id;
    IF v_shift.shift_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_NOT_FOUND');
    END IF;

    IF v_caller_role NOT IN ('Admin', 'SuperAdmin') AND v_caller_subsidiary IS DISTINCT FROM v_shift.subsidiary THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_SUBSIDIARY_FORBIDDEN');
    END IF;

    v_actor_type := CASE
        WHEN v_caller_role IN ('Admin', 'SuperAdmin') THEN 'ADMIN'
        WHEN v_caller_role = 'Manager' THEN 'MANAGER'
        WHEN v_caller_role = 'HR' THEN 'HR'
        ELSE 'SUPERVISOR'
    END;

    UPDATE public.attendance_shifts
    SET payable_hours = p_payable_hours,
        overtime_hours = p_overtime_hours,
        final_clock_out_at = COALESCE(final_clock_out_at, first_clock_in_at + ((p_payable_hours + p_overtime_hours) || ' hours')::interval),
        physical_duration_minutes = COALESCE(physical_duration_minutes, ROUND((p_payable_hours + p_overtime_hours) * 60)::int),
        status = 'COMPLETED',
        close_method = 'MANUAL_SUPERVISOR_ADJUSTMENT',
        requires_review = FALSE,
        review_status = 'APPROVED',
        review_notes = COALESCE(NULLIF(TRIM(p_reason), ''), 'Reconciliado manualmente'),
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
    WHERE shift_id = p_shift_id;

    INSERT INTO public.attendance_adjustments (
        adjustment_id, shift_id, adjustment_type, previous_values, new_values,
        reason, actor_type, actor_user_id
    ) VALUES (
        v_adj_id, p_shift_id, 'PAYABLE_HOURS_OVERRIDE',
        jsonb_build_object('payable_hours', v_shift.payable_hours, 'overtime_hours', v_shift.overtime_hours, 'status', v_shift.status),
        jsonb_build_object('payable_hours', p_payable_hours, 'overtime_hours', p_overtime_hours, 'status', 'COMPLETED'),
        COALESCE(NULLIF(TRIM(p_reason), ''), 'Reconciliado manualmente'),
        v_actor_type, v_uid
    );

    INSERT INTO public.attendance_audit_log (
        target_type, target_id, action, actor_type, actor_user_id, metadata
    ) VALUES (
        'SHIFT', p_shift_id::text, 'RECONCILIATION_APPROVED', v_actor_type, v_uid,
        jsonb_build_object('adjustment_id', v_adj_id, 'payable_hours', p_payable_hours, 'overtime_hours', p_overtime_hours)
    );

    RETURN jsonb_build_object('success', true, 'shift_id', p_shift_id, 'adjustment_id', v_adj_id);
END;
$$;

-- Quick Approve / Reject Shift
CREATE OR REPLACE FUNCTION public.v2_approve_or_reject_shift(
    p_shift_id UUID,
    p_review_status TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_actor_type TEXT;
    v_shift RECORD;
    v_norm_status TEXT := UPPER(COALESCE(p_review_status, ''));
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;
    IF v_norm_status NOT IN ('APPROVED', 'REJECTED', 'PENDING') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_REVIEW_STATUS');
    END IF;

    SELECT role, subsidiary INTO v_caller_role, v_caller_subsidiary FROM public.profiles WHERE id = v_uid;
    IF v_caller_role NOT IN ('Manager', 'HR', 'Supervisor', 'Admin', 'SuperAdmin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ROLE');
    END IF;

    SELECT * INTO v_shift FROM public.attendance_shifts WHERE shift_id = p_shift_id;
    IF v_shift.shift_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_NOT_FOUND');
    END IF;
    IF v_caller_role NOT IN ('Admin', 'SuperAdmin') AND v_caller_subsidiary IS DISTINCT FROM v_shift.subsidiary THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_SUBSIDIARY_FORBIDDEN');
    END IF;

    v_actor_type := CASE
        WHEN v_caller_role IN ('Admin', 'SuperAdmin') THEN 'ADMIN'
        WHEN v_caller_role = 'Manager' THEN 'MANAGER'
        WHEN v_caller_role = 'HR' THEN 'HR'
        ELSE 'SUPERVISOR'
    END;

    UPDATE public.attendance_shifts
    SET review_status = v_norm_status,
        requires_review = (v_norm_status = 'PENDING'),
        review_notes = COALESCE(NULLIF(TRIM(p_notes), ''), review_notes),
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
    WHERE shift_id = p_shift_id;

    INSERT INTO public.attendance_audit_log (
        target_type, target_id, action, actor_type, actor_user_id, metadata
    ) VALUES (
        'SHIFT', p_shift_id::text, 'SHIFT_ADMIN_CORRECTED', v_actor_type, v_uid,
        jsonb_build_object('review_status', v_norm_status, 'notes', p_notes)
    );

    RETURN jsonb_build_object('success', true, 'shift_id', p_shift_id, 'review_status', v_norm_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.v2_approve_or_reject_shift(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_approve_or_reject_shift(UUID, TEXT, TEXT) TO authenticated;

-- Void / Discard Shift (HR/Manager/Supervisor/Admin)
CREATE OR REPLACE FUNCTION public.v2_void_shift(
    p_shift_id UUID,
    p_reason TEXT DEFAULT 'Anulado por administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_actor_type TEXT;
    v_shift RECORD;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    SELECT role, subsidiary INTO v_caller_role, v_caller_subsidiary FROM public.profiles WHERE id = v_uid;
    IF v_caller_role NOT IN ('Manager', 'HR', 'Supervisor', 'Admin', 'SuperAdmin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ROLE');
    END IF;

    SELECT * INTO v_shift FROM public.attendance_shifts WHERE shift_id = p_shift_id;
    IF v_shift.shift_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_NOT_FOUND');
    END IF;
    IF v_caller_role NOT IN ('Admin', 'SuperAdmin') AND v_caller_subsidiary IS DISTINCT FROM v_shift.subsidiary THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_SUBSIDIARY_FORBIDDEN');
    END IF;

    v_actor_type := CASE
        WHEN v_caller_role IN ('Admin', 'SuperAdmin') THEN 'ADMIN'
        WHEN v_caller_role = 'Manager' THEN 'MANAGER'
        WHEN v_caller_role = 'HR' THEN 'HR'
        ELSE 'SUPERVISOR'
    END;

    UPDATE public.attendance_shifts
    SET final_clock_out_at = COALESCE(final_clock_out_at, first_clock_in_at),
        physical_duration_minutes = 0,
        payable_hours = 0.00,
        overtime_hours = 0.00,
        status = 'COMPLETED',
        close_method = 'MANUAL_SUPERVISOR_ADJUSTMENT',
        requires_review = FALSE,
        review_status = 'REJECTED',
        review_notes = COALESCE(NULLIF(TRIM(p_reason), ''), 'Anulado por administrador'),
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
    WHERE shift_id = p_shift_id;

    INSERT INTO public.attendance_audit_log (
        target_type, target_id, action, actor_type, actor_user_id, metadata
    ) VALUES (
        'SHIFT', p_shift_id::text, 'SHIFT_ADMIN_CORRECTED', v_actor_type, v_uid,
        jsonb_build_object('voided', true, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'shift_id', p_shift_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.v2_void_shift(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_void_shift(UUID, TEXT) TO authenticated;

-- Create Manual Shift (HR/Manager/Supervisor/Admin)
CREATE OR REPLACE FUNCTION public.v2_create_manual_shift(
    p_personnel_id TEXT,
    p_project_id UUID,
    p_work_type TEXT,
    p_clock_in TIMESTAMPTZ,
    p_clock_out TIMESTAMPTZ,
    p_payable_hours NUMERIC,
    p_overtime_hours NUMERIC DEFAULT 0.00,
    p_reason TEXT DEFAULT 'Registro manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_actor_type TEXT;
    v_target_subsidiary TEXT;
    v_shift_id UUID := gen_random_uuid();
    v_work TEXT := CASE WHEN UPPER(COALESCE(p_work_type, 'ON_SITE')) IN ('HOME_OFFICE', 'HOME OFFICE') THEN 'HOME_OFFICE' ELSE 'ON_SITE' END;
    v_dur INT;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    SELECT role, subsidiary INTO v_caller_role, v_caller_subsidiary FROM public.profiles WHERE id = v_uid;
    IF v_caller_role NOT IN ('Manager', 'HR', 'Supervisor', 'Admin', 'SuperAdmin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ROLE');
    END IF;

    IF p_project_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PROJECT_ID_REQUIRED');
    END IF;
    IF p_clock_in IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CLOCK_IN_REQUIRED');
    END IF;
    IF p_clock_out IS NOT NULL AND p_clock_out < p_clock_in THEN
        RETURN jsonb_build_object('success', false, 'error', 'CLOCK_OUT_BEFORE_CLOCK_IN');
    END IF;
    IF COALESCE(p_payable_hours, 8.00) < 0 OR COALESCE(p_payable_hours, 8.00) > 24
       OR COALESCE(p_overtime_hours, 0.00) < 0 OR COALESCE(p_overtime_hours, 0.00) > 24 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_HOURS_RANGE');
    END IF;

    SELECT COALESCE(subsidiary, 'MX') INTO v_target_subsidiary FROM public.mx_personnel WHERE id = p_personnel_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'TARGET_PERSONNEL_NOT_FOUND');
    END IF;
    IF v_caller_role NOT IN ('Admin', 'SuperAdmin') AND v_caller_subsidiary IS DISTINCT FROM v_target_subsidiary THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_SUBSIDIARY_FORBIDDEN');
    END IF;

    IF p_clock_out IS NULL AND EXISTS (
        SELECT 1 FROM public.attendance_shifts WHERE personnel_id = p_personnel_id AND status = 'OPEN'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'ACTIVE_SHIFT_CONFLICT');
    END IF;

    v_dur := CASE WHEN p_clock_out IS NOT NULL AND p_clock_out >= p_clock_in
                  THEN GREATEST(0, EXTRACT(EPOCH FROM (p_clock_out - p_clock_in)) / 60)::int
                  ELSE ROUND((COALESCE(p_payable_hours, 8.00) + COALESCE(p_overtime_hours, 0.00)) * 60)::int END;

    v_actor_type := CASE
        WHEN v_caller_role IN ('Admin', 'SuperAdmin') THEN 'ADMIN'
        WHEN v_caller_role = 'Manager' THEN 'MANAGER'
        WHEN v_caller_role = 'HR' THEN 'HR'
        ELSE 'SUPERVISOR'
    END;

    INSERT INTO public.attendance_shifts (
        shift_id, auth_user_id, personnel_id, project_id, subsidiary, work_type,
        first_clock_in_at, final_clock_out_at, physical_duration_minutes,
        payable_hours, overtime_hours, status, close_method,
        requires_review, review_status, review_notes, reviewed_by, reviewed_at
    ) VALUES (
        v_shift_id, v_uid, p_personnel_id, p_project_id, v_target_subsidiary, v_work,
        p_clock_in, p_clock_out, v_dur,
        GREATEST(0, COALESCE(p_payable_hours, 8.00)), GREATEST(0, COALESCE(p_overtime_hours, 0.00)),
        CASE WHEN p_clock_out IS NULL THEN 'OPEN' ELSE 'COMPLETED' END,
        CASE WHEN p_clock_out IS NULL THEN NULL ELSE 'MANUAL_SUPERVISOR_ADJUSTMENT' END,
        FALSE, 'APPROVED', COALESCE(NULLIF(TRIM(p_reason), ''), 'Registro manual'), v_uid, now()
    );

    INSERT INTO public.attendance_audit_log (
        target_type, target_id, action, actor_type, actor_user_id, metadata
    ) VALUES (
        'SHIFT', v_shift_id::text, 'SHIFT_ADMIN_CORRECTED', v_actor_type, v_uid,
        jsonb_build_object('manual_create', true, 'personnel_id', p_personnel_id, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'shift_id', v_shift_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.v2_create_manual_shift(TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_create_manual_shift(TEXT, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. UPDATE get_attendance_write_mode() TO CONSULT attendance_v2_control
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_attendance_write_mode()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_personnel_id TEXT;
    v_system_state TEXT;
BEGIN
    v_personnel_id := public.get_authoritative_personnel_id();
    SELECT system_state INTO v_system_state FROM public.attendance_v2_control WHERE control_id = 1;

    IF v_system_state IN ('V2_ACTIVE', 'V2_DEGRADED') THEN
        RETURN jsonb_build_object(
            'normalized_attendance_enabled', true,
            'personnel_id', v_personnel_id,
            'mode', 'V2'
        );
    END IF;

    RETURN jsonb_build_object(
        'normalized_attendance_enabled', false,
        'personnel_id', v_personnel_id,
        'mode', 'LEGACY'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_attendance_write_mode() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_write_mode() TO authenticated;

-- ------------------------------------------------------------------------------
-- 9. SCHEDULE pg_cron FOR V2 ZOMBIE SHIFT CLOSURE (8.00h STANDARD)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Unschedule obsolete legacy cron job if present
        PERFORM cron.unschedule(jobid)
        FROM cron.job
        WHERE jobname IN ('autoclose-mx-timesheets', 'v2-zombie-shift-closure');

        -- Schedule V2 zombie shift closure every 30 minutes (threshold 14.00h -> 8.00h standard)
        PERFORM cron.schedule(
            'v2-zombie-shift-closure',
            '*/30 * * * *',
            'SELECT public.run_zombie_shift_closure(14.00);'
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 10. FORCE ALL CLIENTS TO UPDATE TO v5.1.4 (RELEASE 52)
-- ------------------------------------------------------------------------------
UPDATE public.attendance_v2_control
SET minimum_v2_client_release_id = 52,
    minimum_v2_client_version = '5.1.4',
    updated_at = now()
WHERE control_id = 1;

UPDATE public.platform_settings
SET minimum_client_version = '5.1.4',
    minimum_client_version_enabled = TRUE,
    minimum_client_version_effective_at = now()
WHERE id = 'global';

COMMIT;
