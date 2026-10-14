-- ==============================================================================
-- PASS 13G: ATTENDANCE V2 MEDIA AUTHORIZATION & SYNC SUBSYSTEM
-- ==============================================================================
-- Implements trusted event-bound selfie upload request and confirmation RPCs.
-- Enforces deterministic pathing: selfies/{subsidiary}/{personnel_id}/{shift_id}/{event_id}.jpg
-- Zero production mutations: Mutates ONLY disposable test environment.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REQUEST ATTENDANCE SELFIE UPLOAD RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_attendance_selfie_upload(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_personnel_id TEXT;
    v_event RECORD;
    v_shift RECORD;
    v_expected_path TEXT;
    v_bucket TEXT := 'attendance-v2-media-private';
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    v_personnel_id := public.get_authoritative_personnel_id();
    IF v_personnel_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'IDENTITY_RESOLUTION_FAILED');
    END IF;

    -- Locate event
    SELECT * INTO v_event FROM public.attendance_events WHERE event_id = p_event_id;
    IF v_event.event_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND');
    END IF;

    -- Enforce ownership
    IF v_event.personnel_id <> v_personnel_id OR v_event.auth_user_id <> v_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'EVENT_OWNERSHIP_MISMATCH');
    END IF;

    -- Locate shift for subsidiary
    SELECT * INTO v_shift FROM public.attendance_shifts WHERE shift_id = v_event.shift_id;
    IF v_shift.shift_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_NOT_FOUND');
    END IF;

    -- Construct deterministic private storage path
    v_expected_path := 'selfies/' || v_shift.subsidiary || '/' || v_personnel_id || '/' || v_shift.shift_id::text || '/' || p_event_id::text || '.jpg';

    RETURN jsonb_build_object(
        'success', true,
        'bucket', v_bucket,
        'storage_path', v_expected_path,
        'event_id', p_event_id,
        'shift_id', v_shift.shift_id,
        'personnel_id', v_personnel_id,
        'subsidiary', v_shift.subsidiary
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_attendance_selfie_upload(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_attendance_selfie_upload(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. CONFIRM ATTENDANCE SELFIE UPLOAD RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_attendance_selfie_upload(
    p_event_id UUID,
    p_storage_path TEXT,
    p_byte_size INT,
    p_sha256_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_personnel_id TEXT;
    v_event RECORD;
    v_shift RECORD;
    v_expected_path TEXT;
    v_bucket TEXT := 'attendance-v2-media-private';
    v_media_id UUID;
    v_existing_media RECORD;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    v_personnel_id := public.get_authoritative_personnel_id();
    IF v_personnel_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'IDENTITY_RESOLUTION_FAILED');
    END IF;

    -- Validate parameters
    IF p_byte_size IS NULL OR p_byte_size <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_BYTE_SIZE');
    END IF;

    IF p_sha256_hash IS NULL OR length(p_sha256_hash) <> 64 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_SHA256_HASH');
    END IF;

    -- Locate event
    SELECT * INTO v_event FROM public.attendance_events WHERE event_id = p_event_id;
    IF v_event.event_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND');
    END IF;

    -- Enforce ownership
    IF v_event.personnel_id <> v_personnel_id OR v_event.auth_user_id <> v_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'EVENT_OWNERSHIP_MISMATCH');
    END IF;

    -- Locate shift for subsidiary
    SELECT * INTO v_shift FROM public.attendance_shifts WHERE shift_id = v_event.shift_id;
    IF v_shift.shift_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_NOT_FOUND');
    END IF;

    -- Validate path strictly against deterministic server path
    v_expected_path := 'selfies/' || v_shift.subsidiary || '/' || v_personnel_id || '/' || v_shift.shift_id::text || '/' || p_event_id::text || '.jpg';
    IF p_storage_path <> v_expected_path THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'INVALID_STORAGE_PATH',
            'expected_path', v_expected_path,
            'received_path', p_storage_path
        );
    END IF;

    -- Check if media already confirmed for this event
    SELECT * INTO v_existing_media FROM public.attendance_event_media 
    WHERE event_id = p_event_id AND media_type = 'SELFIE';

    IF v_existing_media.media_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'ALREADY_CONFIRMED',
            'media_id', v_existing_media.media_id,
            'event_id', p_event_id
        );
    END IF;

    v_media_id := gen_random_uuid();
    INSERT INTO public.attendance_event_media (
        media_id, event_id, media_type, storage_bucket, storage_path,
        mime_type, file_size_bytes, sha256_hash, captured_at, uploaded_at
    ) VALUES (
        v_media_id, p_event_id, 'SELFIE', v_bucket, v_expected_path,
        'image/jpeg', p_byte_size, lower(p_sha256_hash), now(), now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', 'CONFIRMED',
        'media_id', v_media_id,
        'event_id', p_event_id,
        'storage_path', v_expected_path
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_attendance_selfie_upload(UUID, TEXT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_attendance_selfie_upload(UUID, TEXT, INT, TEXT) TO authenticated;
