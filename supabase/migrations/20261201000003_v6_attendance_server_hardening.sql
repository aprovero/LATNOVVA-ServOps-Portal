-- ============================================================================
-- LATNOVVA ServiceTool v6.0.0 — Attendance V2 Server Hardening (PASS 15I)
-- Grounded verbatim in live production public.record_attendance_event(jsonb)
-- captured in V6-PEND-013 (oid 75845, 573 lines).
--
-- Intentional Security & Invariant Fixes:
-- 1. Authorization BEFORE idempotency lookup + owner check on ALREADY_APPLIED
--    (prevents cross-user event_id/shift_id oracle while preserving authorized
--    duplicate ACK even if worker subsequently becomes Inactive).
-- 2. Fail-closed mx_personnel.status guard (UPPER(TRIM(status)) = 'ACTIVE' only)
--    returning status='REJECTED_TERMINATED', error='PERSONNEL_INACTIVE'.
-- 3. Face evidence authority guard: removes silent 'UNSPECIFIED_BYPASS'
--    coercion; rejects missing/unapproved bypass reasons with
--    FACE_VERIFICATION_REQUIRED.
-- 4. Server-side offline lease device binding (v_lease.device_id = v_device_id)
--    and project scope enforcement on both offline CLOCK_IN and CLOCK_OUT.
-- 5. Deferred zombie shift auto-close in CLOCK_IN until AFTER all validations
--    pass (rejected CLOCK_IN never mutates an existing OPEN shift).
-- 6. Normal ON_SITE CLOCK_OUT geofence enforcement for BOTH online and offline
--    events using event-effective geofence versions (FORGOTTEN_CLOCKOUT and
--    HOME_OFFICE exception contracts preserved intact).
-- 7. Explicit REVOKE ALL FROM PUBLIC & anon on record_attendance_event(jsonb).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.record_attendance_event(p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_caller_personnel_id TEXT;
    v_personnel_id TEXT;
    v_personnel_status TEXT;
    v_target_personnel_id TEXT;
    v_is_proxy_punch BOOLEAN := FALSE;
    v_subsidiary TEXT;
    v_system_state TEXT;
    v_min_release_id INT;
    v_zombie_threshold_hours NUMERIC;
    v_event_id UUID;
    v_shift_id UUID;
    v_project_id UUID;
    v_event_type TEXT;
    v_work_type TEXT;
    v_device_event_timestamp TIMESTAMPTZ;
    v_tz_offset SMALLINT;
    v_device_id TEXT;
    v_device_platform TEXT;
    v_client_app_version TEXT;
    v_client_release_id INT;
    v_client_commit_hash TEXT;
    v_protocol_version INT;
    v_created_offline BOOLEAN;
    v_offline_lease_id UUID;
    v_lat NUMERIC;
    v_lon NUMERIC;
    v_accuracy NUMERIC;
    v_gps_verified BOOLEAN;
    v_geofence_status TEXT;
    v_geofence_distance NUMERIC;
    v_geofence_version_id UUID;
    v_face_verified BOOLEAN;
    v_face_bypass_reason TEXT;
    v_is_manual_adjustment BOOLEAN;
    v_adjustment_reason TEXT;
    v_reported_departure TIMESTAMPTZ;
    v_worker_explanation TEXT;
    v_canonical_hash TEXT;
    v_existing_event RECORD;
    v_active_shift RECORD;
    v_zombie_shift_to_close_id UUID := NULL;
    v_zombie_shift_clock_in_at TIMESTAMPTZ := NULL;
    v_lease RECORD;
    v_scope RECORD;
    v_active_geofence public.project_geofence_versions%ROWTYPE;
    v_sec_loc RECORD;
    v_server_distance NUMERIC := NULL;
    v_secondary_distance NUMERIC := NULL;
    v_server_geofence_status TEXT := 'UNKNOWN';
    v_attendance_location_id UUID := NULL;
    v_project_location_id UUID := NULL;
    v_is_assigned_project BOOLEAN := FALSE;
    v_duration_minutes INT := 0;
    v_payable_hours NUMERIC(5,2) := 0.00;
    v_overtime_hours NUMERIC(5,2) := 0.00;
    v_close_method TEXT := 'NORMAL_CLOCK_OUT';
    v_final_status TEXT := 'COMPLETED';
    v_requires_review BOOLEAN := FALSE;
    v_review_status TEXT := 'NONE';
    v_effective_clock_out TIMESTAMPTZ;
    v_matched_secondary BOOLEAN := FALSE;
    v_eval_ts TIMESTAMPTZ;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'NOT_AUTHENTICATED');
    END IF;

    SELECT system_state, minimum_v2_client_release_id, COALESCE(zombie_shift_threshold_hours, 14)
    INTO v_system_state, v_min_release_id, v_zombie_threshold_hours
    FROM public.attendance_v2_control WHERE control_id = 1;

    IF v_system_state NOT IN ('V2_ACTIVE', 'V2_DEGRADED') THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'V2_NOT_ACTIVE');
    END IF;

    -- Parse payload safely (NULLIF prevents ''::uuid cast crash)
    v_event_id := COALESCE(NULLIF(TRIM(p_event->>'event_id'), '')::uuid, gen_random_uuid());
    v_shift_id := NULLIF(TRIM(p_event->>'shift_id'), '')::uuid;
    v_project_id := NULLIF(TRIM(p_event->>'project_id'), '')::uuid;
    v_target_personnel_id := NULLIF(TRIM(p_event->>'personnel_id'), '');
    v_event_type := UPPER(COALESCE(NULLIF(TRIM(p_event->>'event_type'), ''), ''));
    v_work_type := CASE WHEN UPPER(COALESCE(NULLIF(TRIM(p_event->>'work_type'), ''), 'ON_SITE')) IN ('HOME_OFFICE', 'HOME OFFICE') THEN 'HOME_OFFICE' ELSE 'ON_SITE' END;
    v_device_event_timestamp := COALESCE(NULLIF(TRIM(p_event->>'device_event_timestamp'), '')::timestamptz, now());
    v_tz_offset := COALESCE(NULLIF(TRIM(p_event->>'timezone_offset_minutes'), '')::smallint, 0);
    v_device_id := COALESCE(NULLIF(TRIM(p_event->>'device_id'), ''), 'unknown');
    v_device_platform := COALESCE(NULLIF(TRIM(p_event->>'device_platform'), ''), 'web');
    v_client_app_version := COALESCE(NULLIF(TRIM(p_event->>'client_app_version'), ''), '5.1.4');
    v_client_release_id := NULLIF(TRIM(p_event->>'client_release_id'), '')::int;
    v_client_commit_hash := COALESCE(NULLIF(TRIM(p_event->>'client_commit_hash'), ''), 'unknown');
    v_protocol_version := COALESCE(NULLIF(TRIM(p_event->>'attendance_protocol_version'), '')::int, 2);
    v_created_offline := COALESCE((p_event->>'created_offline')::boolean, FALSE);
    v_offline_lease_id := NULLIF(TRIM(p_event->>'offline_lease_id'), '')::uuid;
    v_lat := NULLIF(TRIM(p_event->>'latitude'), '')::numeric;
    v_lon := NULLIF(TRIM(p_event->>'longitude'), '')::numeric;
    v_accuracy := NULLIF(TRIM(p_event->>'accuracy_meters'), '')::numeric;
    v_gps_verified := COALESCE((p_event->>'gps_verified')::boolean, FALSE);
    v_geofence_status := UPPER(COALESCE(NULLIF(TRIM(p_event->>'geofence_status'), ''), 'UNKNOWN'));
    IF v_geofence_status NOT IN ('INSIDE', 'OUTSIDE', 'UNKNOWN', 'BYPASS_AUTHORIZED', 'NOT_APPLICABLE') THEN
        v_geofence_status := 'UNKNOWN';
    END IF;
    v_geofence_distance := NULLIF(TRIM(p_event->>'geofence_distance_meters'), '')::numeric;
    v_geofence_version_id := NULLIF(TRIM(p_event->>'geofence_version_id'), '')::uuid;
    v_face_verified := COALESCE((p_event->>'face_verified')::boolean, FALSE);
    v_face_bypass_reason := NULLIF(TRIM(p_event->>'face_bypass_reason'), '');
    v_is_manual_adjustment := COALESCE((p_event->>'is_manual_adjustment')::boolean, FALSE);
    v_adjustment_reason := NULLIF(TRIM(p_event->>'adjustment_reason'), '');
    v_reported_departure := NULLIF(TRIM(p_event->>'reported_departure_timestamp'), '')::timestamptz;
    v_worker_explanation := NULLIF(TRIM(p_event->>'worker_explanation'), '');

    -- 1. Identity Verification BEFORE Idempotency Lookup (PASS 15I Section 13)
    v_caller_personnel_id := public.get_authoritative_personnel_id();
    SELECT role, subsidiary INTO v_caller_role, v_caller_subsidiary
    FROM public.profiles WHERE id = v_uid;

    IF v_target_personnel_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'IDENTITY_UNRESOLVED');
    END IF;

    IF v_caller_personnel_id IS NOT NULL AND v_caller_personnel_id = v_target_personnel_id THEN
        v_personnel_id := v_caller_personnel_id;
        v_is_proxy_punch := FALSE;
    ELSIF v_caller_role IN ('Supervisor', 'Manager', 'HR', 'Admin', 'SuperAdmin') THEN
        SELECT COALESCE(subsidiary, 'MX') INTO v_subsidiary FROM public.mx_personnel WHERE id = v_target_personnel_id;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'TARGET_PERSONNEL_NOT_FOUND');
        END IF;
        IF v_caller_role NOT IN ('Admin', 'SuperAdmin') AND v_caller_subsidiary IS DISTINCT FROM v_subsidiary THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CROSS_SUBSIDIARY_FORBIDDEN');
        END IF;
        v_personnel_id := v_target_personnel_id;
        v_is_proxy_punch := TRUE;
    ELSE
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'IDENTITY_SPOOF_ATTEMPT');
    END IF;

    -- 2. Authorized Idempotency Check (runs AFTER identity auth, BEFORE status guard)
    --    Ensures an already-applied legitimate event still ACKs if worker later becomes Inactive,
    --    while blocking cross-user event_id/shift_id disclosure.
    v_canonical_hash := public.compute_canonical_event_hash(p_event);
    SELECT * INTO v_existing_event FROM public.attendance_events WHERE event_id = v_event_id;
    IF v_existing_event.event_id IS NOT NULL THEN
        IF v_existing_event.personnel_id IS DISTINCT FROM v_personnel_id THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'IDENTITY_SPOOF_ATTEMPT');
        END IF;
        IF v_existing_event.canonical_hash = v_canonical_hash THEN
            RETURN jsonb_build_object(
                'success', true,
                'status', 'ALREADY_APPLIED',
                'event_id', v_event_id,
                'shift_id', v_existing_event.shift_id
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'status', 'REJECTED',
                'error', 'CANONICAL_HASH_MISMATCH'
            );
        END IF;
    END IF;

    -- 3. Fail-Closed Personnel Status Guard (PASS 15I Section 12)
    --    Verified production status vocabulary (V6-PEND-013): Active (100), Inactive (14), NULL (0).
    SELECT COALESCE(subsidiary, 'MX'), status
    INTO v_subsidiary, v_personnel_status
    FROM public.mx_personnel
    WHERE id = v_personnel_id;

    IF NOT FOUND OR UPPER(TRIM(COALESCE(v_personnel_status, ''))) <> 'ACTIVE' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status', 'REJECTED_TERMINATED',
            'error', 'PERSONNEL_INACTIVE'
        );
    END IF;

    -- 4. Client Release Gate
    IF v_min_release_id IS NOT NULL AND (v_client_release_id IS NULL OR v_client_release_id < v_min_release_id) THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CLIENT_VERSION_DEPRECATED');
    END IF;

    -- 5. Face Evidence Authority Guard (PASS 15I Section 17)
    --    Never silently coerce missing/failed Face evidence to UNSPECIFIED_BYPASS.
    IF v_face_verified THEN
        v_face_bypass_reason := NULL;
    ELSE
        IF v_face_bypass_reason IS NULL OR UPPER(v_face_bypass_reason) = 'UNSPECIFIED_BYPASS' THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'FACE_VERIFICATION_REQUIRED');
        END IF;
        IF NOT (
            (v_adjustment_reason = 'FORGOTTEN_CLOCKOUT' AND v_face_bypass_reason = 'STALE_SHIFT_CLOSED_8H')
            OR (v_adjustment_reason = 'SHORT_SHIFT_DISCARD' AND v_face_bypass_reason = 'SHORT_SHIFT_DISCARDED')
            OR (v_is_proxy_punch AND v_face_bypass_reason = 'SUPERVISOR_PROXY_PUNCH')
            OR v_face_bypass_reason IN (
                'Cámara dañada o no disponible',
                'Mala iluminación / contraluz',
                'Condiciones climáticas (lluvia / polvo)',
                'Otro motivo',
                'CAMERA_UNAVAILABLE',
                'FACE_BYPASS_3_STRIKES'
            )
        ) THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'FACE_BYPASS_UNAUTHORIZED');
        END IF;
    END IF;

    v_eval_ts := CASE WHEN v_created_offline THEN v_device_event_timestamp ELSE now() END;

    -- --------------------------------------------------------------------------
    -- CLOCK_IN ROUTING
    -- --------------------------------------------------------------------------
    IF v_event_type = 'CLOCK_IN' THEN
        IF v_shift_id IS NULL OR v_project_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'MISSING_SHIFT_OR_PROJECT_ID');
        END IF;

        -- Project Assignment Check (CLOCK_IN only; Supervisors/Managers/HR/Admins can batch-punch)
        IF NOT v_is_proxy_punch THEN
            SELECT EXISTS (
                SELECT 1 FROM public.projects
                WHERE id = v_project_id
                  AND (
                      to_jsonb(assigned_personnel) ? v_personnel_id
                      OR to_jsonb(assigned_personnel) ? (v_uid::text)
                  )
            ) INTO v_is_assigned_project;

            IF NOT v_is_assigned_project THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'PROJECT_NOT_ASSIGNED');
            END IF;
        END IF;

        -- Offline lease check if created_offline (with exact server device binding — PASS 15I Section 14)
        IF v_created_offline THEN
            IF v_offline_lease_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_MISSING');
            END IF;
            SELECT * INTO v_lease FROM public.attendance_offline_leases WHERE lease_id = v_offline_lease_id;
            IF v_lease.lease_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_NOT_FOUND');
            END IF;
            IF v_lease.personnel_id <> v_personnel_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_IDENTITY_MISMATCH');
            END IF;
            IF v_device_id IS NULL OR v_device_id = '' OR v_device_id = 'unknown'
               OR v_lease.device_id IS DISTINCT FROM v_device_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_DEVICE_MISMATCH');
            END IF;
            IF v_device_event_timestamp < v_lease.valid_from OR v_device_event_timestamp > v_lease.valid_until THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_EXPIRED');
            END IF;
            IF v_lease.is_revoked AND v_lease.revoked_at <= v_device_event_timestamp THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_REVOKED');
            END IF;
            SELECT * INTO v_scope FROM public.attendance_offline_lease_scopes
            WHERE lease_id = v_offline_lease_id AND project_id = v_project_id;
            IF v_scope.scope_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_PROJECT_NOT_SCOPED');
            END IF;
        END IF;

        PERFORM pg_advisory_xact_lock(hashtextextended(v_personnel_id, 0));

        SELECT * INTO v_active_shift
        FROM public.attendance_shifts
        WHERE personnel_id = v_personnel_id AND status = 'OPEN';

        IF v_active_shift.shift_id IS NOT NULL THEN
            IF v_active_shift.shift_id = v_shift_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'CONFLICT', 'error', 'CLOCK_IN_ALREADY_EXISTS');
            ELSIF now() - v_active_shift.first_clock_in_at > (v_zombie_threshold_hours || ' hours')::interval THEN
                -- Defer zombie auto-close UPDATE until AFTER geofence validation passes (PASS 15I Section 16)
                v_zombie_shift_to_close_id := v_active_shift.shift_id;
                v_zombie_shift_clock_in_at := v_active_shift.first_clock_in_at;
            ELSE
                RETURN jsonb_build_object('success', false, 'status', 'ACTIVE_SHIFT_CONFLICT', 'error', 'Worker already has an active OPEN shift');
            END IF;
        END IF;

        -- Geofence & Home Office Validation (event-effective versioning for offline replay)
        v_active_geofence := NULL;
        IF v_geofence_version_id IS NOT NULL THEN
            SELECT * INTO v_active_geofence
            FROM public.project_geofence_versions
            WHERE version_id = v_geofence_version_id
              AND project_id = v_project_id
            LIMIT 1;
        END IF;
        IF v_active_geofence.version_id IS NULL THEN
            SELECT * INTO v_active_geofence
            FROM public.project_geofence_versions
            WHERE project_id = v_project_id
              AND effective_from <= v_eval_ts
              AND (effective_until IS NULL OR effective_until > v_eval_ts)
            ORDER BY effective_from DESC LIMIT 1;
        END IF;
        IF v_active_geofence.version_id IS NULL THEN
            SELECT * INTO v_active_geofence
            FROM public.project_geofence_versions
            WHERE project_id = v_project_id
            ORDER BY effective_from DESC LIMIT 1;
        END IF;

        IF v_work_type = 'HOME_OFFICE' THEN
            IF v_active_geofence.version_id IS NOT NULL AND v_active_geofence.home_office_allowed = FALSE THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'HOME_OFFICE_NOT_ALLOWED');
            END IF;
            v_server_geofence_status := 'NOT_APPLICABLE';
        ELSIF v_work_type = 'ON_SITE' THEN
            IF v_active_geofence.version_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GEOFENCE_NOT_CONFIGURED');
            END IF;
            v_geofence_version_id := v_active_geofence.version_id;

            IF v_lat IS NULL OR v_lon IS NULL OR NOT v_gps_verified THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_UNVERIFIED');
            END IF;

            v_server_distance := public.calculate_geofence_distance_meters(
                v_lat::double precision, v_lon::double precision,
                v_active_geofence.latitude, v_active_geofence.longitude
            );

            IF (v_accuracy IS NOT NULL AND v_accuracy <= v_active_geofence.accuracy_threshold_meters)
               AND v_server_distance <= v_active_geofence.radius_meters THEN
                v_server_geofence_status := 'PRIMARY_GEOFENCE';
            ELSE
                -- Check ALL active secondary physical locations effective at event time (not LIMIT 1)
                v_matched_secondary := FALSE;
                FOR v_sec_loc IN
                    SELECT pl.project_location_id, l.location_id, l.latitude, l.longitude,
                           l.radius_meters, l.accuracy_threshold_meters
                    FROM public.attendance_project_locations pl
                    JOIN public.attendance_locations l ON l.location_id = pl.location_id
                    WHERE pl.project_id = v_project_id
                      AND pl.is_active = TRUE
                      AND pl.valid_from <= v_eval_ts
                      AND (pl.valid_until IS NULL OR pl.valid_until > v_eval_ts)
                      AND l.is_active = TRUE
                      AND l.valid_from <= v_eval_ts
                      AND (l.valid_until IS NULL OR l.valid_until > v_eval_ts)
                LOOP
                    v_secondary_distance := public.calculate_geofence_distance_meters(
                        v_lat::double precision, v_lon::double precision,
                        v_sec_loc.latitude, v_sec_loc.longitude
                    );
                    IF (v_accuracy IS NOT NULL AND v_accuracy <= v_sec_loc.accuracy_threshold_meters)
                       AND v_secondary_distance <= v_sec_loc.radius_meters THEN
                        v_server_distance := v_secondary_distance;
                        v_server_geofence_status := 'SECONDARY_GEOFENCE';
                        v_attendance_location_id := v_sec_loc.location_id;
                        v_project_location_id := v_sec_loc.project_location_id;
                        v_matched_secondary := TRUE;
                        EXIT;
                    END IF;
                END LOOP;

                IF NOT v_matched_secondary THEN
                    IF v_accuracy IS NOT NULL AND v_accuracy > v_active_geofence.accuracy_threshold_meters THEN
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                    ELSE
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                    END IF;
                END IF;
            END IF;
        END IF;

        -- All CLOCK_IN validations passed — now safely auto-close deferred zombie shift if any
        IF v_zombie_shift_to_close_id IS NOT NULL THEN
            UPDATE public.attendance_shifts
            SET status = 'ZOMBIE_PENDING_RECONCILIATION',
                final_clock_out_at = v_zombie_shift_clock_in_at + interval '8 hours',
                physical_duration_minutes = 480,
                payable_hours = 8.00,
                overtime_hours = 0.00,
                close_method = 'ZOMBIE_AUTO_CLOSE_8H',
                requires_review = TRUE,
                review_status = 'PENDING',
                review_notes = 'Auto-cerrado por turno pendiente >' || v_zombie_threshold_hours || 'h (8.00h estándar)',
                updated_at = now()
            WHERE shift_id = v_zombie_shift_to_close_id;
        END IF;

        INSERT INTO public.attendance_shifts (
            shift_id, auth_user_id, personnel_id, project_id, subsidiary, work_type,
            first_clock_in_at, final_clock_out_at, status, requires_review, review_status
        ) VALUES (
            v_shift_id, v_uid, v_personnel_id, v_project_id, v_subsidiary, v_work_type,
            v_device_event_timestamp, NULL, 'OPEN', FALSE, 'NONE'
        );

        INSERT INTO public.attendance_events (
            event_id, shift_id, personnel_id, project_id,
            event_type, work_type, device_event_timestamp, timezone_offset_minutes,
            device_id, device_platform, client_app_version, client_release_id, client_commit_hash,
            attendance_protocol_version, created_offline, offline_lease_id,
            latitude, longitude, accuracy_meters, gps_verified, geofence_status,
            geofence_distance_meters, geofence_version_id, attendance_location_id, project_location_id,
            face_verified, face_bypass_reason,
            is_manual_adjustment, adjustment_reason, reported_departure_timestamp, worker_explanation,
            auth_user_id, server_received_at, canonical_hash, server_authorization_outcome,
            server_geofence_distance_meters, server_geofence_status
        ) VALUES (
            v_event_id, v_shift_id, v_personnel_id, v_project_id,
            'CLOCK_IN', v_work_type, v_device_event_timestamp, v_tz_offset,
            v_device_id, v_device_platform, v_client_app_version, v_client_release_id, v_client_commit_hash,
            v_protocol_version, v_created_offline, v_offline_lease_id,
            v_lat, v_lon, v_accuracy, v_gps_verified, v_geofence_status,
            v_geofence_distance, v_geofence_version_id, v_attendance_location_id, v_project_location_id,
            v_face_verified, v_face_bypass_reason,
            v_is_manual_adjustment, v_adjustment_reason, v_reported_departure, v_worker_explanation,
            v_uid, now(), v_canonical_hash, 'AUTHORIZED',
            v_server_distance, v_server_geofence_status
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'APPLIED',
            'event_id', v_event_id,
            'shift_id', v_shift_id,
            'event_type', 'CLOCK_IN',
            'authorization_policy', v_server_geofence_status
        );

    -- --------------------------------------------------------------------------
    -- CLOCK_OUT ROUTING
    -- --------------------------------------------------------------------------
    ELSIF v_event_type = 'CLOCK_OUT' THEN
        IF v_shift_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'MISSING_SHIFT_ID');
        END IF;

        PERFORM pg_advisory_xact_lock(hashtextextended(v_shift_id::text, 0));

        SELECT * INTO v_active_shift
        FROM public.attendance_shifts
        WHERE shift_id = v_shift_id;

        IF v_active_shift.shift_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'ACTIVE_SHIFT_NOT_FOUND');
        END IF;

        IF v_active_shift.personnel_id <> v_personnel_id THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'SHIFT_OWNERSHIP_MISMATCH');
        END IF;

        IF v_active_shift.status NOT IN ('OPEN', 'ZOMBIE_PENDING_RECONCILIATION') THEN
            RETURN jsonb_build_object('success', false, 'status', 'CONFLICT', 'error', 'SHIFT_ALREADY_CLOSED');
        END IF;

        -- Always bind CLOCK_OUT project_id & work_type to the authoritative active shift
        v_project_id := v_active_shift.project_id;
        v_work_type := v_active_shift.work_type;

        -- Offline lease validation for offline CLOCK_OUT (exact device binding + scope — PASS 15I Section 14)
        IF v_created_offline THEN
            IF v_offline_lease_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_MISSING');
            END IF;
            SELECT * INTO v_lease FROM public.attendance_offline_leases WHERE lease_id = v_offline_lease_id;
            IF v_lease.lease_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_NOT_FOUND');
            END IF;
            IF v_lease.personnel_id <> v_personnel_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_IDENTITY_MISMATCH');
            END IF;
            IF v_device_id IS NULL OR v_device_id = '' OR v_device_id = 'unknown'
               OR v_lease.device_id IS DISTINCT FROM v_device_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_DEVICE_MISMATCH');
            END IF;
            IF v_device_event_timestamp < v_lease.valid_from OR v_device_event_timestamp > v_lease.valid_until THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_EXPIRED');
            END IF;
            IF v_lease.is_revoked AND v_lease.revoked_at <= v_device_event_timestamp THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_REVOKED');
            END IF;
            SELECT * INTO v_scope FROM public.attendance_offline_lease_scopes
            WHERE lease_id = v_offline_lease_id AND project_id = v_project_id;
            IF v_scope.scope_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_PROJECT_NOT_SCOPED');
            END IF;
        END IF;

        IF v_device_event_timestamp < v_active_shift.first_clock_in_at THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CLOCK_OUT_BEFORE_CLOCK_IN');
        END IF;

        IF v_adjustment_reason = 'SHORT_SHIFT_DISCARD' THEN
            -- Accidental <3 min punch discard -> 0.00h, Rejected
            v_effective_clock_out := v_device_event_timestamp;
            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_effective_clock_out - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := 0.00;
            v_overtime_hours := 0.00;
            v_close_method := 'MANUAL_SUPERVISOR_ADJUSTMENT';
            v_final_status := 'COMPLETED';
            v_requires_review := FALSE;
            v_review_status := 'REJECTED';
            v_server_geofence_status := 'BYPASS_AUTHORIZED';

        ELSIF v_adjustment_reason = 'FORGOTTEN_CLOCKOUT' THEN
            -- Stale / Forgotten clock-out -> 8.00 standard hours, Pending review
            IF v_reported_departure IS NOT NULL AND v_reported_departure >= v_active_shift.first_clock_in_at THEN
                v_effective_clock_out := v_reported_departure;
            ELSE
                v_effective_clock_out := v_active_shift.first_clock_in_at + interval '8 hours';
            END IF;
            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_effective_clock_out - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := 8.00;
            v_overtime_hours := 0.00;
            v_close_method := 'FORGOTTEN_CLOCKOUT_8H';
            v_final_status := 'COMPLETED_FORGOTTEN_8H';
            v_requires_review := TRUE;
            v_review_status := 'PENDING';
            v_server_geofence_status := 'BYPASS_AUTHORIZED';
            IF v_worker_explanation IS NULL THEN
                v_worker_explanation := 'Olvidé registrar mi salida (cierre estándar 8.00h)';
            END IF;
            v_reported_departure := v_effective_clock_out;
            v_gps_verified := FALSE;
            v_is_manual_adjustment := TRUE;

        ELSE
            -- Normal Clock-Out (Online AND Offline ON_SITE require valid geofence — PASS 15I Section 15)
            v_effective_clock_out := v_device_event_timestamp;
            IF v_work_type = 'ON_SITE' THEN
                v_active_geofence := NULL;
                IF v_geofence_version_id IS NOT NULL THEN
                    SELECT * INTO v_active_geofence
                    FROM public.project_geofence_versions
                    WHERE version_id = v_geofence_version_id
                      AND project_id = v_project_id
                    LIMIT 1;
                END IF;
                IF v_active_geofence.version_id IS NULL THEN
                    SELECT * INTO v_active_geofence
                    FROM public.project_geofence_versions
                    WHERE project_id = v_project_id
                      AND effective_from <= v_eval_ts
                      AND (effective_until IS NULL OR effective_until > v_eval_ts)
                    ORDER BY effective_from DESC LIMIT 1;
                END IF;
                IF v_active_geofence.version_id IS NULL THEN
                    SELECT * INTO v_active_geofence
                    FROM public.project_geofence_versions
                    WHERE project_id = v_project_id
                    ORDER BY effective_from DESC LIMIT 1;
                END IF;

                IF v_active_geofence.version_id IS NULL THEN
                    RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GEOFENCE_NOT_CONFIGURED');
                END IF;
                v_geofence_version_id := v_active_geofence.version_id;

                IF v_lat IS NULL OR v_lon IS NULL OR NOT v_gps_verified THEN
                    RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_UNVERIFIED');
                END IF;

                v_server_distance := public.calculate_geofence_distance_meters(
                    v_lat::double precision, v_lon::double precision,
                    v_active_geofence.latitude, v_active_geofence.longitude
                );

                IF (v_accuracy IS NOT NULL AND v_accuracy <= v_active_geofence.accuracy_threshold_meters)
                   AND v_server_distance <= v_active_geofence.radius_meters THEN
                    v_server_geofence_status := 'PRIMARY_GEOFENCE';
                ELSE
                    v_matched_secondary := FALSE;
                    FOR v_sec_loc IN
                        SELECT pl.project_location_id, l.location_id, l.latitude, l.longitude,
                               l.radius_meters, l.accuracy_threshold_meters
                        FROM public.attendance_project_locations pl
                        JOIN public.attendance_locations l ON l.location_id = pl.location_id
                        WHERE pl.project_id = v_project_id
                          AND pl.is_active = TRUE
                          AND pl.valid_from <= v_eval_ts
                          AND (pl.valid_until IS NULL OR pl.valid_until > v_eval_ts)
                          AND l.is_active = TRUE
                          AND l.valid_from <= v_eval_ts
                          AND (l.valid_until IS NULL OR l.valid_until > v_eval_ts)
                    LOOP
                        v_secondary_distance := public.calculate_geofence_distance_meters(
                            v_lat::double precision, v_lon::double precision,
                            v_sec_loc.latitude, v_sec_loc.longitude
                        );
                        IF (v_accuracy IS NOT NULL AND v_accuracy <= v_sec_loc.accuracy_threshold_meters)
                           AND v_secondary_distance <= v_sec_loc.radius_meters THEN
                            v_server_distance := v_secondary_distance;
                            v_server_geofence_status := 'SECONDARY_GEOFENCE';
                            v_attendance_location_id := v_sec_loc.location_id;
                            v_project_location_id := v_sec_loc.project_location_id;
                            v_matched_secondary := TRUE;
                            EXIT;
                        END IF;
                    END LOOP;

                    IF NOT v_matched_secondary THEN
                        IF v_accuracy IS NOT NULL AND v_accuracy > v_active_geofence.accuracy_threshold_meters THEN
                            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
                        ELSE
                            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                        END IF;
                    END IF;
                END IF;
            ELSE
                v_server_geofence_status := 'NOT_APPLICABLE';
            END IF;

            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_effective_clock_out - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := LEAST(8.00, ROUND((v_duration_minutes / 60.0)::numeric, 2));
            v_overtime_hours := GREATEST(0.00, ROUND(((v_duration_minutes / 60.0) - 8.0)::numeric, 2));
            v_close_method := 'NORMAL_CLOCK_OUT';
            v_final_status := 'COMPLETED';
        END IF;

        INSERT INTO public.attendance_events (
            event_id, shift_id, personnel_id, project_id,
            event_type, work_type, device_event_timestamp, timezone_offset_minutes,
            device_id, device_platform, client_app_version, client_release_id, client_commit_hash,
            attendance_protocol_version, created_offline, offline_lease_id,
            latitude, longitude, accuracy_meters, gps_verified, geofence_status,
            geofence_distance_meters, geofence_version_id, attendance_location_id, project_location_id,
            face_verified, face_bypass_reason,
            is_manual_adjustment, adjustment_reason, reported_departure_timestamp, worker_explanation,
            auth_user_id, server_received_at, canonical_hash, server_authorization_outcome,
            server_geofence_distance_meters, server_geofence_status
        ) VALUES (
            v_event_id, v_shift_id, v_personnel_id, v_project_id,
            'CLOCK_OUT', v_work_type, v_device_event_timestamp, v_tz_offset,
            v_device_id, v_device_platform, v_client_app_version, v_client_release_id, v_client_commit_hash,
            v_protocol_version, v_created_offline, v_offline_lease_id,
            v_lat, v_lon, v_accuracy, v_gps_verified, v_geofence_status,
            v_geofence_distance, v_geofence_version_id, v_attendance_location_id, v_project_location_id,
            v_face_verified, v_face_bypass_reason,
            v_is_manual_adjustment, v_adjustment_reason, v_reported_departure, v_worker_explanation,
            v_uid, now(), v_canonical_hash, 'AUTHORIZED',
            v_server_distance, v_server_geofence_status
        );

        UPDATE public.attendance_shifts
        SET final_clock_out_at = v_effective_clock_out,
            physical_duration_minutes = v_duration_minutes,
            payable_hours = CASE WHEN v_adjustment_reason = 'SHORT_SHIFT_DISCARD' THEN 0.00 WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN 8.00 ELSE v_payable_hours END,
            overtime_hours = CASE WHEN v_adjustment_reason = 'SHORT_SHIFT_DISCARD' THEN 0.00 WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN 0.00 ELSE v_overtime_hours END,
            status = CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' AND v_adjustment_reason IS NULL THEN 'ZOMBIE_PENDING_RECONCILIATION' ELSE v_final_status END,
            close_method = v_close_method,
            requires_review = CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' AND v_adjustment_reason IS NULL THEN TRUE ELSE v_requires_review END,
            review_status = CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' AND v_adjustment_reason IS NULL THEN 'PENDING' ELSE v_review_status END,
            review_notes = COALESCE(v_worker_explanation, review_notes),
            updated_at = now()
        WHERE shift_id = v_shift_id;

        RETURN jsonb_build_object(
            'success', true,
            'status', 'APPLIED',
            'event_id', v_event_id,
            'shift_id', v_shift_id,
            'event_type', 'CLOCK_OUT',
            'payable_hours', CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN 8.00 ELSE v_payable_hours END,
            'overtime_hours', CASE WHEN v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN 0.00 ELSE v_overtime_hours END
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'INVALID_EVENT_TYPE');
    END IF;
END;
$function$;

-- Explicit EXECUTE privilege hardening (PASS 15I Section 18)
REVOKE ALL ON FUNCTION public.record_attendance_event(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_attendance_event(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_attendance_event(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_attendance_event(jsonb) TO service_role;

-- Transactional Postcondition Assertions
DO $$
DECLARE
    overload_count integer;
    public_anon_grants integer;
BEGIN
    SELECT COUNT(*) INTO overload_count
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'record_attendance_event' AND p.prosecdef = true;

    IF overload_count <> 1 THEN
        RAISE EXCEPTION 'Postcondition failed: expected 1 SECURITY DEFINER overload of record_attendance_event, found %', overload_count;
    END IF;

    SELECT COUNT(*) INTO public_anon_grants
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'record_attendance_event'
      AND grantee IN ('PUBLIC', 'anon')
      AND privilege_type = 'EXECUTE';

    IF public_anon_grants > 0 THEN
        RAISE EXCEPTION 'Postcondition failed: % PUBLIC/anon EXECUTE grants survived on record_attendance_event', public_anon_grants;
    END IF;
END $$;

COMMIT;
