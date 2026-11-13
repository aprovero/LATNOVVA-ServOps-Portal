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

-- 2. Elevate Platform Minimum Version to Release 51 / v5.1.3
UPDATE public.platform_settings
SET minimum_client_version = '5.1.3',
    minimum_client_version_effective_at = NOW(),
    minimum_client_version_enabled = true,
    updated_at = NOW()
WHERE id = 'global';

COMMIT;
