-- ==============================================================================
-- PASS 13I-W-R2: MULTI-LOCATION ATTENDANCE ARCHITECTURE
-- Target Supabase Project: dvkkxwtqonjgrvloisid
-- Purpose: Normalized physical location architecture, Mérida Warehouse mapping,
--          scoped media read authorization hardening, and dual-location engine.
-- Server State: LEGACY_ACTIVE (Dormant)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. NORMALIZED PHYSICAL ATTENDANCE LOCATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_locations (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name TEXT NOT NULL,
    location_type TEXT NOT NULL DEFAULT 'SECONDARY_LOCATION',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters NUMERIC(8,2) NOT NULL,
    accuracy_threshold_meters NUMERIC(8,2) NOT NULL DEFAULT 150.00,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_location_radius CHECK (radius_meters > 0),
    CONSTRAINT chk_location_accuracy CHECK (accuracy_threshold_meters > 0),
    CONSTRAINT chk_location_valid_range CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_attendance_locations_lookup 
    ON public.attendance_locations (is_active, valid_from);

-- ------------------------------------------------------------------------------
-- 2. PROJECT-LOCATION AUTHORIZATION MAPPING TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_project_locations (
    project_location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES public.attendance_locations(location_id) ON DELETE RESTRICT,
    authorization_type TEXT NOT NULL DEFAULT 'SECONDARY_LOCATION',
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT chk_project_location_valid_range CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_project_locations_uniq_active 
    ON public.attendance_project_locations (project_id, location_id) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_attendance_project_locations_lookup 
    ON public.attendance_project_locations (project_id, is_active, valid_from);

-- ------------------------------------------------------------------------------
-- 3. AUDIT IMMUTABILITY TRIGGERS FOR PHYSICAL LOCATIONS
-- Parameters (coords, radius, accuracy, relationships) are immutable once inserted.
-- Controlled lifecycle deactivation (is_active, valid_until) is permitted.
-- Deletion is strictly prohibited once referenced.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_attendance_location_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'attendance_locations is audit-immutable: deletion is prohibited.'
            USING ERRCODE = '23514';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.location_id <> OLD.location_id OR
           NEW.latitude <> OLD.latitude OR
           NEW.longitude <> OLD.longitude OR
           NEW.radius_meters <> OLD.radius_meters OR
           NEW.accuracy_threshold_meters <> OLD.accuracy_threshold_meters OR
           NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'attendance_locations parameters are immutable: coordinate or radius modifications require inserting a new location version.'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_locations_immutable ON public.attendance_locations;
CREATE TRIGGER trg_attendance_locations_immutable
BEFORE UPDATE OR DELETE ON public.attendance_locations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_attendance_location_mutation();

CREATE OR REPLACE FUNCTION public.prevent_attendance_project_location_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'attendance_project_locations deletion is prohibited.'
            USING ERRCODE = '23514';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.project_location_id <> OLD.project_location_id OR
           NEW.project_id <> OLD.project_id OR
           NEW.location_id <> OLD.location_id OR
           NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'attendance_project_locations mapping relationship is immutable.'
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_project_locations_immutable ON public.attendance_project_locations;
CREATE TRIGGER trg_attendance_project_locations_immutable
BEFORE UPDATE OR DELETE ON public.attendance_project_locations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_attendance_project_location_mutation();

-- RLS & Privileges on Location Tables
ALTER TABLE public.attendance_locations ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_locations FROM PUBLIC, authenticated, anon;
GRANT SELECT ON public.attendance_locations TO authenticated;

DROP POLICY IF EXISTS p_select_attendance_locations ON public.attendance_locations;
CREATE POLICY p_select_attendance_locations ON public.attendance_locations
    FOR SELECT TO authenticated
    USING (true);

ALTER TABLE public.attendance_project_locations ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_project_locations FROM PUBLIC, authenticated, anon;
GRANT SELECT ON public.attendance_project_locations TO authenticated;

DROP POLICY IF EXISTS p_select_attendance_project_locations ON public.attendance_project_locations;
CREATE POLICY p_select_attendance_project_locations ON public.attendance_project_locations
    FOR SELECT TO authenticated
    USING (true);

-- ------------------------------------------------------------------------------
-- 4. SERVER-DERIVED EVIDENCE COLUMNS IN EVENTS & LEASE SCOPES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attendance_events' 
          AND column_name = 'attendance_location_id'
    ) THEN
        ALTER TABLE public.attendance_events 
        ADD COLUMN attendance_location_id UUID NULL 
        REFERENCES public.attendance_locations(location_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attendance_events' 
          AND column_name = 'project_location_id'
    ) THEN
        ALTER TABLE public.attendance_events 
        ADD COLUMN project_location_id UUID NULL 
        REFERENCES public.attendance_project_locations(project_location_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attendance_offline_lease_scopes' 
          AND column_name = 'secondary_location_id'
    ) THEN
        ALTER TABLE public.attendance_offline_lease_scopes 
        ADD COLUMN secondary_location_id UUID NULL 
        REFERENCES public.attendance_locations(location_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attendance_offline_lease_scopes' 
          AND column_name = 'project_location_id'
    ) THEN
        ALTER TABLE public.attendance_offline_lease_scopes 
        ADD COLUMN project_location_id UUID NULL 
        REFERENCES public.attendance_project_locations(project_location_id) ON DELETE RESTRICT;
    END IF;

    ALTER TABLE public.attendance_events DROP CONSTRAINT IF EXISTS chk_events_geofence_status;
    ALTER TABLE public.attendance_events ADD CONSTRAINT chk_events_geofence_status 
        CHECK (geofence_status = ANY (ARRAY['INSIDE'::text, 'OUTSIDE'::text, 'UNKNOWN'::text, 'BYPASS_AUTHORIZED'::text, 'SECONDARY_GEOFENCE'::text, 'NOT_APPLICABLE'::text]));
END $$;

-- ------------------------------------------------------------------------------
-- 5. ATTENDANCE AUTHORIZATION HELPER CORRECTION (JSONB FIX)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_attendance_shift(
    p_shift_personnel_id text,
    p_shift_project_id uuid,
    p_shift_subsidiary text
)
RETURNS boolean
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

    -- Worker / Tech: Own attendance only
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

    -- Fail-closed cross-subsidiary boundary
    IF v_caller_role <> 'Customer' AND v_caller_subsidiary <> p_shift_subsidiary THEN
        RETURN FALSE;
    END IF;

    -- Manager / HR: Full visibility within their own subsidiary
    IF v_caller_role IN ('Manager', 'HR') THEN
        RETURN TRUE;
    END IF;

    -- Supervisor: Own + Direct Reports + Assigned Site Leads within subsidiary
    IF v_caller_role = 'Supervisor' THEN
        -- Check direct report
        SELECT EXISTS (
            SELECT 1 FROM public.mx_personnel 
            WHERE id = p_shift_personnel_id AND supervisor_id = v_caller_personnel_id
        ) INTO v_is_supervisor_of;

        IF v_is_supervisor_of THEN
            RETURN TRUE;
        END IF;

        -- Check site lead / project assignment
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

        IF v_is_assigned_project THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Office: Own + Assigned projects within subsidiary
    IF v_caller_role = 'Office' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_shift_project_id 
              AND (
                  to_jsonb(assigned_personnel) ? (v_uid::text) OR 
                  (v_caller_personnel_id IS NOT NULL AND to_jsonb(assigned_personnel) ? v_caller_personnel_id)
              )
        ) INTO v_is_assigned_project;

        IF v_is_assigned_project THEN
            RETURN TRUE;
        END IF;
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

