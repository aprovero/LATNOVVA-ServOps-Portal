-- ============================================================================
-- LATNOVVA ServiceTool v6.0.0 — Authoritative Security Hardening Migration
-- Production-grounded against V6-PEND-009 live catalog (2026-11-26T04:05:00Z):
--   * 27 live policies across clients, mx_personnel, profiles, projects, reports, tools
--   * 3 live SECURITY DEFINER functions (admin_create_user, admin_update_user, get_user_id_by_email)
--     all previously granting EXECUTE to PUBLIC and anon
--
-- PASS 15F Enhancements:
--   1. Dynamically drops ALL overloads of admin_create_user, admin_update_user,
--      and get_user_id_by_email via pg_proc (eliminates 42P13 & signature drift).
--   2. Recreates authoritative SECURITY DEFINER RPCs with strict Manager/HR checks,
--      HR-cannot-touch-Manager protection, and REVOKE ALL FROM PUBLIC, anon.
--   3. Expands admin_update_user to support new_name & new_subsidiary (eliminates
--      HR direct profiles PATCH split-brain).
--   4. Hardens get_user_id_by_email (Manager/HR only, revokes PUBLIC & anon).
--   5. Dynamically drops ALL existing RLS policies on profiles, projects, clients,
--      tools, reports, and mx_personnel via pg_policies (accounts for all 27 live
--      policies + any pre-Saturday drift) and installs the clean v6 policy model.
--   6. Adds transactional postcondition assertions that abort (RAISE EXCEPTION)
--      if any legacy/unrestricted policy, extra overload, or PUBLIC/anon grant survives.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Dynamically drop ALL existing overloads of privileged/identity RPCs ──
DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('admin_create_user', 'admin_update_user', 'get_user_id_by_email')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', fn.proname, fn.args);
    END LOOP;
END $$;

-- ── 2. Authoritative 6-arg public.admin_create_user ─────────────────────────
CREATE FUNCTION public.admin_create_user(
    user_email text,
    user_password text,
    user_role text,
    user_name text,
    user_client_id uuid DEFAULT NULL,
    user_subsidiary text DEFAULT 'MX'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    caller_uid uuid;
    raw_caller_role text;
    clean_caller_role text;
    clean_requested_role text;
    clean_email text;
    clean_name text;
    clean_subsidiary text;
    effective_password text;
    new_uid uuid;
    encrypted_pw text;
    existing_uid uuid;
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT role INTO raw_caller_role
    FROM public.profiles
    WHERE id = caller_uid;

    clean_caller_role := trim(COALESCE(raw_caller_role, ''));
    IF clean_caller_role NOT IN ('Manager', 'HR') THEN
        RAISE EXCEPTION 'Forbidden: Manager or HR role required to create users';
    END IF;

    clean_requested_role := trim(COALESCE(user_role, ''));
    IF clean_requested_role NOT IN ('Manager', 'HR', 'Supervisor', 'Office', 'Tech', 'Customer') THEN
        RAISE EXCEPTION 'Invalid role: %', clean_requested_role;
    END IF;

    -- HR cannot create Manager accounts
    IF clean_caller_role = 'HR' AND clean_requested_role = 'Manager' THEN
        RAISE EXCEPTION 'Forbidden: HR cannot create Manager accounts';
    END IF;

    clean_email := lower(trim(COALESCE(user_email, '')));
    IF clean_email = '' OR position('@' in clean_email) = 0 THEN
        RAISE EXCEPTION 'Invalid email address';
    END IF;

    clean_name := COALESCE(NULLIF(trim(user_name), ''), split_part(clean_email, '@', 1));
    clean_subsidiary := CASE WHEN upper(trim(COALESCE(user_subsidiary, 'MX'))) = 'US' THEN 'US' ELSE 'MX' END;

    -- Mark transaction as trusted for profile guard trigger
    PERFORM set_config('app.trusted_admin_rpc', 'true', true);

    -- Idempotent reconciliation if auth.users row already exists
    SELECT id INTO existing_uid
    FROM auth.users
    WHERE lower(email) = clean_email
    LIMIT 1;

    IF existing_uid IS NOT NULL THEN
        -- HR cannot reconcile/touch an existing Manager account
        IF clean_caller_role = 'HR' THEN
            IF EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = existing_uid AND trim(COALESCE(role, '')) = 'Manager'
            ) THEN
                RAISE EXCEPTION 'Forbidden: HR cannot modify an existing Manager account';
            END IF;
        END IF;

        INSERT INTO public.profiles (id, email, name, role, client_id, subsidiary)
        VALUES (existing_uid, clean_email, clean_name, clean_requested_role, user_client_id, clean_subsidiary)
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            client_id = COALESCE(EXCLUDED.client_id, public.profiles.client_id),
            subsidiary = EXCLUDED.subsidiary;

        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
              || jsonb_build_object('role', clean_requested_role, 'subsidiary', clean_subsidiary),
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
              || jsonb_build_object('full_name', clean_name, 'name', clean_name, 'role', clean_requested_role),
            updated_at = now()
        WHERE id = existing_uid;

        RETURN existing_uid;
    END IF;

    -- Generate cryptographically random server-side password when blank
    IF NULLIF(trim(COALESCE(user_password, '')), '') IS NULL THEN
        effective_password := encode(extensions.gen_random_bytes(24), 'base64');
    ELSE
        effective_password := trim(user_password);
    END IF;

    encrypted_pw := extensions.crypt(effective_password, extensions.gen_salt('bf'));
    new_uid := gen_random_uuid();

    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_uid,
        'authenticated',
        'authenticated',
        clean_email,
        encrypted_pw,
        now(),
        jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'role', clean_requested_role,
            'subsidiary', clean_subsidiary,
            'password_policy_version', 0
        ),
        jsonb_build_object(
            'full_name', clean_name,
            'name', clean_name,
            'role', clean_requested_role
        ),
        now(),
        now(),
        '',
        '',
        '',
        ''
    );

    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        new_uid,
        new_uid::text,
        jsonb_build_object('sub', new_uid::text, 'email', clean_email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO public.profiles (id, email, name, role, client_id, subsidiary, password_policy_version)
    VALUES (new_uid, clean_email, clean_name, clean_requested_role, user_client_id, clean_subsidiary, 0)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        client_id = EXCLUDED.client_id,
        subsidiary = EXCLUDED.subsidiary;

    RETURN new_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, uuid, text) TO service_role;

