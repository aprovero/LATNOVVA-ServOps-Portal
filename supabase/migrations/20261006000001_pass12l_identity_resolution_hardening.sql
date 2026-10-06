-- ============================================================================
-- PASS 12L-A: Identity Resolution & Fail-Closed Routing Hardening
-- Target Project: dvkkxwtqonjgrvloisid (LATNOVVA ServiceTool)
-- ============================================================================

BEGIN;

-- 1. Hardened Authoritative Personnel ID Helper
CREATE OR REPLACE FUNCTION public.get_authoritative_personnel_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_user_email TEXT;
    v_personnel_ids TEXT[];
BEGIN
    IF v_uid IS NULL THEN
        RETURN NULL;
    END IF;

    -- Branch 1: Direct auth.uid() match against mx_personnel.id
    SELECT ARRAY_AGG(id) INTO v_personnel_ids
    FROM public.mx_personnel WHERE id = (v_uid)::text;

    IF ARRAY_LENGTH(v_personnel_ids, 1) = 1 THEN
        RETURN v_personnel_ids[1];
    END IF;

    -- Branch 2: Profile lookup via auth.uid() to find user email
    SELECT LOWER(TRIM(email)) INTO v_user_email
    FROM public.profiles WHERE id = v_uid;

    -- Branch 2b: Fallback to JWT email claim if profile email missing
    IF v_user_email IS NULL OR v_user_email = '' THEN
        v_user_email := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
    END IF;

    IF v_user_email IS NULL OR v_user_email = '' THEN
        RETURN NULL;
    END IF;

    -- Branch 3: Case-insensitive and trimmed email lookup against mx_personnel
    SELECT ARRAY_AGG(id) INTO v_personnel_ids
    FROM public.mx_personnel WHERE LOWER(TRIM(email)) = v_user_email;

    IF ARRAY_LENGTH(v_personnel_ids, 1) = 1 THEN
        RETURN v_personnel_ids[1];
    ELSE
        -- 0 matches or ambiguous duplicate (>1) -> FAIL CLOSED (NULL)
        RETURN NULL;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_authoritative_personnel_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_authoritative_personnel_id() FROM PUBLIC, anon;

-- 2. Hardened Server-Authoritative Routing RPC with Fail-Closed NULL Semantics
CREATE OR REPLACE FUNCTION public.get_attendance_write_mode()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_personnel_id TEXT;
    v_is_canary BOOLEAN := FALSE;
BEGIN
    -- Derive authoritative personnel ID for current authenticated user
    v_personnel_id := public.get_authoritative_personnel_id();

    -- FAIL CLOSED: If identity cannot be authoritatively resolved, return ERROR, NEVER LEGACY!
    IF v_personnel_id IS NULL THEN
        RETURN jsonb_build_object(
            'mode', 'ERROR',
            'normalized_attendance_enabled', NULL,
            'personnel_id', NULL,
            'reason', 'IDENTITY_UNRESOLVED'
        );
    END IF;

    -- Check if current personnel is in canary allowlist
    SELECT EXISTS (
        SELECT 1 FROM public.mx_normalized_punch_canary
        WHERE personnel_id = v_personnel_id
    ) INTO v_is_canary;

    RETURN jsonb_build_object(
        'mode', CASE WHEN v_is_canary THEN 'CANARY' ELSE 'LEGACY' END,
        'normalized_attendance_enabled', v_is_canary,
        'personnel_id', v_personnel_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_write_mode() TO authenticated, anon, public;

COMMIT;
