-- ============================================================================
-- LATNOVVA ServiceTool v6.0.0 — PRE-FIRST-v6-REENROLLMENT ROLLBACK ONLY
--
-- IRREVERSIBLE BOUNDARY:
-- * BEFORE any employee completes a v6 Face ID re-enrollment:
--   Restoring v5 descriptors from face_descriptor_v5_backup is safe.
-- * AFTER the first v6 re-enrollment occurs:
--   DO NOT blindly run this script — it intentionally aborts if ANY row
--   already holds a newly enrolled v6 descriptor.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_mx_v6_count integer := 0;
    v_p_v6_count integer := 0;
BEGIN
    SELECT count(*) INTO v_mx_v6_count
    FROM public.mx_personnel
    WHERE "faceDescriptor" IS NOT NULL;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'personnel') THEN
        SELECT count(*) INTO v_p_v6_count
        FROM public.personnel
        WHERE "faceDescriptor" IS NOT NULL;
    END IF;

    IF v_mx_v6_count > 0 OR v_p_v6_count > 0 THEN
        RAISE EXCEPTION 'Rollback aborted: % mx_personnel and % personnel rows already have newly enrolled v6 descriptors. Past irreversible boundary.',
            v_mx_v6_count, v_p_v6_count;
    END IF;

    UPDATE public.mx_personnel
    SET "faceDescriptor" = face_descriptor_v5_backup
    WHERE face_descriptor_v5_backup IS NOT NULL;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'personnel') THEN
        UPDATE public.personnel
        SET "faceDescriptor" = face_descriptor_v5_backup
        WHERE face_descriptor_v5_backup IS NOT NULL;
    END IF;

    DELETE FROM public.v6_migration_sentinels
    WHERE migration_key = 'v6_face_reenroll_v1';
END $$;

COMMIT;