-- ── 3. Authoritative 7-arg public.admin_update_user ─────────────────────────
--    Supports email, password, role, client_id, name, and subsidiary atomically
--    across auth.users, auth.identities, public.profiles, and public.mx_personnel.
CREATE FUNCTION public.admin_update_user(
    target_user_id uuid,
    new_email text DEFAULT NULL,
    new_password text DEFAULT NULL,
    new_role text DEFAULT NULL,
    new_client_id uuid DEFAULT NULL,
    new_name text DEFAULT NULL,
    new_subsidiary text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    caller_uid uuid;
    raw_caller_role text;
    clean_caller_role text;
    raw_target_role text;
    clean_target_role text;
    target_old_email text;
    resolved_personnel_id text;
    matched_personnel_ids text[];
    clean_new_role text;
    clean_email text;
    clean_name text;
    clean_subsidiary text;
    encrypted_pw text;
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT role INTO raw_caller_role
    FROM public.profiles
    WHERE id = caller_uid;

    clean_caller_role := trim(COALESCE(raw_caller_role, ''));
    IF clean_caller_role NOT IN ('Manager', 'HR') THEN
        RAISE EXCEPTION 'Forbidden: Manager or HR role required to update users';
    END IF;

    SELECT role, NULLIF(lower(trim(COALESCE(email, ''))), '')
      INTO raw_target_role, target_old_email
    FROM public.profiles
    WHERE id = target_user_id;

    IF target_old_email IS NULL THEN
        SELECT NULLIF(lower(trim(COALESCE(email, ''))), '')
          INTO target_old_email
        FROM auth.users
        WHERE id = target_user_id;
    END IF;

    clean_target_role := trim(COALESCE(raw_target_role, ''));

    -- Resolve target mx_personnel row BEFORE any email mutation (PASS 15I Section 5):
    -- 1. Direct UUID-text match on mx_personnel.id
    SELECT id INTO resolved_personnel_id
    FROM public.mx_personnel
    WHERE id = target_user_id::text;

    -- 2. Unique normalized email fallback for legacy/non-UUID personnel IDs
    IF resolved_personnel_id IS NULL AND target_old_email IS NOT NULL THEN
        SELECT array_agg(id) INTO matched_personnel_ids
        FROM public.mx_personnel
        WHERE lower(trim(COALESCE(email, ''))) = target_old_email;

        IF COALESCE(array_length(matched_personnel_ids, 1), 0) = 1 THEN
            resolved_personnel_id := matched_personnel_ids[1];
        ELSIF COALESCE(array_length(matched_personnel_ids, 1), 0) > 1 THEN
            RAISE EXCEPTION 'Ambiguous personnel linkage: multiple mx_personnel rows share email %', target_old_email;
        END IF;
        -- 0 matches = intentional profile-only account (e.g. Customer); do not insert duplicate personnel row
    END IF;

    -- HR cannot mutate ANY field on an existing Manager account
    IF clean_caller_role = 'HR' AND clean_target_role = 'Manager' THEN
        RAISE EXCEPTION 'Forbidden: HR cannot modify existing Manager accounts';
    END IF;

    IF new_role IS NOT NULL AND trim(new_role) <> '' THEN
        clean_new_role := trim(new_role);
        IF clean_new_role NOT IN ('Manager', 'HR', 'Supervisor', 'Office', 'Tech', 'Customer') THEN
            RAISE EXCEPTION 'Invalid role: %', clean_new_role;
        END IF;
        IF clean_caller_role = 'HR' AND clean_new_role = 'Manager' THEN
            RAISE EXCEPTION 'Forbidden: HR cannot promote users to Manager';
        END IF;
    ELSE
        clean_new_role := NULL;
    END IF;

    clean_email := NULLIF(lower(trim(COALESCE(new_email, ''))), '');
    clean_name := NULLIF(trim(COALESCE(new_name, '')), '');
    IF new_subsidiary IS NOT NULL AND trim(new_subsidiary) <> '' THEN
        clean_subsidiary := CASE WHEN upper(trim(new_subsidiary)) = 'US' THEN 'US' ELSE 'MX' END;
    ELSE
        clean_subsidiary := NULL;
    END IF;

    PERFORM set_config('app.trusted_admin_rpc', 'true', true);

    IF clean_email IS NOT NULL THEN
        UPDATE auth.users
        SET email = clean_email,
            updated_at = now()
        WHERE id = target_user_id;

        UPDATE auth.identities
        SET identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', clean_email),
            updated_at = now()
        WHERE user_id = target_user_id
          AND provider = 'email';
    END IF;

    IF new_password IS NOT NULL AND trim(new_password) <> '' THEN
        encrypted_pw := extensions.crypt(trim(new_password), extensions.gen_salt('bf'));
        UPDATE auth.users
        SET encrypted_password = encrypted_pw,
            updated_at = now()
        WHERE id = target_user_id;
    END IF;

    IF clean_new_role IS NOT NULL OR clean_subsidiary IS NOT NULL THEN
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
              || CASE WHEN clean_new_role IS NOT NULL THEN jsonb_build_object('role', clean_new_role) ELSE '{}'::jsonb END
              || CASE WHEN clean_subsidiary IS NOT NULL THEN jsonb_build_object('subsidiary', clean_subsidiary) ELSE '{}'::jsonb END,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
              || CASE WHEN clean_new_role IS NOT NULL THEN jsonb_build_object('role', clean_new_role) ELSE '{}'::jsonb END
              || CASE WHEN clean_name IS NOT NULL THEN jsonb_build_object('full_name', clean_name, 'name', clean_name) ELSE '{}'::jsonb END,
            updated_at = now()
        WHERE id = target_user_id;
    ELSIF clean_name IS NOT NULL THEN
        UPDATE auth.users
        SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
              || jsonb_build_object('full_name', clean_name, 'name', clean_name),
            updated_at = now()
        WHERE id = target_user_id;
    END IF;

    UPDATE public.profiles
    SET email = COALESCE(clean_email, email),
        name = COALESCE(clean_name, name),
        role = COALESCE(clean_new_role, role),
        client_id = CASE
            WHEN clean_new_role IS NOT NULL AND clean_new_role <> 'Customer' THEN NULL
            WHEN new_client_id IS NOT NULL THEN new_client_id
            ELSE client_id
        END,
        subsidiary = COALESCE(clean_subsidiary, subsidiary)
    WHERE id = target_user_id;

    IF resolved_personnel_id IS NOT NULL THEN
        UPDATE public.mx_personnel
        SET email = COALESCE(clean_email, email),
            name = COALESCE(clean_name, name),
            app_role = COALESCE(clean_new_role, app_role),
            client_id = CASE
                WHEN clean_new_role IS NOT NULL AND clean_new_role <> 'Customer' THEN NULL
                WHEN new_client_id IS NOT NULL THEN new_client_id::text
                ELSE client_id
            END,
            subsidiary = COALESCE(clean_subsidiary, subsidiary)
        WHERE id = resolved_personnel_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text, text, text, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text, text, text, uuid, text, text) TO service_role;

