-- ============================================================================
-- STAGING-ONLY SECURITY OVERLAY: HF-02 Authorization Parity (PASS 15J-P3)
-- Target: LATNOVVA-V6-STAGING (pxgvqszeqvoldhiozvko) OR fresh local disposable DB
-- Preserves authoritative R60 Migration 01 unmodified while closing HF-02
-- regressions discovered during PASS 15J-P3 Section 4 parity verification.
-- NEVER run against production (dvkkxwtqonjgrvloisid).
-- ============================================================================

BEGIN;

-- 1. Hardened get_authoritative_personnel_id() — strictly auth.users.email ONLY
--    (never mutable public.profiles.email or JWT email); fails closed on ambiguity.
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

    -- Branch 1: Direct UUID-string primary key match
    SELECT ARRAY_AGG(id) INTO v_personnel_ids
    FROM public.mx_personnel
    WHERE id = v_uid::TEXT;

    IF array_length(v_personnel_ids, 1) = 1 THEN
        RETURN v_personnel_ids[1];
    END IF;

    -- Branch 2: Authoritative auth.users.email ONLY (never mutable profiles.email or JWT email)
    SELECT lower(trim(email)) INTO v_user_email
    FROM auth.users
    WHERE id = v_uid;

    IF v_user_email IS NULL OR v_user_email = '' THEN
        RETURN NULL;
    END IF;

    SELECT ARRAY_AGG(id) INTO v_personnel_ids
    FROM public.mx_personnel
    WHERE lower(trim(email)) = v_user_email;

    -- Fail closed if 0 or >1 (ambiguous) matches
    IF array_length(v_personnel_ids, 1) = 1 THEN
        RETURN v_personnel_ids[1];
    END IF;

    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_authoritative_personnel_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_authoritative_personnel_id() TO authenticated, service_role;

-- 2. Prevent HR hard-delete on public.mx_personnel (replace FOR ALL with INSERT + UPDATE only)
DROP POLICY IF EXISTS v6_mx_personnel_hr_manage_non_manager ON public.mx_personnel;
DROP POLICY IF EXISTS stg_hf02_mx_personnel_hr_insert_non_manager ON public.mx_personnel;
DROP POLICY IF EXISTS stg_hf02_mx_personnel_hr_update_non_manager ON public.mx_personnel;

CREATE POLICY stg_hf02_mx_personnel_hr_insert_non_manager
    ON public.mx_personnel FOR INSERT TO authenticated
    WITH CHECK (
        public.get_caller_role() = 'HR'
        AND app_role IN ('HR', 'Supervisor', 'Office', 'Tech', 'Customer')
    );

CREATE POLICY stg_hf02_mx_personnel_hr_update_non_manager
    ON public.mx_personnel FOR UPDATE TO authenticated
    USING (
        public.get_caller_role() = 'HR'
        AND trim(COALESCE(app_role, '')) <> 'Manager'
    )
    WITH CHECK (
        public.get_caller_role() = 'HR'
        AND app_role IN ('HR', 'Supervisor', 'Office', 'Tech', 'Customer')
    );

-- 3. Upgrade guard_profiles_sensitive_fields() to full HF-02 parity (INSERT + UPDATE)
CREATE OR REPLACE FUNCTION public.guard_profiles_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    caller_role text;
    is_privileged_backend boolean;
BEGIN
    is_privileged_backend :=
        current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin')
        OR (
            session_user IN ('postgres', 'supabase_admin')
            AND COALESCE(current_setting('role', true), 'none') IN ('', 'none')
            AND auth.uid() IS NULL
        );

    IF is_privileged_backend THEN
        RETURN NEW;
    END IF;

    -- Canonical 6-role allowlist enforced for all direct writes
    IF NEW.role IS NULL OR NEW.role NOT IN ('Manager', 'HR', 'Supervisor', 'Office', 'Tech', 'Customer') THEN
        RAISE EXCEPTION 'Forbidden: non-canonical role value "%"', COALESCE(NEW.role, 'NULL');
    END IF;

    -- Internal staff cannot acquire customer tenant association
    IF NEW.role <> 'Customer' AND NEW.client_id IS NOT NULL THEN
        RAISE EXCEPTION 'Forbidden: internal staff cannot have a non-null client_id';
    END IF;

    caller_role := public.get_caller_role();

    IF caller_role = 'Manager' THEN
        RETURN NEW;
    END IF;

    IF caller_role = 'HR' THEN
        IF NEW.role = 'Manager' OR (TG_OP = 'UPDATE' AND OLD.role = 'Manager') THEN
            RAISE EXCEPTION 'Forbidden: HR cannot modify Manager profiles or promote to Manager';
        END IF;
        IF TG_OP = 'UPDATE' AND OLD.id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Forbidden: HR cannot modify own role directly';
        END IF;
        IF TG_OP = 'UPDATE' AND (
            NEW.id IS DISTINCT FROM OLD.id
            OR NEW.email IS DISTINCT FROM OLD.email
            OR NEW.password_policy_version IS DISTINCT FROM OLD.password_policy_version
            OR NEW.is_service_account IS DISTINCT FROM OLD.is_service_account
        ) THEN
            RAISE EXCEPTION 'Forbidden: identity-bearing profile fields must be updated via admin_update_user or Manager';
        END IF;
        RETURN NEW;
    END IF;

    -- Ordinary self-update (non-Manager, non-HR)
    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Forbidden: direct profile creation requires Manager role';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.subsidiary IS DISTINCT FROM OLD.subsidiary
       OR NEW.password_policy_version IS DISTINCT FROM OLD.password_policy_version
       OR NEW.is_service_account IS DISTINCT FROM OLD.is_service_account THEN
        RAISE EXCEPTION 'Forbidden: restricted profile fields cannot be modified directly';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profiles_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_guard_profiles_sensitive_fields
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_sensitive_fields();

