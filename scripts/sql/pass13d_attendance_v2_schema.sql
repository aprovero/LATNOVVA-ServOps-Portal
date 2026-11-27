-- ==============================================================================
-- PASS 13D-R: ATTENDANCE V2 CLEAN FORWARD-ONLY SCHEMA DEFINITION (FROZEN)
-- ==============================================================================
-- TARGET ARCHITECTURE: Attendance V2 Clean Forward-Only Database Architecture
-- BASELINE: v5.0.8 / Release ID 48 / Commit 64bb2510 / Branch feature/mexico-subsidiary
-- NOTE: PASS 13D-R IS DISPOSABLE DATABASE IMPLEMENTATION + SCHEMA VALIDATION.
--       CURRENT PRODUCTION PASS 12N REMAINS COMPLETELY UNCHANGED.
--       THIS SCRIPT IS VALIDATED IN A DISPOSABLE TEST POSTGRESQL ENVIRONMENT.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ATTENDANCE V2 CONTROL & FEATURE CONFIGURATION (Singleton)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_v2_control (
    control_id INTEGER PRIMARY KEY DEFAULT 1,
    system_state TEXT NOT NULL DEFAULT 'LEGACY_ACTIVE',
    protocol_version INTEGER NOT NULL DEFAULT 2,
    minimum_v2_client_release_id INTEGER NULL DEFAULT NULL,
    minimum_v2_client_version TEXT NULL DEFAULT NULL,
    active_subsidiaries TEXT[] NOT NULL DEFAULT ARRAY['MX'],
    max_offline_lease_duration_hours INTEGER NOT NULL DEFAULT 72,
    zombie_shift_threshold_hours NUMERIC(4,2) NOT NULL DEFAULT 14.00,
    standard_shift_hours NUMERIC(4,2) NOT NULL DEFAULT 8.00,
    face_id_match_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.550,
    face_detection_timeout_seconds INTEGER NOT NULL DEFAULT 15,
    state_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    v2_activated_at TIMESTAMPTZ NULL,
    legacy_frozen_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_attendance_v2_control_singleton CHECK (control_id = 1),
    CONSTRAINT chk_attendance_v2_control_system_state CHECK (
        system_state IN ('LEGACY_ACTIVE', 'V2_DORMANT', 'V2_ACTIVE', 'V2_DEGRADED')
    )
);

COMMENT ON TABLE public.attendance_v2_control IS 'Global control plane and feature flag singleton for Attendance V2 operations.';

-- ------------------------------------------------------------------------------
-- 2. PROJECT GEOFENCE VERSIONS (Immutable / Append-Oriented Policy Ledger - MODEL A)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_geofence_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters NUMERIC(8,2) NOT NULL,
    accuracy_threshold_meters NUMERIC(8,2) NOT NULL DEFAULT 50.00,
    warehouse_bypass_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    home_office_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_until TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    notes TEXT NULL,
    CONSTRAINT uq_project_geofence_version UNIQUE (project_id, version_number),
    CONSTRAINT chk_geofence_radius CHECK (radius_meters > 0),
    CONSTRAINT chk_geofence_accuracy CHECK (accuracy_threshold_meters > 0),
    CONSTRAINT chk_geofence_effective_range CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_project_geofence_project_effective 
    ON public.project_geofence_versions (project_id, effective_from DESC);

-- Model A Immutability Trigger: Prohibit any UPDATE or DELETE on existing geofence versions.
CREATE OR REPLACE FUNCTION public.prevent_project_geofence_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'project_geofence_versions is strictly append-only (Model A): updates to existing geofence versions are prohibited. Create a new version instead.'
            USING ERRCODE = '23514';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'project_geofence_versions is strictly append-only (Model A): deletion of geofence versions is prohibited.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_geofence_versions_immutable ON public.project_geofence_versions;
CREATE TRIGGER trg_project_geofence_versions_immutable
BEFORE UPDATE OR DELETE ON public.project_geofence_versions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_project_geofence_version_mutation();

COMMENT ON TABLE public.project_geofence_versions IS 'Historical append-oriented versioning of project geofence boundaries and spatial attendance policies (Model A Full Append-Only).';