-- ------------------------------------------------------------------------------
-- 6. HARDENED MEDIA READ AUTHORIZATION FUNCTION (SECTIONS 18, 19, 20, 21)
-- Derives authorization strictly through underlying attendance record chain:
-- storage.objects -> attendance_event_media -> attendance_events -> attendance_shifts
-- Role boundary: Tech own only, Supervisor scoped, Manager scoped, HR scoped.
-- Office and Customer strictly DENIED.
-- ------------------------------------------------------------------------------
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

    IF v_caller_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Explicit strict denial for Office and Customer (biometric selfie privacy)
    IF v_caller_role IN ('Office', 'Customer') THEN
        RETURN FALSE;
    END IF;

    -- Resolve confirmed attendance media record
    SELECT s.personnel_id, s.project_id, s.subsidiary
    INTO v_shift
    FROM public.attendance_event_media m
    JOIN public.attendance_events e ON e.event_id = m.event_id
    JOIN public.attendance_shifts s ON s.shift_id = e.shift_id
    WHERE m.storage_path = p_storage_path;

    IF v_shift.personnel_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Tech: Own media only
    IF v_caller_role = 'Tech' THEN
        v_caller_personnel_id := public.get_authoritative_personnel_id();
        RETURN (v_caller_personnel_id IS NOT NULL AND v_caller_personnel_id = v_shift.personnel_id);
    END IF;

    -- Fail-closed cross-subsidiary boundary for staff
    IF v_caller_subsidiary <> v_shift.subsidiary THEN
        RETURN FALSE;
    END IF;

    -- 2. Manager / HR: Authorized within subsidiary
    IF v_caller_role IN ('Manager', 'HR') THEN
        RETURN TRUE;
    END IF;

    -- 3. Supervisor: Direct reports or assigned project / site lead
    IF v_caller_role = 'Supervisor' THEN
        v_caller_personnel_id := public.get_authoritative_personnel_id();

        -- Check direct report
        SELECT EXISTS (
            SELECT 1 FROM public.mx_personnel 
            WHERE id = v_shift.personnel_id AND supervisor_id = v_caller_personnel_id
        ) INTO v_is_supervisor_of;

        IF v_is_supervisor_of THEN
            RETURN TRUE;
        END IF;

        -- Check project assignment / site lead
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

    -- Unknown role fail-closed
    RETURN FALSE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_attendance_media(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_attendance_media(TEXT) TO authenticated;

-- Storage Policy Update
DROP POLICY IF EXISTS "attendance_v2_media_authenticated_read" ON storage.objects;
CREATE POLICY "attendance_v2_media_authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'attendance-v2-media-private'
    AND public.can_read_attendance_media(name)
);

