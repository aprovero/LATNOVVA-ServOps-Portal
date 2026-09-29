-- ============================================================================
-- PASS 12I-A: Server-Authoritative Canary Routing RPC
-- Target Project: dvkkxwtqonjgrvloisid (LATNOVVA ServiceTool)
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_attendance_write_mode()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_personnel_id TEXT;
    v_is_canary BOOLEAN := FALSE;
    v_global_stage2 BOOLEAN := FALSE;
    v_normalized_enabled BOOLEAN := FALSE;
BEGIN
    -- Derive authoritative personnel ID for current authenticated user
    v_personnel_id := public.get_authoritative_personnel_id();

    IF v_personnel_id IS NOT NULL THEN
        -- Check if current personnel is in canary allowlist
        SELECT EXISTS (
            SELECT 1 FROM public.mx_normalized_punch_canary
            WHERE personnel_id = v_personnel_id
        ) INTO v_is_canary;
    END IF;

    v_normalized_enabled := v_is_canary;

    RETURN jsonb_build_object(
        'normalized_attendance_enabled', v_normalized_enabled,
        'personnel_id', v_personnel_id,
        'mode', CASE WHEN v_is_canary THEN 'CANARY' ELSE 'LEGACY' END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_attendance_write_mode() TO authenticated, anon, public;

COMMIT;
