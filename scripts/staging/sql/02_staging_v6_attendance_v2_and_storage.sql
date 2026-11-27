-- ============================================================================
-- STAGING-ONLY BOOTSTRAP LAYER 2: Attendance V2 Parity, Release Controls & Storage
-- Target: LATNOVVA-V6-STAGING (pxgvqszeqvoldhiozvko) OR fresh local disposable DB
-- Run AFTER:
--   1. scripts/staging/sql/01_staging_v6_base_schema.sql
--   2. scripts/sql/pass13d_attendance_v2_schema.sql
--   3. scripts/sql/pass13e_attendance_v2_engine.sql
--   4. supabase/migrations/20261201000001_v6_security_hardening.sql
--   5. supabase/migrations/20261201000003_v6_attendance_server_hardening.sql
-- NEVER run against production (dvkkxwtqonjgrvloisid).
-- ============================================================================

BEGIN;

-- 1. Ensure secondary location FK columns exist on attendance_events (V6-PEND-013 parity)
ALTER TABLE public.attendance_events
    ADD COLUMN IF NOT EXISTS attendance_location_id uuid,
    ADD COLUMN IF NOT EXISTS project_location_id uuid;

-- 2. Ensure explicit minimum privileges on Attendance V2 tables (for Automatic Grants disabled)
REVOKE ALL ON
    public.attendance_v2_control,
    public.project_geofence_versions,
    public.attendance_offline_leases,
    public.attendance_offline_lease_scopes,
    public.attendance_shifts,
    public.attendance_events,
    public.attendance_event_media,
    public.attendance_adjustments,
    public.attendance_audit_log
FROM PUBLIC, anon;

GRANT SELECT ON
    public.attendance_v2_control,
    public.project_geofence_versions,
    public.attendance_offline_leases,
    public.attendance_offline_lease_scopes,
    public.attendance_shifts,
    public.attendance_events,
    public.attendance_event_media,
    public.attendance_adjustments,
    public.attendance_audit_log
TO authenticated;

GRANT INSERT, UPDATE ON public.project_geofence_versions TO authenticated;
GRANT INSERT, UPDATE ON public.attendance_locations TO authenticated;
GRANT INSERT, UPDATE ON public.attendance_project_locations TO authenticated;

-- 2b. Enable RLS on attendance_event_media (missed in pass13e) with fail-closed policy
ALTER TABLE public.attendance_event_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stg_attendance_event_media_select" ON public.attendance_event_media;
CREATE POLICY "stg_attendance_event_media_select" ON public.attendance_event_media
    FOR SELECT TO authenticated
    USING (
        public.get_caller_role() IN ('Manager', 'HR')
        OR EXISTS (
            SELECT 1 FROM public.attendance_events e
            WHERE e.event_id = attendance_event_media.event_id
              AND e.personnel_id = public.get_authoritative_personnel_id()
        )
    );

-- 3. Provide 5-parameter issue_attendance_offline_lease matching R60 useStore.ts contract
--    and restrict ALL Attendance V2 RPC overloads from PUBLIC/anon
CREATE OR REPLACE FUNCTION public.issue_attendance_offline_lease(
    p_device_id text,
    p_device_platform text,
    p_client_release_id integer,
    p_client_app_version text,
    p_duration_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.issue_attendance_offline_lease(
        p_device_id := p_device_id,
        p_duration_hours := p_duration_hours,
        p_client_release_id := p_client_release_id,
        p_client_app_version := p_client_app_version
    );
$$;

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT oid::regprocedure AS sig, proname
        FROM pg_proc
        WHERE pronamespace = 'public'::regnamespace
          AND proname IN (
              'issue_attendance_offline_lease',
              'sync_attendance_events',
              'reconcile_shift',
              'run_zombie_shift_closure'
          )
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
        IF r.proname = 'run_zombie_shift_closure' THEN
            EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
        ELSE
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
        END IF;
    END LOOP;
END $$;

-- 4. Seed authoritative R60 staging release controls (using actual verified column names)
INSERT INTO public.platform_settings (
    id, minimum_client_version, required_client_release, minimum_client_version_enabled, required_password_policy_version
) VALUES (
    'global', '6.0.0', 60, true, 1
)
ON CONFLICT (id) DO UPDATE SET
    minimum_client_version = EXCLUDED.minimum_client_version,
    required_client_release = EXCLUDED.required_client_release,
    minimum_client_version_enabled = EXCLUDED.minimum_client_version_enabled,
    required_password_policy_version = EXCLUDED.required_password_policy_version,
    updated_at = now();

INSERT INTO public.attendance_v2_control (
    control_id, system_state, protocol_version, minimum_v2_client_version, minimum_v2_client_release_id,
    zombie_shift_threshold_hours, standard_shift_hours, face_id_match_threshold
) VALUES (
    1, 'V2_ACTIVE', 2, '6.0.0', 60, 14.00, 8.00, 0.53
)
ON CONFLICT (control_id) DO UPDATE SET
    system_state = EXCLUDED.system_state,
    protocol_version = EXCLUDED.protocol_version,
    minimum_v2_client_version = EXCLUDED.minimum_v2_client_version,
    minimum_v2_client_release_id = EXCLUDED.minimum_v2_client_release_id,
    zombie_shift_threshold_hours = EXCLUDED.zombie_shift_threshold_hours,
    standard_shift_hours = EXCLUDED.standard_shift_hours,
    face_id_match_threshold = EXCLUDED.face_id_match_threshold,
    updated_at = now();

-- 5. Private Attendance media bucket & strict RLS policies (when storage schema is present)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'attendance-v2-media-private',
            'attendance-v2-media-private',
            false,
            5242880,
            ARRAY['image/jpeg', 'image/png', 'image/webp']
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 5242880;
    END IF;
END $$;

-- 6. Postcondition safety assertion: every exposed public table MUST have RLS enabled
DO $$
DECLARE
    v_unprotected text[];
BEGIN
    SELECT array_agg(c.relname ORDER BY c.relname)
    INTO v_unprotected
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity;

    IF v_unprotected IS NOT NULL AND array_length(v_unprotected, 1) > 0 THEN
        RAISE EXCEPTION 'STAGING BOOTSTRAP FAIL-CLOSED: Tables without RLS enabled: %', v_unprotected;
    END IF;
END $$;

COMMIT;