-- ── 4. Authoritative hardened public.get_user_id_by_email ───────────────────
--    Confirmed PRESENT in V6-PEND-009 with PUBLIC & anon EXECUTE exposure.
--    Hardened to Manager/HR only; revokes PUBLIC & anon to block email enumeration.
CREATE FUNCTION public.get_user_id_by_email(email_query text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_uid uuid;
    caller_role text;
    clean_email text;
    found_uid uuid;
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT trim(COALESCE(role, '')) INTO caller_role
    FROM public.profiles
    WHERE id = caller_uid;

    IF caller_role NOT IN ('Manager', 'HR') THEN
        RAISE EXCEPTION 'Forbidden: Manager or HR role required';
    END IF;

    clean_email := lower(trim(COALESCE(email_query, '')));
    IF clean_email = '' THEN
        RETURN NULL;
    END IF;

    SELECT id INTO found_uid
    FROM auth.users
    WHERE lower(email) = clean_email
    LIMIT 1;

    RETURN found_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;

-- ── 5. Defensive revoke of any historical ensure_user_auth_provisioned ──────
DO $$
DECLARE
    fn record;
BEGIN
    FOR fn IN
        SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'ensure_user_auth_provisioned'
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.ensure_user_auth_provisioned(%s) FROM PUBLIC', fn.args);
        EXECUTE format('REVOKE ALL ON FUNCTION public.ensure_user_auth_provisioned(%s) FROM anon', fn.args);
        EXECUTE format('REVOKE ALL ON FUNCTION public.ensure_user_auth_provisioned(%s) FROM authenticated', fn.args);
    END LOOP;
END $$;

-- ── 6. SECURITY DEFINER RLS helper functions (avoids infinite recursion) ────
CREATE OR REPLACE FUNCTION public.get_caller_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT trim(COALESCE(role, ''))
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_caller_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_caller_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_caller_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_caller_role() TO service_role;

CREATE OR REPLACE FUNCTION public.get_caller_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT client_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_caller_client_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_caller_client_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_caller_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_caller_client_id() TO service_role;

CREATE OR REPLACE FUNCTION public.get_caller_subsidiary()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NULLIF(trim(COALESCE(subsidiary, '')), '')
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_caller_subsidiary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_caller_subsidiary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_caller_subsidiary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_caller_subsidiary() TO service_role;

CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(public.get_caller_role() IN ('Manager', 'HR', 'Supervisor', 'Office', 'Tech'), false);
$$;

REVOKE ALL ON FUNCTION public.is_internal_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_internal_staff() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_staff() TO service_role;

-- ── 7. BEFORE UPDATE trigger locking sensitive columns on public.profiles ───
CREATE OR REPLACE FUNCTION public.guard_profiles_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role text;
    is_trusted_rpc boolean;
BEGIN
    IF current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin')
       OR (session_user IN ('postgres', 'supabase_admin') AND COALESCE(current_setting('role', true), 'none') IN ('', 'none') AND auth.uid() IS NULL) THEN
        RETURN NEW;
    END IF;

    is_trusted_rpc := COALESCE(current_setting('app.trusted_admin_rpc', true), '') = 'true';
    IF is_trusted_rpc THEN
        RETURN NEW;
    END IF;

    caller_role := public.get_caller_role();

    IF caller_role IS DISTINCT FROM 'Manager' THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.email IS DISTINCT FROM OLD.email
           OR NEW.role IS DISTINCT FROM OLD.role
           OR NEW.client_id IS DISTINCT FROM OLD.client_id
           OR NEW.subsidiary IS DISTINCT FROM OLD.subsidiary
           OR NEW.password_policy_version IS DISTINCT FROM OLD.password_policy_version
           OR NEW.is_service_account IS DISTINCT FROM OLD.is_service_account
        THEN
            RAISE EXCEPTION 'Forbidden: sensitive profile fields cannot be modified directly';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_guard_profiles_sensitive_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_profiles_sensitive_fields();

-- ── 8. BEFORE UPDATE trigger guarding self-updates on public.mx_personnel ───
--    Allows a user to update their own Face ID descriptor / avatar / phone,
--    while preventing non-Manager/HR users from escalating app_role, client_id,
--    status, or compensation rates directly.
CREATE OR REPLACE FUNCTION public.guard_mx_personnel_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role text;
    is_trusted_rpc boolean;
BEGIN
    IF current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin')
       OR (session_user IN ('postgres', 'supabase_admin') AND COALESCE(current_setting('role', true), 'none') IN ('', 'none') AND auth.uid() IS NULL) THEN
        RETURN NEW;
    END IF;

    is_trusted_rpc := COALESCE(current_setting('app.trusted_admin_rpc', true), '') = 'true';
    IF is_trusted_rpc THEN
        RETURN NEW;
    END IF;

    caller_role := public.get_caller_role();

    -- HR cannot mutate Manager rows directly in mx_personnel
    IF caller_role = 'HR' AND (trim(COALESCE(OLD.app_role, '')) = 'Manager' OR trim(COALESCE(NEW.app_role, '')) = 'Manager') THEN
        RAISE EXCEPTION 'Forbidden: HR cannot modify Manager personnel records';
    END IF;

    IF caller_role NOT IN ('Manager', 'HR') THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.email IS DISTINCT FROM OLD.email
           OR NEW.app_role IS DISTINCT FROM OLD.app_role
           OR NEW.client_id IS DISTINCT FROM OLD.client_id
           OR NEW.status IS DISTINCT FROM OLD.status
           OR NEW.subsidiary IS DISTINCT FROM OLD.subsidiary
           OR NEW.regular_rate IS DISTINCT FROM OLD.regular_rate
           OR NEW.overtime_rate IS DISTINCT FROM OLD.overtime_rate
           OR NEW.rainy_day_rate IS DISTINCT FROM OLD.rainy_day_rate
           OR NEW.per_diem IS DISTINCT FROM OLD.per_diem
        THEN
            RAISE EXCEPTION 'Forbidden: restricted personnel fields require Manager or HR role';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_mx_personnel_self_update ON public.mx_personnel;
CREATE TRIGGER trg_guard_mx_personnel_self_update
    BEFORE UPDATE ON public.mx_personnel
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_mx_personnel_self_update();

-- ── 8B. BEFORE UPDATE trigger locking authorization-bearing columns on public.projects (PASS 15I Section 8) ──
CREATE OR REPLACE FUNCTION public.guard_projects_supervisor_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role text;
    is_trusted_rpc boolean;
BEGIN
    IF current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin')
       OR (session_user IN ('postgres', 'supabase_admin') AND COALESCE(current_setting('role', true), 'none') IN ('', 'none') AND auth.uid() IS NULL) THEN
        RETURN NEW;
    END IF;

    is_trusted_rpc := COALESCE(current_setting('app.trusted_admin_rpc', true), '') = 'true';
    IF is_trusted_rpc THEN
        RETURN NEW;
    END IF;

    caller_role := public.get_caller_role();

    IF caller_role NOT IN ('Manager', 'HR') THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.client_id IS DISTINCT FROM OLD.client_id
           OR NEW.subsidiary IS DISTINCT FROM OLD.subsidiary
           OR NEW.assigned_personnel IS DISTINCT FROM OLD.assigned_personnel
           OR NEW.site_lead_ids IS DISTINCT FROM OLD.site_lead_ids
        THEN
            RAISE EXCEPTION 'Forbidden: restricted project authorization fields require Manager or HR role';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_projects_supervisor_update ON public.projects;
CREATE TRIGGER trg_guard_projects_supervisor_update
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_projects_supervisor_update();

-- ── 9. Authoritative RLS replacement on ALL 6 target tables ─────────────────
--    Dynamically drops ALL existing policies (accounts for all 27 live policies
--    from V6-PEND-009 plus any pre-Saturday drift) before creating v6 policies.
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('profiles', 'projects', 'clients', 'tools', 'reports', 'mx_personnel')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 9A. public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY v6_profiles_select_own_or_admin
    ON public.profiles FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR public.get_caller_role() IN ('Manager', 'HR')
    );