-- ------------------------------------------------------------------------------
-- 3. ATTENDANCE OFFLINE LEASES (Dual-Identity Offline Authorization Header)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_offline_leases (
    lease_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    personnel_id TEXT NOT NULL REFERENCES public.mx_personnel(id) ON DELETE RESTRICT,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    attendance_protocol_version INTEGER NOT NULL,
    client_release_id INTEGER NOT NULL,
    client_app_version TEXT NOT NULL,
    device_id TEXT NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ NULL,
    revoked_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    revocation_reason TEXT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_lease_validity CHECK (valid_until > valid_from),
    CONSTRAINT chk_lease_revocation CHECK (
        (is_revoked = FALSE AND revoked_at IS NULL AND revoked_by IS NULL) OR 
        (is_revoked = TRUE AND revoked_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_offline_leases_personnel_validity 
    ON public.attendance_offline_leases (personnel_id, valid_from, valid_until) 
    WHERE is_revoked = FALSE;

CREATE INDEX IF NOT EXISTS idx_offline_leases_auth_user 
    ON public.attendance_offline_leases (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_offline_leases_device 
    ON public.attendance_offline_leases (device_id);

COMMENT ON TABLE public.attendance_offline_leases IS 'Server-issued cryptographic offline authorization leases binding auth.uid, personnel_id, client release, and validity window.';

-- ------------------------------------------------------------------------------
-- 4. ATTENDANCE OFFLINE LEASE SCOPES (Authorized Geofence Version Scopes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_offline_lease_scopes (
    scope_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID NOT NULL REFERENCES public.attendance_offline_leases(lease_id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    geofence_version_id UUID NOT NULL REFERENCES public.project_geofence_versions(version_id) ON DELETE RESTRICT,
    warehouse_bypass_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    home_office_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_offline_lease_project UNIQUE (lease_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_offline_lease_scopes_lease 
    ON public.attendance_offline_lease_scopes (lease_id);

CREATE INDEX IF NOT EXISTS idx_offline_lease_scopes_project 
    ON public.attendance_offline_lease_scopes (project_id);

COMMENT ON TABLE public.attendance_offline_lease_scopes IS 'Binds offline authorization leases to exact project geofence policy versions and offline bypass rules.';

-- ------------------------------------------------------------------------------
-- 5. ATTENDANCE SHIFTS (Server-Authoritative Business & Payroll Aggregate)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_shifts (
    shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    personnel_id TEXT NOT NULL REFERENCES public.mx_personnel(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    subsidiary TEXT NOT NULL,
    work_type TEXT NOT NULL,
    first_clock_in_at TIMESTAMPTZ NOT NULL,
    final_clock_out_at TIMESTAMPTZ NULL,
    physical_duration_minutes INTEGER NULL,
    payable_hours NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    overtime_hours NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL,
    close_method TEXT NULL,
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_status TEXT NOT NULL DEFAULT 'NONE',
    review_notes TEXT NULL,
    reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_shifts_work_type CHECK (work_type IN ('ON_SITE', 'HOME_OFFICE')),
    CONSTRAINT chk_shifts_status CHECK (
        status IN (
            'OPEN', 
            'COMPLETED', 
            'COMPLETED_FORGOTTEN_8H', 
            'ZOMBIE_PENDING_RECONCILIATION', 
            'REQUIRES_REVIEW', 
            'COMPETING_SHIFT_CONFLICT'
        )
    ),
    CONSTRAINT chk_shifts_close_method CHECK (
        close_method IS NULL OR 
        close_method IN (
            'NORMAL_CLOCK_OUT', 
            'FORGOTTEN_CLOCKOUT_8H', 
            'ZOMBIE_AUTO_CLOSE_8H', 
            'MANUAL_SUPERVISOR_ADJUSTMENT', 
            'SYSTEM_RECONCILED'
        )
    ),
    CONSTRAINT chk_shifts_review_status CHECK (review_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_shift_clock_times CHECK (final_clock_out_at IS NULL OR final_clock_out_at >= first_clock_in_at),
    CONSTRAINT chk_shift_duration_positive CHECK (physical_duration_minutes IS NULL OR physical_duration_minutes >= 0),
    CONSTRAINT chk_shift_payable_positive CHECK (payable_hours >= 0.00),
    CONSTRAINT chk_shift_overtime_positive CHECK (overtime_hours >= 0.00),
    CONSTRAINT chk_shift_open_state CHECK ((status = 'OPEN' AND final_clock_out_at IS NULL) OR (status <> 'OPEN'))
);

-- Concurrency protection: exactly ONE open shift per personnel and per auth_user simultaneously.
-- Sequential split shifts on the same day are fully supported once the prior shift status != 'OPEN'.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_shifts_open_personnel 
    ON public.attendance_shifts (personnel_id) 
    WHERE (status = 'OPEN');

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_shifts_open_auth_user 
    ON public.attendance_shifts (auth_user_id) 
    WHERE (status = 'OPEN');

CREATE INDEX IF NOT EXISTS idx_attendance_shifts_personnel_date 
    ON public.attendance_shifts (personnel_id, first_clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_shifts_project_date 
    ON public.attendance_shifts (project_id, first_clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_shifts_review 
    ON public.attendance_shifts (requires_review, review_status) 
    WHERE requires_review = TRUE;

CREATE INDEX IF NOT EXISTS idx_attendance_shifts_subsidiary 
    ON public.attendance_shifts (subsidiary);

COMMENT ON TABLE public.attendance_shifts IS 'Server-authoritative aggregate shift entity calculating physical duration and business payable/overtime hours.';

-- ------------------------------------------------------------------------------
-- 6. ATTENDANCE EVENTS (Immutable Physical Event Ledger - 29 Evidence Fields + Server State)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_events (
    -- Primary & Aggregate Relations
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES public.attendance_shifts(shift_id) ON DELETE RESTRICT,
    personnel_id TEXT NOT NULL REFERENCES public.mx_personnel(id) ON DELETE RESTRICT,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    
    -- Event Categorization
    event_type TEXT NOT NULL,
    work_type TEXT NOT NULL,
    
    -- Absolute Timestamping & Wall-Clock Context
    device_event_timestamp TIMESTAMPTZ NOT NULL,
    timezone_offset_minutes SMALLINT NOT NULL,
    
    -- Client Device & Application Provenance
    device_id TEXT NOT NULL,
    device_platform TEXT NOT NULL,
    client_app_version TEXT NOT NULL,
    client_release_id INTEGER NOT NULL,
    client_commit_hash TEXT NOT NULL,
    attendance_protocol_version INTEGER NOT NULL,
    
    -- Offline Context & Lease Binding
    created_offline BOOLEAN NOT NULL DEFAULT FALSE,
    offline_lease_id UUID NULL REFERENCES public.attendance_offline_leases(lease_id) ON DELETE RESTRICT,
    
    -- Geolocation Evidence & Evaluation
    latitude NUMERIC(10,7) NULL,
    longitude NUMERIC(10,7) NULL,
    accuracy_meters NUMERIC(8,2) NULL,
    gps_verified BOOLEAN NOT NULL,
    geofence_status TEXT NOT NULL,
    geofence_distance_meters NUMERIC(10,2) NULL,
    geofence_version_id UUID NULL REFERENCES public.project_geofence_versions(version_id) ON DELETE RESTRICT,
    
    -- Biometric Facial Verification Evidence
    face_verified BOOLEAN NOT NULL,
    face_bypass_reason TEXT NULL,
    
    -- Exception & Adjustment Evidence
    is_manual_adjustment BOOLEAN NOT NULL DEFAULT FALSE,
    adjustment_reason TEXT NULL,
    reported_departure_timestamp TIMESTAMPTZ NULL,
    worker_explanation TEXT NULL,
    
    -- Server-Authoritative Derived Evidence
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    canonical_hash TEXT NOT NULL,
    server_authorization_outcome TEXT NOT NULL DEFAULT 'AUTHORIZED',
    server_geofence_distance_meters NUMERIC(10,2) NULL,
    server_geofence_status TEXT NULL,
    server_rule_violations TEXT[] NULL,

    -- Constraints
    CONSTRAINT uq_shift_event_type UNIQUE (shift_id, event_type),
    CONSTRAINT chk_events_event_type CHECK (event_type IN ('CLOCK_IN', 'CLOCK_OUT')),
    CONSTRAINT chk_events_work_type CHECK (work_type IN ('ON_SITE', 'HOME_OFFICE')),
    CONSTRAINT chk_events_timezone_range CHECK (timezone_offset_minutes BETWEEN -840 AND 840),
    CONSTRAINT chk_events_geofence_status CHECK (
        geofence_status IN ('INSIDE', 'OUTSIDE', 'UNKNOWN', 'BYPASS_AUTHORIZED', 'NOT_APPLICABLE')
    ),
    CONSTRAINT chk_events_face_audit CHECK (
        (face_verified = TRUE AND face_bypass_reason IS NULL) OR 
        (face_verified = FALSE AND face_bypass_reason IS NOT NULL)
    ),
    CONSTRAINT chk_events_offline_lease CHECK (
        (created_offline = FALSE) OR 
        (created_offline = TRUE AND offline_lease_id IS NOT NULL)
    ),
    CONSTRAINT chk_events_forgotten_clockout CHECK (
        adjustment_reason <> 'FORGOTTEN_CLOCKOUT' OR (
            is_manual_adjustment = TRUE AND 
            event_type = 'CLOCK_OUT' AND 
            gps_verified = FALSE AND
            reported_departure_timestamp IS NOT NULL AND
            worker_explanation IS NOT NULL AND
            btrim(worker_explanation) <> ''
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_attendance_events_shift 
    ON public.attendance_events (shift_id);

CREATE INDEX IF NOT EXISTS idx_attendance_events_personnel_time 
    ON public.attendance_events (personnel_id, device_event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_events_auth_user 
    ON public.attendance_events (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_events_project 
    ON public.attendance_events (project_id);

CREATE INDEX IF NOT EXISTS idx_attendance_events_canonical_hash 
    ON public.attendance_events (canonical_hash);

CREATE INDEX IF NOT EXISTS idx_attendance_events_lease 
    ON public.attendance_events (offline_lease_id) 
    WHERE offline_lease_id IS NOT NULL;

COMMENT ON TABLE public.attendance_events IS 'Immutable ledger of physical clock-in/out events containing 29 client-evidence fields and server-derived verification state.';

-- ------------------------------------------------------------------------------
-- 7. ATTENDANCE EVENT MEDIA (Selfie, Biometric Snapshots & Signatures)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_event_media (
    media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.attendance_events(event_id) ON DELETE RESTRICT,
    media_type TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'attendance-media',
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_hash TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_media_type UNIQUE (event_id, media_type),
    CONSTRAINT chk_media_type CHECK (media_type IN ('SELFIE', 'SUPERVISOR_SIGNATURE', 'ATTACHMENT')),
    CONSTRAINT chk_media_mime CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT chk_media_size CHECK (file_size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_attendance_event_media_event 
    ON public.attendance_event_media (event_id);

CREATE INDEX IF NOT EXISTS idx_attendance_event_media_hash 
    ON public.attendance_event_media (sha256_hash);

COMMENT ON TABLE public.attendance_event_media IS 'Externalized binary media references (selfies, signatures) associated with attendance events.';

-- ------------------------------------------------------------------------------
-- 8. ATTENDANCE ADJUSTMENTS (Append-Only Managerial & System Decisions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_adjustments (
    adjustment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES public.attendance_shifts(shift_id) ON DELETE RESTRICT,
    event_id UUID NULL REFERENCES public.attendance_events(event_id) ON DELETE RESTRICT,
    adjustment_type TEXT NOT NULL,
    previous_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_adjustments_type CHECK (
        adjustment_type IN (
            'FORGOTTEN_CLOCKOUT_REVIEW',
            'ZOMBIE_RECONCILIATION',
            'PAYABLE_HOURS_OVERRIDE',
            'AUTHORIZED_CORRECTION',
            'LOCATION_EXCEPTION_REVIEW',
            'FACE_BYPASS_REVIEW',
            'SPLIT_SHIFT_MERGE',
            'OTHER'
        )
    ),
    CONSTRAINT chk_adjustments_actor_type CHECK (
        actor_type IN ('WORKER', 'SUPERVISOR', 'MANAGER', 'HR', 'ADMIN', 'SYSTEM')
    ),
    CONSTRAINT chk_adjustments_actor CHECK (
        (actor_type = 'SYSTEM' AND actor_user_id IS NULL) OR 
        (actor_type <> 'SYSTEM' AND actor_user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_shift 
    ON public.attendance_adjustments (shift_id);

CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_actor 
    ON public.attendance_adjustments (actor_type, actor_user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_created 
    ON public.attendance_adjustments (created_at DESC);

COMMENT ON TABLE public.attendance_adjustments IS 'Append-only audit trail of managerial reviews, hours adjustments, and system reconciliations.';

-- ------------------------------------------------------------------------------
-- 9. ATTENDANCE AUDIT LOG (Administrative & Automated Action Log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_audit_target_type CHECK (
        target_type IN ('SHIFT', 'EVENT', 'ADJUSTMENT', 'LEASE', 'CONTROL', 'GEOFENCE')
    ),
    CONSTRAINT chk_audit_action CHECK (
        action IN (
            'ADJUSTMENT_CREATED',
            'RECONCILIATION_APPROVED',
            'SHIFT_ADMIN_CORRECTED',
            'OFFLINE_LEASE_ISSUED',
            'OFFLINE_LEASE_REVOKED',
            'SYSTEM_ZOMBIE_CLOSE',
            'EMERGENCY_ATTENDANCE_ACTION',
            'CONTROL_FLAG_CHANGED',
            'GEOFENCE_VERSION_PUBLISHED'
        )
    ),
    CONSTRAINT chk_audit_actor_type CHECK (
        actor_type IN ('WORKER', 'SUPERVISOR', 'MANAGER', 'HR', 'ADMIN', 'SYSTEM')
    ),
    CONSTRAINT chk_audit_log_actor CHECK (
        (actor_type = 'SYSTEM' AND actor_user_id IS NULL) OR 
        (actor_type <> 'SYSTEM' AND actor_user_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_target 
    ON public.attendance_audit_log (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_actor 
    ON public.attendance_audit_log (actor_type, actor_user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_created 
    ON public.attendance_audit_log (created_at DESC);

COMMENT ON TABLE public.attendance_audit_log IS 'General security, administrative, and compliance audit trail for all Attendance V2 mutations.';

-- ------------------------------------------------------------------------------
-- 10. DATABASE-LEVEL LEDGER IMMUTABILITY TRIGGERS (PASS 13E FIRST GATE)
-- ------------------------------------------------------------------------------
-- Immutable physical event ledger
CREATE OR REPLACE FUNCTION public.prevent_attendance_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'ATTENDANCE_EVENT_IMMUTABLE: Updates to existing attendance_events rows are strictly prohibited.'
            USING ERRCODE = '23514';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'ATTENDANCE_EVENT_IMMUTABLE: Deletions from attendance_events are strictly prohibited.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_events_immutable ON public.attendance_events;
CREATE TRIGGER trg_attendance_events_immutable
BEFORE UPDATE OR DELETE ON public.attendance_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_attendance_event_mutation();

-- Immutable adjustments ledger
CREATE OR REPLACE FUNCTION public.prevent_attendance_adjustment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'ATTENDANCE_ADJUSTMENT_IMMUTABLE: Updates to existing attendance_adjustments rows are strictly prohibited.'
            USING ERRCODE = '23514';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'ATTENDANCE_ADJUSTMENT_IMMUTABLE: Deletions from attendance_adjustments are strictly prohibited.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_adjustments_immutable ON public.attendance_adjustments;
CREATE TRIGGER trg_attendance_adjustments_immutable
BEFORE UPDATE OR DELETE ON public.attendance_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_attendance_adjustment_mutation();

-- Immutable audit log ledger
CREATE OR REPLACE FUNCTION public.prevent_attendance_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'ATTENDANCE_AUDIT_IMMUTABLE: Updates to existing attendance_audit_log rows are strictly prohibited.'
            USING ERRCODE = '23514';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'ATTENDANCE_AUDIT_IMMUTABLE: Deletions from attendance_audit_log are strictly prohibited.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_audit_immutable ON public.attendance_audit_log;
CREATE TRIGGER trg_attendance_audit_immutable
BEFORE UPDATE OR DELETE ON public.attendance_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.prevent_attendance_audit_mutation();