-- 4. Upgrade guard_mx_personnel_self_update() to full HF-02 parity (INSERT + UPDATE)
CREATE OR REPLACE FUNCTION public.guard_mx_personnel_self_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    caller_role text;
    is_privileged_backend boolean;
    v_manager_collision boolean;
BEGIN
    is_privileged_backend :=
        current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin')
        OR (
            session_user IN ('postgres', 'supabase_admin')
            AND COALESCE(current_setting('role', true), 'none') IN ('', 'none')
            AND auth.uid() IS NULL
        );

    IF is_privileged_backend THEN
        RETURN NEW;
    END IF;

    -- Canonical 6-role allowlist
    IF NEW.app_role IS NOT NULL AND NEW.app_role NOT IN ('Manager', 'HR', 'Supervisor', 'Office', 'Tech', 'Customer') THEN
        RAISE EXCEPTION 'Forbidden: non-canonical app_role value "%"', NEW.app_role;
    END IF;

    -- Internal staff cannot acquire customer tenant association
    IF COALESCE(NEW.app_role, 'Tech') <> 'Customer' AND NEW.client_id IS NOT NULL AND trim(NEW.client_id) <> '' THEN
        RAISE EXCEPTION 'Forbidden: internal staff cannot have a non-null client_id';
    END IF;

    caller_role := public.get_caller_role();

    IF caller_role = 'Manager' THEN
        RETURN NEW;
    END IF;

    IF caller_role = 'HR' THEN
        IF NEW.app_role = 'Manager' THEN
            RAISE EXCEPTION 'Forbidden: HR cannot create or promote Manager personnel records';
        END IF;
        IF TG_OP = 'UPDATE' THEN
            IF OLD.app_role = 'Manager' THEN
                RAISE EXCEPTION 'Forbidden: HR cannot modify Manager personnel records';
            END IF;
            IF NEW.id IS DISTINCT FROM OLD.id THEN
                RAISE EXCEPTION 'Forbidden: HR cannot reassign personnel id directly';
            END IF;
            IF NEW.email IS DISTINCT FROM OLD.email THEN
                RAISE EXCEPTION 'Forbidden: HR must update personnel email via admin_update_user';
            END IF;
        END IF;
        IF TG_OP = 'INSERT' THEN
            SELECT EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.role = 'Manager'
                  AND (p.id::text = NEW.id OR (NEW.email IS NOT NULL AND lower(trim(p.email)) = lower(trim(NEW.email))))
            ) INTO v_manager_collision;
            IF v_manager_collision THEN
                RAISE EXCEPTION 'Forbidden: HR cannot insert personnel colliding with a Manager identity';
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    -- Ordinary self-update
    IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'Forbidden: direct personnel creation requires Manager or HR role';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.app_role IS DISTINCT FROM OLD.app_role
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.subsidiary IS DISTINCT FROM OLD.subsidiary
       OR NEW.regular_rate IS DISTINCT FROM OLD.regular_rate
       OR NEW.overtime_rate IS DISTINCT FROM OLD.overtime_rate
       OR NEW.rainy_day_rate IS DISTINCT FROM OLD.rainy_day_rate
       OR NEW.per_diem IS DISTINCT FROM OLD.per_diem THEN
        RAISE EXCEPTION 'Forbidden: restricted personnel fields require Manager or HR role';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_mx_personnel_self_update ON public.mx_personnel;
CREATE TRIGGER trg_guard_mx_personnel_self_update
    BEFORE INSERT OR UPDATE ON public.mx_personnel
    FOR EACH ROW EXECUTE FUNCTION public.guard_mx_personnel_self_update();

-- 5. Explicitly revoke TRUNCATE, REFERENCES, TRIGGER from PUBLIC, anon, authenticated on ALL public tables
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 6. Ensure fixed search_path on all SECURITY DEFINER functions in public
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND (p.proconfig IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
          ))
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
    END LOOP;
END $$;

COMMIT;