CREATE POLICY v6_profiles_update_own
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY v6_profiles_manager_all
    ON public.profiles FOR ALL TO authenticated
    USING (public.get_caller_role() = 'Manager')
    WITH CHECK (public.get_caller_role() = 'Manager');

-- 9B. public.clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY v6_clients_staff_or_own_customer_select
    ON public.clients FOR SELECT TO authenticated
    USING (
        public.is_internal_staff()
        OR (
            public.get_caller_role() = 'Customer'
            AND public.get_caller_client_id() IS NOT NULL
            AND id = public.get_caller_client_id()
        )
    );

CREATE POLICY v6_clients_admin_write
    ON public.clients FOR ALL TO authenticated
    USING (public.get_caller_role() IN ('Manager', 'HR'))
    WITH CHECK (public.get_caller_role() IN ('Manager', 'HR'));

-- 9C. public.projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY v6_projects_staff_or_own_customer_select
    ON public.projects FOR SELECT TO authenticated
    USING (
        public.is_internal_staff()
        OR (
            public.get_caller_role() = 'Customer'
            AND public.get_caller_client_id() IS NOT NULL
            AND client_id = public.get_caller_client_id()
        )
    );

CREATE POLICY v6_projects_admin_write
    ON public.projects FOR ALL TO authenticated
    USING (public.get_caller_role() IN ('Manager', 'HR'))
    WITH CHECK (public.get_caller_role() IN ('Manager', 'HR'));