-- ------------------------------------------------------------------------------
-- 7. UPDATE ISSUE_ATTENDANCE_OFFLINE_LEASE RPC
-- Embeds project's authorized secondary physical locations in lease scope.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_attendance_offline_lease(
    p_device_id TEXT,
    p_duration_hours INT DEFAULT 72,
    p_client_release_id INT DEFAULT 48,
    p_client_app_version TEXT DEFAULT 'v5.0.8'
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
    v_lease_id UUID;
    v_valid_from TIMESTAMPTZ := now();
    v_valid_until TIMESTAMPTZ;
    v_max_duration INT := 72;
    v_protocol_version INT := 2;
    v_system_state TEXT;
    v_project RECORD;
    v_geofence RECORD;
    v_sec_loc RECORD;
    v_scopes JSONB := '[]'::jsonb;
    v_scope_entry JSONB;
    v_sec_locs JSONB;
    v_assigned_count INT := 0;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    v_personnel_id := public.get_authoritative_personnel_id();
    IF v_personnel_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'IDENTITY_RESOLUTION_FAILED');
    END IF;

    SELECT subsidiary INTO v_subsidiary FROM public.mx_personnel WHERE id = v_personnel_id;
    IF v_subsidiary IS NULL THEN
        v_subsidiary := 'MX';
    END IF;

    -- Gate on control plane
    SELECT system_state, max_offline_lease_duration_hours, protocol_version 
    INTO v_system_state, v_max_duration, v_protocol_version
    FROM public.attendance_v2_control 
    WHERE control_id = 1;

    IF v_system_state <> 'V2_ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'V2_DISABLED', 'reason', v_system_state);
    END IF;

    IF p_duration_hours > v_max_duration THEN
        p_duration_hours := v_max_duration;
    END IF;
    v_valid_until := v_valid_from + (p_duration_hours || ' hours')::interval;

    v_lease_id := gen_random_uuid();

    INSERT INTO public.attendance_offline_leases (
        lease_id, auth_user_id, personnel_id, valid_from, valid_until,
        attendance_protocol_version, client_release_id, client_app_version, device_id,
        is_revoked, issued_at
    ) VALUES (
        v_lease_id, v_uid, v_personnel_id, v_valid_from, v_valid_until,
        v_protocol_version, p_client_release_id, p_client_app_version, p_device_id,
        FALSE, v_valid_from
    );

    -- Find all projects assigned to this personnel
    FOR v_project IN 
        SELECT id, name FROM public.projects 
        WHERE to_jsonb(assigned_personnel) ? v_personnel_id 
           OR to_jsonb(assigned_personnel) ? (v_uid::text)
    LOOP
        SELECT * INTO v_geofence 
        FROM public.project_geofence_versions 
        WHERE project_id = v_project.id 
        ORDER BY effective_from DESC LIMIT 1;

        IF v_geofence.version_id IS NOT NULL THEN
            -- Check for active secondary physical locations mapped to this project
            v_sec_locs := '[]'::jsonb;
            v_sec_loc := NULL;

            FOR v_sec_loc IN
                SELECT pl.project_location_id, l.location_id, l.location_name, l.location_type,
                       l.latitude, l.longitude, l.radius_meters, l.accuracy_threshold_meters
                FROM public.attendance_project_locations pl
                JOIN public.attendance_locations l ON l.location_id = pl.location_id
                WHERE pl.project_id = v_project.id
                  AND pl.is_active = TRUE
                  AND pl.valid_from <= now()
                  AND (pl.valid_until IS NULL OR pl.valid_until > now())
                  AND l.is_active = TRUE
                  AND l.valid_from <= now()
                  AND (l.valid_until IS NULL OR l.valid_until > now())
                ORDER BY pl.created_at ASC
            LOOP
                v_sec_locs := v_sec_locs || jsonb_build_object(
                    'location_id', v_sec_loc.location_id,
                    'project_location_id', v_sec_loc.project_location_id,
                    'location_name', v_sec_loc.location_name,
                    'location_type', v_sec_loc.location_type,
                    'latitude', v_sec_loc.latitude,
                    'longitude', v_sec_loc.longitude,
                    'radius_meters', v_sec_loc.radius_meters,
                    'accuracy_threshold_meters', v_sec_loc.accuracy_threshold_meters
                );
            END LOOP;

            INSERT INTO public.attendance_offline_lease_scopes (
                scope_id, lease_id, project_id, geofence_version_id,
                warehouse_bypass_allowed, home_office_allowed,
                secondary_location_id, project_location_id
            ) VALUES (
                gen_random_uuid(), v_lease_id, v_project.id, v_geofence.version_id,
                v_geofence.warehouse_bypass_allowed, v_geofence.home_office_allowed,
                v_sec_loc.location_id, v_sec_loc.project_location_id
            );

            v_scope_entry := jsonb_build_object(
                'project_id', v_project.id,
                'project_name', v_project.name,
                'geofence_version_id', v_geofence.version_id,
                'latitude', v_geofence.latitude,
                'longitude', v_geofence.longitude,
                'radius_meters', v_geofence.radius_meters,
                'accuracy_threshold_meters', v_geofence.accuracy_threshold_meters,
                'warehouse_bypass_allowed', v_geofence.warehouse_bypass_allowed,
                'home_office_allowed', v_geofence.home_office_allowed,
                'secondary_locations', v_sec_locs
            );

            v_scopes := v_scopes || v_scope_entry;
            v_assigned_count := v_assigned_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'lease_id', v_lease_id,
        'auth_user_id', v_uid,
        'personnel_id', v_personnel_id,
        'subsidiary', v_subsidiary,
        'valid_from', v_valid_from,
        'valid_until', v_valid_until,
        'attendance_protocol_version', v_protocol_version,
        'scopes_assigned_count', v_assigned_count,
        'scopes', v_scopes
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_attendance_offline_lease(TEXT, INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_attendance_offline_lease(TEXT, INT, INT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. UPDATE RECORD_ATTENDANCE_EVENT RPC
-- Multi-location online geofence evaluation and offline server-side revalidation.
-- Differentiates PRIMARY_GEOFENCE vs. SECONDARY_GEOFENCE.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance_event(p_event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_personnel_id TEXT;
    v_subsidiary TEXT;
    
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
    v_attendance_location_id UUID := NULL;
    v_project_location_id UUID := NULL;
    v_face_verified BOOLEAN;
    v_face_bypass_reason TEXT;
    v_is_manual_adjustment BOOLEAN;
    v_adjustment_reason TEXT;
    v_reported_departure TIMESTAMPTZ;
    v_worker_explanation TEXT;
    
    v_system_state TEXT;
    v_min_release_id INT;
    v_approved_protocol INT;
    v_canonical_hash TEXT;
    v_existing_event RECORD;
    v_active_shift RECORD;
    v_active_geofence RECORD;
    v_sec_loc RECORD;
    v_server_distance NUMERIC;
    v_secondary_distance NUMERIC;
    v_server_geofence_status TEXT;
    v_lease RECORD;
    v_scope RECORD;
    v_duration_minutes INT;
    v_payable_hours NUMERIC(6,2);
    v_overtime_hours NUMERIC(6,2);
    v_close_method TEXT;
    v_requires_review BOOLEAN := FALSE;
    v_review_status TEXT := 'NONE';
    v_is_assigned_project BOOLEAN := FALSE;
BEGIN
    -- 1. Authentication & System State Gate
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'NOT_AUTHENTICATED');
    END IF;

    SELECT system_state, minimum_v2_client_release_id, protocol_version 
    INTO v_system_state, v_min_release_id, v_approved_protocol
    FROM public.attendance_v2_control 
    WHERE control_id = 1;

    IF v_system_state <> 'V2_ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'V2_DISABLED', 'reason', v_system_state);
    END IF;

    -- 2. Extract Event Parameters
    v_event_id := (p_event->>'event_id')::uuid;
    v_shift_id := (p_event->>'shift_id')::uuid;
    v_project_id := (p_event->>'project_id')::uuid;
    v_event_type := upper(p_event->>'event_type');
    v_work_type := upper(p_event->>'work_type');
    v_device_event_timestamp := (p_event->>'device_event_timestamp')::timestamptz;
    v_tz_offset := (p_event->>'timezone_offset_minutes')::smallint;
    v_device_id := p_event->>'device_id';
    v_device_platform := p_event->>'device_platform';
    v_client_app_version := p_event->>'client_app_version';
    v_client_release_id := (p_event->>'client_release_id')::int;
    v_client_commit_hash := p_event->>'client_commit_hash';
    v_protocol_version := (p_event->>'attendance_protocol_version')::int;
    v_created_offline := coalesce((p_event->>'created_offline')::boolean, false);
    v_offline_lease_id := (p_event->>'offline_lease_id')::uuid;
    v_lat := (p_event->>'latitude')::numeric;
    v_lon := (p_event->>'longitude')::numeric;
    v_accuracy := (p_event->>'accuracy_meters')::numeric;
    v_gps_verified := coalesce((p_event->>'gps_verified')::boolean, false);
    v_geofence_status := upper(p_event->>'geofence_status');
    v_geofence_distance := (p_event->>'geofence_distance_meters')::numeric;
    v_geofence_version_id := (p_event->>'geofence_version_id')::uuid;
    v_face_verified := coalesce((p_event->>'face_verified')::boolean, false);
    v_face_bypass_reason := p_event->>'face_bypass_reason';
    v_is_manual_adjustment := coalesce((p_event->>'is_manual_adjustment')::boolean, false);
    v_adjustment_reason := p_event->>'adjustment_reason';
    v_reported_departure := (p_event->>'reported_departure_timestamp')::timestamptz;
    v_worker_explanation := p_event->>'worker_explanation';

    -- 3. Idempotency Check & Canonical Hash
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
                'error', 'CANONICAL_HASH_MISMATCH',
                'message', 'IMMUTABLE_EVENT_PAYLOAD_MISMATCH: Event ID exists with different payload'
            );
        END IF;
    END IF;

    -- Identity Verification (STEP A)
    v_personnel_id := public.get_authoritative_personnel_id();
    IF v_personnel_id IS NULL OR v_personnel_id <> (p_event->>'personnel_id') THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'IDENTITY_SPOOF_ATTEMPT');
    END IF;

    SELECT subsidiary INTO v_subsidiary FROM public.mx_personnel WHERE id = v_personnel_id;
    IF v_subsidiary IS NULL THEN
        v_subsidiary := 'MX';
    END IF;

    -- Project Assignment Authorization (STEP B)
    SELECT EXISTS (
        SELECT 1 FROM public.projects 
        WHERE id = v_project_id 
          AND (
              to_jsonb(assigned_personnel) ? v_personnel_id 
              OR to_jsonb(assigned_personnel) ? (v_uid::text)
          )
    ) INTO v_is_assigned_project;

    IF NOT v_is_assigned_project THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'PROJECT_NOT_ASSIGNED', 'message', 'Worker is not authorized for target project');
    END IF;

    -- Client Release Gate
    IF v_min_release_id IS NOT NULL AND (v_client_release_id IS NULL OR v_client_release_id < v_min_release_id) THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CLIENT_VERSION_DEPRECATED');
    END IF;

    -- 4. Offline Lease Verification (if event created offline)
    IF v_created_offline THEN
        IF v_offline_lease_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_MISSING');
        END IF;

        SELECT * INTO v_lease FROM public.attendance_offline_leases WHERE lease_id = v_offline_lease_id;
        IF v_lease.lease_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_NOT_FOUND');
        END IF;

        IF v_lease.auth_user_id <> v_uid OR v_lease.personnel_id <> v_personnel_id THEN
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

        IF v_geofence_version_id IS NOT NULL AND v_geofence_version_id <> v_scope.geofence_version_id THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_GEOFENCE_MISMATCH');
        END IF;

        -- Server-Side Revalidation for ON_SITE offline punches
        IF v_work_type = 'ON_SITE' THEN
            IF v_lat IS NULL OR v_lon IS NULL OR NOT v_gps_verified THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_UNVERIFIED');
            END IF;

            SELECT * INTO v_active_geofence 
            FROM public.project_geofence_versions 
            WHERE version_id = v_scope.geofence_version_id;

            IF v_active_geofence.version_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GEOFENCE_NOT_CONFIGURED');
            END IF;

            v_server_distance := public.calculate_geofence_distance_meters(
                v_lat::double precision, v_lon::double precision,
                v_active_geofence.latitude, v_active_geofence.longitude
            );

            -- Check primary geofence
            IF (v_accuracy IS NOT NULL AND v_accuracy <= v_active_geofence.accuracy_threshold_meters)
               AND v_server_distance <= v_active_geofence.radius_meters THEN
                v_server_geofence_status := 'PRIMARY_GEOFENCE';
                v_attendance_location_id := NULL;
                v_project_location_id := NULL;
            ELSE
                -- Check if lease scope authorized secondary physical location
                IF v_scope.secondary_location_id IS NOT NULL THEN
                    SELECT * INTO v_sec_loc
                    FROM public.attendance_locations
                    WHERE location_id = v_scope.secondary_location_id
                      AND is_active = TRUE;

                    IF v_sec_loc.location_id IS NOT NULL THEN
                        v_secondary_distance := public.calculate_geofence_distance_meters(
                            v_lat::double precision, v_lon::double precision,
                            v_sec_loc.latitude, v_sec_loc.longitude
                        );

                        IF (v_accuracy IS NOT NULL AND v_accuracy <= v_sec_loc.accuracy_threshold_meters)
                           AND v_secondary_distance <= v_sec_loc.radius_meters THEN
                            v_server_distance := v_secondary_distance;
                            v_server_geofence_status := 'SECONDARY_GEOFENCE';
                            v_attendance_location_id := v_sec_loc.location_id;
                            v_project_location_id := v_scope.project_location_id;
                        ELSE
                            IF v_accuracy IS NOT NULL AND v_accuracy > v_sec_loc.accuracy_threshold_meters THEN
                                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                            ELSE
                                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                            END IF;
                        END IF;
                    ELSE
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                    END IF;
                ELSE
                    -- No secondary location authorized in lease scope
                    IF v_accuracy IS NOT NULL AND v_accuracy > v_active_geofence.accuracy_threshold_meters THEN
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                    ELSE
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                    END IF;
                END IF;
            END IF;
        ELSE
            -- Home Office offline
            v_server_geofence_status := v_geofence_status;
            v_server_distance := v_geofence_distance;
        END IF;
    END IF;

    -- 5. Clock-In vs Clock-Out Routing
    IF v_event_type = 'CLOCK_IN' THEN
        PERFORM pg_advisory_xact_lock(hashtextextended(v_personnel_id, 0));

        SELECT * INTO v_active_shift 
        FROM public.attendance_shifts 
        WHERE personnel_id = v_personnel_id AND status = 'OPEN';

        IF v_active_shift.shift_id IS NOT NULL THEN
            IF v_active_shift.shift_id = v_shift_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'CONFLICT', 'error', 'CLOCK_IN_ALREADY_EXISTS');
            ELSE
                RETURN jsonb_build_object('success', false, 'status', 'ACTIVE_SHIFT_CONFLICT', 'error', 'Worker already has an active OPEN shift');
            END IF;
        END IF;

        -- Geofence Validation for Online On-Site Clock-In
        IF v_work_type = 'ON_SITE' AND NOT v_created_offline THEN
            -- STEP C: Primary Geofence Check
            SELECT * INTO v_active_geofence 
            FROM public.project_geofence_versions 
            WHERE project_id = v_project_id 
            ORDER BY effective_from DESC LIMIT 1;

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
                v_attendance_location_id := NULL;
                v_project_location_id := NULL;
            ELSE
                -- STEP D: Secondary Physical Locations Check
                SELECT pl.project_location_id, l.location_id, l.latitude, l.longitude,
                       l.radius_meters, l.accuracy_threshold_meters
                INTO v_sec_loc
                FROM public.attendance_project_locations pl
                JOIN public.attendance_locations l ON l.location_id = pl.location_id
                WHERE pl.project_id = v_project_id
                  AND pl.is_active = TRUE
                  AND pl.valid_from <= now()
                  AND (pl.valid_until IS NULL OR pl.valid_until > now())
                  AND l.is_active = TRUE
                  AND l.valid_from <= now()
                  AND (l.valid_until IS NULL OR l.valid_until > now())
                ORDER BY pl.created_at ASC LIMIT 1;

                IF v_sec_loc.location_id IS NOT NULL THEN
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
                    ELSE
                        IF v_accuracy IS NOT NULL AND v_accuracy > v_sec_loc.accuracy_threshold_meters THEN
                            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                        ELSE
                            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                        END IF;
                    END IF;
                ELSE
                    -- STEP E: No secondary physical locations authorized
                    IF v_accuracy IS NOT NULL AND v_accuracy > v_active_geofence.accuracy_threshold_meters THEN
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                    ELSE
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                    END IF;
                END IF;
            END IF;
        ELSE
            IF NOT v_created_offline THEN
                v_server_geofence_status := v_geofence_status;
                v_server_distance := v_geofence_distance;
            END IF;
        END IF;

        -- Create shift and event atomically
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

    ELSIF v_event_type = 'CLOCK_OUT' THEN
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

        IF v_device_event_timestamp < v_active_shift.first_clock_in_at THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CLOCK_OUT_BEFORE_CLOCK_IN');
        END IF;

        IF v_adjustment_reason = 'FORGOTTEN_CLOCKOUT' THEN
            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_reported_departure - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := 8.00;
            v_overtime_hours := 0.00;
            v_close_method := 'FORGOTTEN_CLOCKOUT_8H';
            v_requires_review := TRUE;
            v_review_status := 'PENDING';
            v_server_geofence_status := 'BYPASS_AUTHORIZED';
        ELSE
            -- Normal Clock-Out Geofence Check
            IF v_work_type = 'ON_SITE' AND NOT v_created_offline THEN
                SELECT * INTO v_active_geofence 
                FROM public.project_geofence_versions 
                WHERE project_id = v_project_id 
                ORDER BY effective_from DESC LIMIT 1;

                IF v_active_geofence.version_id IS NOT NULL THEN
                    v_geofence_version_id := v_active_geofence.version_id;
                    v_server_distance := public.calculate_geofence_distance_meters(
                        v_lat::double precision, v_lon::double precision,
                        v_active_geofence.latitude, v_active_geofence.longitude
                    );

                    -- Primary geofence check
                    IF (v_accuracy IS NOT NULL AND v_accuracy <= v_active_geofence.accuracy_threshold_meters)
                       AND v_server_distance <= v_active_geofence.radius_meters THEN
                        v_server_geofence_status := 'PRIMARY_GEOFENCE';
                        v_attendance_location_id := NULL;
                        v_project_location_id := NULL;
                    ELSE
                        -- Secondary physical locations check
                        SELECT pl.project_location_id, l.location_id, l.latitude, l.longitude,
                               l.radius_meters, l.accuracy_threshold_meters
                        INTO v_sec_loc
                        FROM public.attendance_project_locations pl
                        JOIN public.attendance_locations l ON l.location_id = pl.location_id
                        WHERE pl.project_id = v_project_id
                          AND pl.is_active = TRUE
                          AND pl.valid_from <= now()
                          AND (pl.valid_until IS NULL OR pl.valid_until > now())
                          AND l.is_active = TRUE
                          AND l.valid_from <= now()
                          AND (l.valid_until IS NULL OR l.valid_until > now())
                        ORDER BY pl.created_at ASC LIMIT 1;

                        IF v_sec_loc.location_id IS NOT NULL THEN
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
                            ELSE
                                IF v_accuracy IS NOT NULL AND v_accuracy > v_sec_loc.accuracy_threshold_meters THEN
                                    RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                                ELSE
                                    RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                                END IF;
                            END IF;
                        ELSE
                            IF v_accuracy IS NOT NULL AND v_accuracy > v_active_geofence.accuracy_threshold_meters THEN
                                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                            ELSE
                                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                            END IF;
                        END IF;
                    END IF;
                END IF;
            ELSE
                IF NOT v_created_offline THEN
                    v_server_geofence_status := v_geofence_status;
                    v_server_distance := v_geofence_distance;
                END IF;
            END IF;

            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_device_event_timestamp - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := round((v_duration_minutes / 60.0)::numeric, 2);
            v_overtime_hours := GREATEST(0.00, v_payable_hours - 8.00);
            v_close_method := 'NORMAL_CLOCK_OUT';
        END IF;

        IF v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN
            UPDATE public.attendance_shifts
            SET final_clock_out_at = v_device_event_timestamp,
                physical_duration_minutes = v_duration_minutes,
                requires_review = TRUE,
                review_status = 'PENDING',
                updated_at = now()
            WHERE shift_id = v_shift_id;
        ELSE
            UPDATE public.attendance_shifts
            SET final_clock_out_at = v_device_event_timestamp,
                physical_duration_minutes = v_duration_minutes,
                payable_hours = v_payable_hours,
                overtime_hours = v_overtime_hours,
                status = CASE WHEN v_requires_review THEN 'REQUIRES_REVIEW' ELSE 'COMPLETED' END,
                close_method = v_close_method,
                requires_review = v_requires_review,
                review_status = v_review_status,
                updated_at = now()
            WHERE shift_id = v_shift_id;
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

        RETURN jsonb_build_object(
            'success', true,
            'status', 'APPLIED',
            'event_id', v_event_id,
            'shift_id', v_shift_id,
            'event_type', 'CLOCK_OUT',
            'payable_hours', v_payable_hours,
            'overtime_hours', v_overtime_hours,
            'duration_minutes', v_duration_minutes,
            'authorization_policy', v_server_geofence_status
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'INVALID_EVENT_TYPE');
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_attendance_event(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_attendance_event(JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 9. SEED MÉRIDA WAREHOUSE PHYSICAL LOCATION & MAPPING
-- Location: Mérida Warehouse (20.93019, -89.67442, radius 250m)
-- Project: Mérida (c95e8081-3323-4c55-87f5-259207865768)
-- ------------------------------------------------------------------------------
INSERT INTO public.attendance_locations (
    location_id,
    location_name,
    location_type,
    latitude,
    longitude,
    radius_meters,
    accuracy_threshold_meters,
    valid_from,
    valid_until,
    is_active,
    created_at
) VALUES (
    'e110ca71-0000-4000-a000-000000000001'::uuid,
    'Mérida Warehouse',
    'WAREHOUSE',
    20.93019,
    -89.67442,
    250.00,
    150.00,
    '2026-10-15 00:00:00+00'::timestamptz,
    NULL,
    TRUE,
    now()
) ON CONFLICT (location_id) DO NOTHING;

INSERT INTO public.attendance_project_locations (
    project_location_id,
    project_id,
    location_id,
    authorization_type,
    valid_from,
    valid_until,
    is_active,
    created_at
) VALUES (
    'e110ca71-0000-4000-a000-000000000002'::uuid,
    'c95e8081-3323-4c55-87f5-259207865768'::uuid,
    'e110ca71-0000-4000-a000-000000000001'::uuid,
    'SECONDARY_LOCATION',
    '2026-10-15 00:00:00+00'::timestamptz,
    NULL,
    TRUE,
    now()
) ON CONFLICT (project_location_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 10. TRANSACTIONAL SANITY ASSERTIONS (FAIL-CLOSED)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_loc_count INT;
    v_proj_loc_count INT;
    v_wh_bypass_count INT;
    v_merida_sec_count INT;
BEGIN
    SELECT count(*) INTO v_loc_count FROM public.attendance_locations;
    IF v_loc_count <> 1 THEN
        RAISE EXCEPTION 'PASS 13I-W-R2 Gate Failed: Expected exactly 1 physical location, found %', v_loc_count;
    END IF;

    SELECT count(*) INTO v_proj_loc_count FROM public.attendance_project_locations;
    IF v_proj_loc_count <> 1 THEN
        RAISE EXCEPTION 'PASS 13I-W-R2 Gate Failed: Expected exactly 1 project location mapping, found %', v_proj_loc_count;
    END IF;

    SELECT count(*) INTO v_merida_sec_count 
    FROM public.attendance_project_locations pl
    JOIN public.attendance_locations l ON l.location_id = pl.location_id
    WHERE pl.project_id = 'c95e8081-3323-4c55-87f5-259207865768'
      AND pl.is_active = TRUE
      AND l.location_name = 'Mérida Warehouse';
    IF v_merida_sec_count <> 1 THEN
        RAISE EXCEPTION 'PASS 13I-W-R2 Gate Failed: Mérida Warehouse mapping verification failed!';
    END IF;

    -- Verify warehouse_bypass_allowed remains 0 across all 25 projects
    SELECT count(*) INTO v_wh_bypass_count 
    FROM public.project_geofence_versions 
    WHERE warehouse_bypass_allowed = TRUE;
    IF v_wh_bypass_count > 0 THEN
        RAISE EXCEPTION 'PASS 13I-W-R2 Gate Failed: warehouse_bypass_allowed must remain 0, found %', v_wh_bypass_count;
    END IF;

    -- Verify operational attendance tables remain 0
    IF (SELECT count(*) FROM public.attendance_shifts) > 0 OR
       (SELECT count(*) FROM public.attendance_events) > 0 OR
       (SELECT count(*) FROM public.attendance_offline_leases) > 0 THEN
        RAISE EXCEPTION 'PASS 13I-W-R2 Gate Failed: Operational attendance tables are not clean!';
    END IF;
END $$;

COMMIT;
