-- ============================================================================
-- STAGING-ONLY BOOTSTRAP LAYER 1: Core Application Base Schema (PASS 15J-P3)
-- Target: LATNOVVA-V6-STAGING (pxgvqszeqvoldhiozvko) OR fresh local disposable DB
-- NEVER run against production (dvkkxwtqonjgrvloisid).
-- Credential-free, zero production data, fail-closed RLS enabled from creation.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. profiles (linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY,
    email text,
    name text,
    role text NOT NULL DEFAULT 'Tech',
    client_id uuid,
    subsidiary text NOT NULL DEFAULT 'MX',
    password_policy_version integer NOT NULL DEFAULT 1,
    is_service_account boolean NOT NULL DEFAULT false,
    last_app_version text,
    last_active_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. clients
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    logo text,
    contact_email text,
    contact_phone text,
    address text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. projects (production-parity: assigned_personnel text[], site_lead_ids uuid[])
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    subsidiary text NOT NULL DEFAULT 'MX',
    assigned_personnel text[] NOT NULL DEFAULT ARRAY[]::text[],
    site_lead_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
    location text,
    status text NOT NULL DEFAULT 'Active',
    progress numeric NOT NULL DEFAULT 0,
    scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
    prevailing_wage boolean NOT NULL DEFAULT false,
    start_date text,
    end_date text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. mx_personnel (production-parity: id text, client_id text, all 31 columns from V6-PEND-014)
CREATE TABLE IF NOT EXISTS public.mx_personnel (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text,
    app_role text NOT NULL DEFAULT 'Tech',
    client_id text,
    status text DEFAULT 'Active',
    subsidiary text NOT NULL DEFAULT 'MX',
    position text,
    employee_number text,
    phone text,
    phone_number text,
    image text,
    "faceDescriptor" jsonb,
    regular_rate numeric DEFAULT 0,
    overtime_rate numeric DEFAULT 0,
    rainy_day_rate numeric DEFAULT 0,
    per_diem numeric DEFAULT 0,
    prevailing_wage numeric DEFAULT 0,
    bench_exempt boolean DEFAULT false,
    dbo text,
    meal_allowance numeric DEFAULT 0,
    gas_allowance numeric DEFAULT 0,
    truck_allowance numeric DEFAULT 0,
    lead_pay numeric DEFAULT 0,
    certifications jsonb DEFAULT '[]'::jsonb,
    supervisor_id text,
    manager_id text,
    emergency_contact_name text,
    emergency_contact_phone text,
    subsidiary_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Legacy / auxiliary application tables (fail-closed RLS)
CREATE TABLE IF NOT EXISTS public.mx_timesheets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id text,
    project_id uuid,
    date date,
    time_in text,
    time_out text,
    hours numeric DEFAULT 0,
    type text,
    classification text,
    notes text,
    status text,
    approved_by text,
    gps_verified boolean DEFAULT false,
    source text,
    manual_reason text,
    corrected_by text,
    corrected_at timestamptz,
    correction_reason text,
    lunch_start text,
    lunch_end text,
    punches jsonb DEFAULT '[]'::jsonb,
    signature text,
    subsidiary text DEFAULT 'MX',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mx_work_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id text,
    schedule jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.mx_attendance_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id text,
    date date,
    start_date date,
    end_date date,
    override_type text,
    notes text
);

CREATE TABLE IF NOT EXISTS public.scope_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.sub_report_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.personnel (
    id text PRIMARY KEY,
    name text,
    email text,
    app_role text,
    status text,
    subsidiary text,
    position text,
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid,
    project_id uuid,
    created_by uuid,
    state text,
    title text,
    date date,
    comments jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.tools (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    model text,
    serial_number text,
    assigned_project_id uuid,
    status text
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id text PRIMARY KEY,
    minimum_client_version text NOT NULL DEFAULT '6.0.0',
    required_client_release integer NOT NULL DEFAULT 60,
    minimum_client_version_enabled boolean NOT NULL DEFAULT true,
    required_password_policy_version integer NOT NULL DEFAULT 1,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_version_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text,
    app_version text,
    email text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    rating integer,
    comments text,
    app_version text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Secondary physical locations for multi-site geofencing
CREATE TABLE IF NOT EXISTS public.attendance_locations (
    location_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    radius_meters numeric NOT NULL DEFAULT 150,
    accuracy_threshold_meters numeric NOT NULL DEFAULT 50,
    is_active boolean NOT NULL DEFAULT true,
    valid_from timestamptz NOT NULL DEFAULT now() - interval '1 day',
    valid_until timestamptz
);

CREATE TABLE IF NOT EXISTS public.attendance_project_locations (
    project_location_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES public.attendance_locations(location_id) ON DELETE CASCADE,
    is_active boolean NOT NULL DEFAULT true,
    valid_from timestamptz NOT NULL DEFAULT now() - interval '1 day',
    valid_until timestamptz
);

-- 7. Immediately enable RLS on ALL exposed tables (zero insecure intermediate window)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mx_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mx_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mx_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mx_attendance_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_version_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_project_locations ENABLE ROW LEVEL SECURITY;

-- 8. Explicit minimum table privileges (for Supabase projects with Automatic API Grants disabled)
--    Strictly NO TRUNCATE, REFERENCES, TRIGGER grants; NO anon write grants.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mx_personnel TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mx_timesheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mx_work_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mx_attendance_overrides TO authenticated;
GRANT SELECT ON public.scope_templates TO authenticated;
GRANT SELECT, INSERT ON public.app_version_logs TO authenticated;
GRANT SELECT, INSERT ON public.user_feedback TO authenticated;
GRANT SELECT ON public.attendance_locations TO authenticated;
GRANT SELECT ON public.attendance_project_locations TO authenticated;

-- 9. Minimal policies for non-Migration-01 auxiliary tables
DROP POLICY IF EXISTS "stg_platform_settings_read" ON public.platform_settings;
CREATE POLICY "stg_platform_settings_read" ON public.platform_settings
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "stg_app_version_logs_insert" ON public.app_version_logs;
CREATE POLICY "stg_app_version_logs_insert" ON public.app_version_logs
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "stg_user_feedback_self" ON public.user_feedback;
CREATE POLICY "stg_user_feedback_self" ON public.user_feedback
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "stg_attendance_locations_read" ON public.attendance_locations;
CREATE POLICY "stg_attendance_locations_read" ON public.attendance_locations
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "stg_attendance_project_locations_read" ON public.attendance_project_locations;
CREATE POLICY "stg_attendance_project_locations_read" ON public.attendance_project_locations
    FOR SELECT TO authenticated USING (true);

-- 10. Authoritative personnel identity resolver (production parity V6-PEND-014)
CREATE OR REPLACE FUNCTION public.get_authoritative_personnel_id()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_user_email TEXT;
    v_personnel_ids TEXT[];
BEGIN
    IF v_uid IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT ARRAY_AGG(id) INTO v_personnel_ids
    FROM public.mx_personnel
    WHERE id = v_uid::TEXT;

    IF array_length(v_personnel_ids, 1) = 1 THEN
        RETURN v_personnel_ids[1];
    END IF;

    SELECT lower(trim(email)) INTO v_user_email FROM auth.users WHERE id = v_uid;
    IF v_user_email IS NULL THEN
        SELECT lower(trim(email)) INTO v_user_email FROM public.profiles WHERE id = v_uid;
    END IF;
    IF v_user_email IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT ARRAY_AGG(id) INTO v_personnel_ids
    FROM public.mx_personnel
    WHERE lower(trim(email)) = v_user_email;

    IF array_length(v_personnel_ids, 1) = 1 THEN
        RETURN v_personnel_ids[1];
    END IF;

    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_authoritative_personnel_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_authoritative_personnel_id() TO authenticated, service_role;

-- 11. Client bootstrap config RPC
CREATE OR REPLACE FUNCTION public.get_client_bootstrap_config()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    SELECT jsonb_build_object(
        'minimum_client_version', ps.minimum_client_version,
        'required_client_release', ps.required_client_release,
        'minimum_client_version_enabled', ps.minimum_client_version_enabled,
        'required_password_policy_version', ps.required_password_policy_version
    )
    FROM public.platform_settings ps
    WHERE ps.id = 'global'
    LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_client_bootstrap_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_bootstrap_config() TO anon, authenticated, service_role;

COMMIT;