CREATE POLICY v6_projects_supervisor_update_assigned
    ON public.projects FOR UPDATE TO authenticated
    USING (
        public.get_caller_role() = 'Supervisor'
        AND public.get_caller_subsidiary() IS NOT NULL
        AND COALESCE(subsidiary, 'MX') = public.get_caller_subsidiary()
        AND (
            assigned_personnel @> ARRAY[auth.uid()::text]
            OR (
                public.get_authoritative_personnel_id() IS NOT NULL
                AND assigned_personnel @> ARRAY[public.get_authoritative_personnel_id()]
            )
            OR site_lead_ids @> ARRAY[auth.uid()]
        )
    )
    WITH CHECK (
        public.get_caller_role() = 'Supervisor'
        AND public.get_caller_subsidiary() IS NOT NULL
        AND COALESCE(subsidiary, 'MX') = public.get_caller_subsidiary()
        AND (
            assigned_personnel @> ARRAY[auth.uid()::text]
            OR (
                public.get_authoritative_personnel_id() IS NOT NULL
                AND assigned_personnel @> ARRAY[public.get_authoritative_personnel_id()]
            )
            OR site_lead_ids @> ARRAY[auth.uid()]
        )
    );

-- 9D. public.mx_personnel
ALTER TABLE public.mx_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY v6_mx_personnel_staff_select
    ON public.mx_personnel FOR SELECT TO authenticated
    USING (public.is_internal_staff());

