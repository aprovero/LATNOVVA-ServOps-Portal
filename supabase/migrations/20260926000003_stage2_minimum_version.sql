-- ============================================================================
-- PASS 12A: MINIMUM CLIENT VERSION 5.0.0 ENFORCEMENT & MANDATORY PASSWORD ROTATION
-- ============================================================================

-- 1. Schema Extensions for public.platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS minimum_client_version text DEFAULT '5.0.0',
  ADD COLUMN IF NOT EXISTS minimum_client_version_effective_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS minimum_client_version_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS required_password_policy_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS password_rotation_effective_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_rotation_enabled boolean DEFAULT false;

-- Seed default global settings row if missing or update defaults
INSERT INTO public.platform_settings (
    id, "shiftLengthThreshold", "enableShiftNotifications", "enableAutoClockOut", "autoClockOutThreshold", "geofenceRadius",
    minimum_client_version, minimum_client_version_effective_at, minimum_client_version_enabled,
    required_password_policy_version, password_rotation_effective_at, password_rotation_enabled
)
VALUES ('global', 8, true, true, 14, 250, '5.0.0', NULL, false, 1, NULL, false)
ON CONFLICT (id) DO UPDATE SET
    minimum_client_version = COALESCE(public.platform_settings.minimum_client_version, '5.0.0'),
    required_password_policy_version = COALESCE(public.platform_settings.required_password_policy_version, 1);

-- 2. Schema Extensions for public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_policy_version integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_service_account boolean DEFAULT false;

-- 3. Helper Function: public.semver_compare
CREATE OR REPLACE FUNCTION public.semver_compare(v1 text, v2 text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    p1 int[];
    p2 int[];
    clean_v1 text;
    clean_v2 text;
BEGIN
    IF v1 IS NULL OR v2 IS NULL THEN RETURN NULL; END IF;
    clean_v1 := regexp_replace(v1, '^v', '');
    clean_v2 := regexp_replace(v2, '^v', '');
    IF NOT (clean_v1 ~ '^[0-9]+(\.[0-9]+)*' AND clean_v2 ~ '^[0-9]+(\.[0-9]+)*') THEN RETURN NULL; END IF;
    p1 := STRING_TO_ARRAY(REGEXP_REPLACE(clean_v1, '[^0-9.].*', ''), '.')::int[];
    p2 := STRING_TO_ARRAY(REGEXP_REPLACE(clean_v2, '[^0-9.].*', ''), '.')::int[];
    WHILE ARRAY_LENGTH(p1, 1) < 3 LOOP p1 := ARRAY_APPEND(p1, 0); END LOOP;
    WHILE ARRAY_LENGTH(p2, 1) < 3 LOOP p2 := ARRAY_APPEND(p2, 0); END LOOP;
    IF p1[1] > p2[1] THEN RETURN 1; ELSIF p1[1] < p2[1] THEN RETURN -1;
    ELSIF p1[2] > p2[2] THEN RETURN 1; ELSIF p1[2] < p2[2] THEN RETURN -1;
    ELSIF p1[3] > p2[3] THEN RETURN 1; ELSIF p1[3] < p2[3] THEN RETURN -1;
    ELSE RETURN 0; END IF;
END;
$$;

-- 4. Pre-Auth Bootstrap RPC: public.get_client_bootstrap_config()
CREATE OR REPLACE FUNCTION public.get_client_bootstrap_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT minimum_client_version, minimum_client_version_effective_at, minimum_client_version_enabled,
           required_password_policy_version, password_rotation_effective_at, password_rotation_enabled
    INTO v_rec
    FROM public.platform_settings WHERE id = 'global';

    RETURN jsonb_build_object(
        'minimum_client_version', COALESCE(v_rec.minimum_client_version, '5.0.0'),
        'minimum_client_version_effective_at', v_rec.minimum_client_version_effective_at,
        'minimum_client_version_enabled', COALESCE(v_rec.minimum_client_version_enabled, false),
        'required_password_policy_version', COALESCE(v_rec.required_password_policy_version, 1),
        'password_rotation_effective_at', v_rec.password_rotation_effective_at,
        'password_rotation_enabled', COALESCE(v_rec.password_rotation_enabled, false)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_bootstrap_config() TO anon, authenticated, public;
