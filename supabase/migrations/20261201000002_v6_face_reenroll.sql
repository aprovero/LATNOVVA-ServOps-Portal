-- ============================================================================
-- LATNOVVA ServiceTool v6.0.0 — One-Time Safe Face ID v6 Re-Enrollment
-- Staged for Dec 1, 2026 Cutover (run ONLY AFTER r60 enforcement blocks r52!)
--
-- Safety Guarantees (PASS 15D / Items 7–9):
-- 1. Explicit BEGIN / COMMIT transaction.
-- 2. public.v6_migration_sentinels has RLS ENABLED and REVOKE ALL from PUBLIC,
--    anon, and authenticated so ordinary clients cannot read or mutate it.
-- 3. Backs up all v5 descriptors into face_descriptor_v5_backup and proves
--    backup count >= source count BEFORE clearing "faceDescriptor".
-- 4. Records backed_up and cleared counts with zero biometric data in logs.
-- 5. Second execution is a deterministic NO-OP (protects newly enrolled v6).
-- 6. Companion pre-first-enrollment rollback lives outside supabase/migrations/ at:
--    scripts/sql/v6_face_reenroll_pre_boundary_rollback.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.v6_migration_sentinels (
    migration_key text PRIMARY KEY,
    completed_at timestamptz NOT NULL DEFAULT now(),
    backed_up_mx_count integer NOT NULL DEFAULT 0,
    cleared_mx_count integer NOT NULL DEFAULT 0,
    backed_up_personnel_count integer NOT NULL DEFAULT 0,
    cleared_personnel_count integer NOT NULL DEFAULT 0,
    notes text
);

ALTER TABLE public.v6_migration_sentinels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.v6_migration_sentinels FROM PUBLIC;
REVOKE ALL ON TABLE public.v6_migration_sentinels FROM anon;
REVOKE ALL ON TABLE public.v6_migration_sentinels FROM authenticated;

DO $$
DECLARE
    v_already_done boolean;
    v_mx_source integer := 0;
    v_mx_backed integer := 0;
    v_mx_cleared integer := 0;
    v_p_source integer := 0;
    v_p_backed integer := 0;
    v_p_cleared integer := 0;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.v6_migration_sentinels WHERE migration_key = 'v6_face_reenroll_v1'
    ) INTO v_already_done;

    IF v_already_done THEN
        RAISE NOTICE '[v6_face_reenroll_v1] Sentinel already recorded — deterministic NO-OP.';
        RETURN;
    END IF;

    -- 1. mx_personnel backup + verified clear
    ALTER TABLE public.mx_personnel
        ADD COLUMN IF NOT EXISTS face_descriptor_v5_backup jsonb;

    SELECT count(*) INTO v_mx_source
    FROM public.mx_personnel
    WHERE "faceDescriptor" IS NOT NULL;

    UPDATE public.mx_personnel
    SET face_descriptor_v5_backup = "faceDescriptor"
    WHERE "faceDescriptor" IS NOT NULL
      AND face_descriptor_v5_backup IS NULL;

    SELECT count(*) INTO v_mx_backed
    FROM public.mx_personnel
    WHERE "faceDescriptor" IS NOT NULL
      AND face_descriptor_v5_backup IS NOT NULL;

    IF v_mx_backed < v_mx_source THEN
        RAISE EXCEPTION 'Aborting v6 face re-enrollment: mx_personnel backup count (%) < source count (%)', v_mx_backed, v_mx_source;
    END IF;

    UPDATE public.mx_personnel
    SET "faceDescriptor" = NULL
    WHERE "faceDescriptor" IS NOT NULL
      AND face_descriptor_v5_backup IS NOT NULL;
    GET DIAGNOSTICS v_mx_cleared = ROW_COUNT;

    -- 2. personnel backup + verified clear (if table exists)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'personnel') THEN
        ALTER TABLE public.personnel
            ADD COLUMN IF NOT EXISTS face_descriptor_v5_backup jsonb;

        SELECT count(*) INTO v_p_source
        FROM public.personnel
        WHERE "faceDescriptor" IS NOT NULL;

        UPDATE public.personnel
        SET face_descriptor_v5_backup = "faceDescriptor"
        WHERE "faceDescriptor" IS NOT NULL
          AND face_descriptor_v5_backup IS NULL;

        SELECT count(*) INTO v_p_backed
        FROM public.personnel
        WHERE "faceDescriptor" IS NOT NULL
          AND face_descriptor_v5_backup IS NOT NULL;

        IF v_p_backed < v_p_source THEN
            RAISE EXCEPTION 'Aborting v6 face re-enrollment: personnel backup count (%) < source count (%)', v_p_backed, v_p_source;
        END IF;

        UPDATE public.personnel
        SET "faceDescriptor" = NULL
        WHERE "faceDescriptor" IS NOT NULL
          AND face_descriptor_v5_backup IS NOT NULL;
        GET DIAGNOSTICS v_p_cleared = ROW_COUNT;
    END IF;

    -- 3. Record one-time completion sentinel (metadata counts only; zero biometric data)
    INSERT INTO public.v6_migration_sentinels (
        migration_key,
        backed_up_mx_count,
        cleared_mx_count,
        backed_up_personnel_count,
        cleared_personnel_count,
        notes
    ) VALUES (
        'v6_face_reenroll_v1',
        v_mx_backed,
        v_mx_cleared,
        v_p_backed,
        v_p_cleared,
        'Backed up v5 descriptors and cleared for forced v6 SSD re-enrollment.'
    );
END $$;

COMMIT;