CREATE POLICY v6_mx_personnel_self_update
    ON public.mx_personnel FOR UPDATE TO authenticated
    USING (id = public.get_authoritative_personnel_id() AND public.is_internal_staff())
    WITH CHECK (id = public.get_authoritative_personnel_id() AND public.is_internal_staff());

CREATE POLICY v6_mx_personnel_manager_all
    ON public.mx_personnel FOR ALL TO authenticated
    USING (public.get_caller_role() = 'Manager')
    WITH CHECK (public.get_caller_role() = 'Manager');

CREATE POLICY v6_mx_personnel_hr_manage_non_manager
    ON public.mx_personnel FOR ALL TO authenticated
    USING (
        public.get_caller_role() = 'HR'
        AND trim(COALESCE(app_role, '')) <> 'Manager'
    )
    WITH CHECK (
        public.get_caller_role() = 'HR'
        AND trim(COALESCE(app_role, '')) <> 'Manager'
    );

-- 9E. public.reports (DECOMMISSIONED — temporary fail-closed DB defense; drop deferred to V6-PEND-011)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY v6_reports_manager_readonly
    ON public.reports FOR SELECT TO authenticated
    USING (public.get_caller_role() = 'Manager');

-- 9F. public.tools (DECOMMISSIONED — temporary fail-closed DB defense; drop deferred to V6-PEND-011)
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY v6_tools_manager_readonly
    ON public.tools FOR SELECT TO authenticated
    USING (public.get_caller_role() = 'Manager');

-- ── 10. Transactional Postcondition Assertions (Fail-Closed on Drift) ───────
DO $$
DECLARE
    expected_policies text[] := ARRAY[
        'clients:v6_clients_admin_write',
        'clients:v6_clients_staff_or_own_customer_select',
        'mx_personnel:v6_mx_personnel_hr_manage_non_manager',
        'mx_personnel:v6_mx_personnel_manager_all',
        'mx_personnel:v6_mx_personnel_self_update',
        'mx_personnel:v6_mx_personnel_staff_select',
        'profiles:v6_profiles_manager_all',
        'profiles:v6_profiles_select_own_or_admin',
        'profiles:v6_profiles_update_own',
        'projects:v6_projects_admin_write',
        'projects:v6_projects_staff_or_own_customer_select',
        'projects:v6_projects_supervisor_update_assigned',
        'reports:v6_reports_manager_readonly',
        'tools:v6_tools_manager_readonly'
    ];
    actual_policies text[];
    bad_policy_count integer;
    unrestricted_count integer;
    create_user_overloads integer;
    update_user_overloads integer;
    lookup_email_overloads integer;
    public_anon_grants integer;
BEGIN
    -- 10A. Exact expected policy-name set AND exact count (14) on the 6 hardened tables
    SELECT COALESCE(array_agg(tablename || ':' || policyname ORDER BY tablename, policyname), ARRAY[]::text[])
      INTO actual_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'projects', 'clients', 'tools', 'reports', 'mx_personnel');

    IF COALESCE(array_length(actual_policies, 1), 0) <> 14 OR actual_policies IS DISTINCT FROM expected_policies THEN
        RAISE EXCEPTION 'Postcondition failed: policy set mismatch on hardened tables (actual count=%, expected=14, actual=%, expected=%)',
            COALESCE(array_length(actual_policies, 1), 0), actual_policies, expected_policies;
    END IF;

    -- 10A-2. Only intended v6_* policies may exist on the 6 hardened tables
    SELECT COUNT(*) INTO bad_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'projects', 'clients', 'tools', 'reports', 'mx_personnel')
      AND policyname NOT LIKE 'v6\_%' ESCAPE '\';

    IF bad_policy_count > 0 THEN
        RAISE EXCEPTION 'Postcondition failed: % non-v6 policies survived on hardened tables', bad_policy_count;
    END IF;

    -- 10B. Zero USING(true) or auth.role()='authenticated' policies may survive
    SELECT COUNT(*) INTO unrestricted_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'projects', 'clients', 'tools', 'reports', 'mx_personnel')
      AND (
          trim(COALESCE(qual, '')) = 'true'
          OR trim(COALESCE(with_check, '')) = 'true'
          OR COALESCE(qual, '') ILIKE '%auth.role()%authenticated%'
      );

    IF unrestricted_count > 0 THEN
        RAISE EXCEPTION 'Postcondition failed: % unrestricted policies survived on hardened tables', unrestricted_count;
    END IF;

    -- 10C. Exactly ONE overload each for privileged/identity RPCs
    SELECT COUNT(*) INTO create_user_overloads
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_create_user';

    SELECT COUNT(*) INTO update_user_overloads
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_update_user';

    SELECT COUNT(*) INTO lookup_email_overloads
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_id_by_email';

    IF create_user_overloads <> 1 OR update_user_overloads <> 1 OR lookup_email_overloads <> 1 THEN
        RAISE EXCEPTION 'Postcondition failed: unexpected overload counts (create=%, update=%, lookup=%)',
            create_user_overloads, update_user_overloads, lookup_email_overloads;
    END IF;

    -- 10D. Zero PUBLIC or anon EXECUTE privileges on privileged/identity RPCs
    SELECT COUNT(*) INTO public_anon_grants
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name IN ('admin_create_user', 'admin_update_user', 'get_user_id_by_email')
      AND grantee IN ('PUBLIC', 'anon')
      AND privilege_type = 'EXECUTE';

    IF public_anon_grants > 0 THEN
        RAISE EXCEPTION 'Postcondition failed: % PUBLIC/anon EXECUTE grants survived on privileged RPCs', public_anon_grants;
    END IF;
END $$;

COMMIT;
