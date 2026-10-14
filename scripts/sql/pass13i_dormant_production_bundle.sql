-- ==============================================================================
-- PASS 13I: ATTENDANCE V2 COMPLETE DORMANT PRODUCTION DEPLOYMENT BUNDLE
-- ==============================================================================
-- TARGET PROJECT: LATNOVVA ServiceTool
-- SUPABASE PROJECT: dvkkxwtqonjgrvloisid
-- BASELINE: PASS 12N / Release ID 48 / Commit 64bb2510 / feature/mexico-subsidiary
-- STATUS: PREPARATION ONLY — NOT EXECUTED ON PRODUCTION
--
-- ARCHITECTURAL CONTRACT:
-- 1. CLEAN FORWARD-ONLY ATTENDANCE V2 SCHEMA (9 Dedicated Tables).
-- 2. IMMUTABLE LEDGER TRIGGERS (attendance_events, adjustments, audit_log, geofences).
-- 3. SERVER-AUTHORITATIVE ENGINE & RPCs (Advisory Locks, 29-field Canonical Hash).
-- 4. STRICT ZERO-MUTATION FAIL-CLOSED STATE:
--    - system_state: 'LEGACY_ACTIVE'
--    - minimum_v2_client_release_id: NULL (Pinning Pending)
--    - Legacy PASS 12N writes (mx_timesheets, mx_timesheet_punches) remain untouched.
-- 5. ROW-LEVEL SECURITY & DIRECT WRITE TABLE LOCKDOWN:
--    - authenticated / anon roles cannot INSERT, UPDATE, or DELETE directly.
-- ==============================================================================

BEGIN;

-- Verify prerequisite base tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        RAISE EXCEPTION 'Prerequisite table public.profiles is missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mx_personnel') THEN
        RAISE EXCEPTION 'Prerequisite table public.mx_personnel is missing';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
        RAISE EXCEPTION 'Prerequisite table public.projects is missing';
    END IF;
END $$;


-- >>> SECTION 1: SCHEMA & LEDGER IMMUTABILITY (PASS 13D-R) <<<
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



-- ------------------------------------------------------------------------------
-- INITIALIZE ATTENDANCE V2 CONTROL SINGLETON IN FAIL-CLOSED DORMANT STATE
-- ------------------------------------------------------------------------------
INSERT INTO public.attendance_v2_control (
    control_id,
    system_state,
    protocol_version,
    minimum_v2_client_release_id,
    minimum_v2_client_version,
    active_subsidiaries,
    max_offline_lease_duration_hours,
    zombie_shift_threshold_hours,
    standard_shift_hours,
    face_id_match_threshold,
    face_detection_timeout_seconds,
    state_changed_at
) VALUES (
    1,
    'LEGACY_ACTIVE',
    2,
    NULL,
    NULL,
    ARRAY['MX'],
    72,
    14.00,
    8.00,
    0.550,
    15,
    now()
) ON CONFLICT (control_id) DO NOTHING;

-- >>> SECTION 2: SERVER ENGINE, IDEMPOTENCY & RLS (PASS 13E) <<<
-- ==============================================================================
-- PASS 13E: ATTENDANCE V2 SERVER ENGINE, IDEMPOTENCY, RLS & SECURITY
-- ==============================================================================
-- TARGET ARCHITECTURE: Attendance V2 Server Engine & Authorization Subsystem
-- BASELINE: PASS 13D-R Verified (110 assertions passed in disposable environment)
-- NOTE: THIS SCRIPT MUTATES ONLY THE DISPOSABLE TEST ENVIRONMENT.
--       PRODUCTION PASS 12N REMAINS 100% UNTOUCHED AND UNMODIFIED.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 0. ENVIRONMENT BOOTSTRAP (ROLES, AUTH STUBS, BASE COLUMNS)
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN 
        CREATE ROLE anon; 
    END IF; 
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN 
        CREATE ROLE authenticated; 
    END IF; 
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;

ALTER TABLE IF EXISTS public.mx_personnel ADD COLUMN IF NOT EXISTS supervisor_id TEXT NULL;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS client_id UUID NULL;
ALTER TABLE IF EXISTS public.projects ADD COLUMN IF NOT EXISTS client_id UUID NULL;

GRANT SELECT ON public.profiles, public.mx_personnel, public.projects TO authenticated;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

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
        RETURN NULL;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 1. GEOMETRY / HAVERSINE DISTANCE HELPER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_geofence_distance_meters(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    r CONSTANT DOUBLE PRECISION := 6371000.0; -- Earth radius in meters
    phi1 DOUBLE PRECISION;
    phi2 DOUBLE PRECISION;
    delta_phi DOUBLE PRECISION;
    delta_lambda DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;
    phi1 := radians(lat1);
    phi2 := radians(lat2);
    delta_phi := radians(lat2 - lat1);
    delta_lambda := radians(lon2 - lon1);

    a := sin(delta_phi / 2.0)^2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2.0)^2;
    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

    RETURN round((r * c)::numeric, 2);
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. DETERMINISTIC 29-FIELD CANONICAL HASH GENERATOR
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_canonical_event_hash(p_event jsonb)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_canonical jsonb;
    v_canonical_text text;
BEGIN
    -- Construct server-side typed canonical jsonb object with 29 client-evidence fields
    -- Enforces strict typing, case normalization for enums/hex/uuids, and consistent formatting
    v_canonical := jsonb_build_object(
        'accuracy_meters', CASE WHEN p_event->'accuracy_meters' IS NULL OR p_event->>'accuracy_meters' IS NULL THEN jsonb 'null' ELSE to_jsonb(round((p_event->>'accuracy_meters')::numeric, 2)) END,
        'adjustment_reason', CASE WHEN p_event->'adjustment_reason' IS NULL OR p_event->>'adjustment_reason' IS NULL THEN jsonb 'null' ELSE to_jsonb(p_event->>'adjustment_reason') END,
        'attendance_protocol_version', to_jsonb((p_event->>'attendance_protocol_version')::int),
        'client_app_version', to_jsonb(p_event->>'client_app_version'),
        'client_commit_hash', to_jsonb(lower(p_event->>'client_commit_hash')),
        'client_release_id', to_jsonb((p_event->>'client_release_id')::int),
        'created_offline', to_jsonb(coalesce((p_event->>'created_offline')::boolean, false)),
        'device_event_timestamp', to_jsonb(to_char((p_event->>'device_event_timestamp')::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
        'device_id', to_jsonb(p_event->>'device_id'),
        'device_platform', to_jsonb(p_event->>'device_platform'),
        'event_id', to_jsonb(lower((p_event->>'event_id')::uuid::text)),
        'event_type', to_jsonb(upper(p_event->>'event_type')),
        'face_bypass_reason', CASE WHEN p_event->'face_bypass_reason' IS NULL OR p_event->>'face_bypass_reason' IS NULL THEN jsonb 'null' ELSE to_jsonb(p_event->>'face_bypass_reason') END,
        'face_verified', to_jsonb((p_event->>'face_verified')::boolean),
        'geofence_distance_meters', CASE WHEN p_event->'geofence_distance_meters' IS NULL OR p_event->>'geofence_distance_meters' IS NULL THEN jsonb 'null' ELSE to_jsonb(round((p_event->>'geofence_distance_meters')::numeric, 2)) END,
        'geofence_status', to_jsonb(upper(p_event->>'geofence_status')),
        'geofence_version_id', CASE WHEN p_event->'geofence_version_id' IS NULL OR p_event->>'geofence_version_id' IS NULL THEN jsonb 'null' ELSE to_jsonb(lower((p_event->>'geofence_version_id')::uuid::text)) END,
        'gps_verified', to_jsonb((p_event->>'gps_verified')::boolean),
        'is_manual_adjustment', to_jsonb(coalesce((p_event->>'is_manual_adjustment')::boolean, false)),
        'latitude', CASE WHEN p_event->'latitude' IS NULL OR p_event->>'latitude' IS NULL THEN jsonb 'null' ELSE to_jsonb(round((p_event->>'latitude')::numeric, 7)) END,
        'longitude', CASE WHEN p_event->'longitude' IS NULL OR p_event->>'longitude' IS NULL THEN jsonb 'null' ELSE to_jsonb(round((p_event->>'longitude')::numeric, 7)) END,
        'offline_lease_id', CASE WHEN p_event->'offline_lease_id' IS NULL OR p_event->>'offline_lease_id' IS NULL THEN jsonb 'null' ELSE to_jsonb(lower((p_event->>'offline_lease_id')::uuid::text)) END,
        'personnel_id', to_jsonb(p_event->>'personnel_id'),
        'project_id', to_jsonb(lower((p_event->>'project_id')::uuid::text)),
        'reported_departure_timestamp', CASE WHEN p_event->'reported_departure_timestamp' IS NULL OR p_event->>'reported_departure_timestamp' IS NULL THEN jsonb 'null' ELSE to_jsonb(to_char((p_event->>'reported_departure_timestamp')::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) END,
        'shift_id', to_jsonb(lower((p_event->>'shift_id')::uuid::text)),
        'timezone_offset_minutes', to_jsonb((p_event->>'timezone_offset_minutes')::smallint),
        'work_type', to_jsonb(upper(p_event->>'work_type')),
        'worker_explanation', CASE WHEN p_event->'worker_explanation' IS NULL OR p_event->>'worker_explanation' IS NULL THEN jsonb 'null' ELSE to_jsonb(p_event->>'worker_explanation') END
    );

    v_canonical_text := v_canonical::text;
    RETURN encode(digest(convert_to(v_canonical_text, 'UTF8'), 'sha256'), 'hex');
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. CENTRALIZED AUTHORIZATION HELPERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_attendance_personnel_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.get_authoritative_personnel_id();
$$;

CREATE OR REPLACE FUNCTION public.current_attendance_profile()
RETURNS TABLE (
    user_id UUID,
    role TEXT,
    subsidiary TEXT,
    client_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT id, role, subsidiary, client_id
    FROM public.profiles
    WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_read_attendance_shift(
    p_shift_personnel_id TEXT,
    p_shift_project_id UUID,
    p_shift_subsidiary TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_personnel_id TEXT;
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_caller_client_id UUID;
    v_is_supervisor_of BOOLEAN := FALSE;
    v_is_assigned_project BOOLEAN := FALSE;
BEGIN
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Worker / Tech: Own attendance only
    v_caller_personnel_id := public.get_authoritative_personnel_id();
    IF v_caller_personnel_id IS NOT NULL AND v_caller_personnel_id = p_shift_personnel_id THEN
        RETURN TRUE;
    END IF;

    SELECT role, subsidiary, client_id 
    INTO v_caller_role, v_caller_subsidiary, v_caller_client_id
    FROM public.profiles
    WHERE id = v_uid;

    IF v_caller_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Fail-closed cross-subsidiary boundary
    IF v_caller_role <> 'Customer' AND v_caller_subsidiary <> p_shift_subsidiary THEN
        RETURN FALSE;
    END IF;

    -- Manager / HR: Full visibility within their own subsidiary
    IF v_caller_role IN ('Manager', 'HR') THEN
        RETURN TRUE;
    END IF;

    -- Supervisor: Own + Direct Reports + Assigned Site Leads within subsidiary
    IF v_caller_role = 'Supervisor' THEN
        -- Check direct report
        SELECT EXISTS (
            SELECT 1 FROM public.mx_personnel 
            WHERE id = p_shift_personnel_id AND supervisor_id = v_caller_personnel_id
        ) INTO v_is_supervisor_of;

        IF v_is_supervisor_of THEN
            RETURN TRUE;
        END IF;

        -- Check site lead / project assignment
        SELECT EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_shift_project_id 
              AND (
                  (v_uid)::text = ANY(assigned_personnel) OR 
                  (v_caller_personnel_id) = ANY(assigned_personnel) OR
                  (v_uid)::text = ANY(site_lead_ids) OR 
                  (v_caller_personnel_id) = ANY(site_lead_ids)
              )
        ) INTO v_is_assigned_project;

        IF v_is_assigned_project THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Office: Own + Assigned projects within subsidiary
    IF v_caller_role = 'Office' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_shift_project_id 
              AND (
                  (v_uid)::text = ANY(assigned_personnel) OR 
                  (v_caller_personnel_id) = ANY(assigned_personnel)
              )
        ) INTO v_is_assigned_project;

        IF v_is_assigned_project THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- Customer: Assigned client projects only
    IF v_caller_role = 'Customer' AND v_caller_client_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = p_shift_project_id AND client_id = v_caller_client_id
        );
    END IF;

    RETURN FALSE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. DIRECT TABLE WRITE LOCKDOWN & ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------
-- Revoke direct mutation privileges from public, authenticated, and anon
REVOKE INSERT, UPDATE, DELETE ON public.attendance_shifts FROM PUBLIC, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_events FROM PUBLIC, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_adjustments FROM PUBLIC, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_audit_log FROM PUBLIC, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_offline_leases FROM PUBLIC, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_offline_lease_scopes FROM PUBLIC, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.project_geofence_versions FROM PUBLIC, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_v2_control FROM PUBLIC, authenticated, anon;

-- Enable RLS on all V2 tables
ALTER TABLE public.attendance_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_offline_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_offline_lease_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_geofence_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_control ENABLE ROW LEVEL SECURITY;

-- Grants for SELECT only to authenticated users
GRANT SELECT ON public.attendance_shifts TO authenticated;
GRANT SELECT ON public.attendance_events TO authenticated;
GRANT SELECT ON public.attendance_adjustments TO authenticated;
GRANT SELECT ON public.attendance_audit_log TO authenticated;
GRANT SELECT ON public.attendance_offline_leases TO authenticated;
GRANT SELECT ON public.attendance_offline_lease_scopes TO authenticated;
GRANT SELECT ON public.project_geofence_versions TO authenticated;
GRANT SELECT ON public.attendance_v2_control TO authenticated;

-- RLS SELECT Policies for attendance_shifts
DROP POLICY IF EXISTS p_select_attendance_shifts ON public.attendance_shifts;
CREATE POLICY p_select_attendance_shifts ON public.attendance_shifts
    FOR SELECT TO authenticated
    USING (public.can_read_attendance_shift(personnel_id, project_id, subsidiary));

-- RLS SELECT Policies for attendance_events
DROP POLICY IF EXISTS p_select_attendance_events ON public.attendance_events;
CREATE POLICY p_select_attendance_events ON public.attendance_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.attendance_shifts s
            WHERE s.shift_id = public.attendance_events.shift_id
              AND public.can_read_attendance_shift(s.personnel_id, s.project_id, s.subsidiary)
        )
    );

-- RLS SELECT Policies for attendance_adjustments
DROP POLICY IF EXISTS p_select_attendance_adjustments ON public.attendance_adjustments;
CREATE POLICY p_select_attendance_adjustments ON public.attendance_adjustments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.attendance_shifts s
            WHERE s.shift_id = public.attendance_adjustments.shift_id
              AND public.can_read_attendance_shift(s.personnel_id, s.project_id, s.subsidiary)
        )
    );

-- RLS SELECT Policies for attendance_audit_log
DROP POLICY IF EXISTS p_select_attendance_audit_log ON public.attendance_audit_log;
CREATE POLICY p_select_attendance_audit_log ON public.attendance_audit_log
    FOR SELECT TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Manager', 'HR')
    );

-- RLS SELECT Policies for attendance_offline_leases
DROP POLICY IF EXISTS p_select_attendance_offline_leases ON public.attendance_offline_leases;
CREATE POLICY p_select_attendance_offline_leases ON public.attendance_offline_leases
    FOR SELECT TO authenticated
    USING (
        auth_user_id = auth.uid() OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Manager', 'HR', 'Supervisor')
    );

-- RLS SELECT Policies for attendance_offline_lease_scopes
DROP POLICY IF EXISTS p_select_attendance_offline_lease_scopes ON public.attendance_offline_lease_scopes;
CREATE POLICY p_select_attendance_offline_lease_scopes ON public.attendance_offline_lease_scopes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.attendance_offline_leases l
            WHERE l.lease_id = public.attendance_offline_lease_scopes.lease_id
              AND (
                  l.auth_user_id = auth.uid() OR 
                  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Manager', 'HR', 'Supervisor')
              )
        )
    );

-- RLS SELECT Policies for project_geofence_versions
DROP POLICY IF EXISTS p_select_project_geofence_versions ON public.project_geofence_versions;
CREATE POLICY p_select_project_geofence_versions ON public.project_geofence_versions
    FOR SELECT TO authenticated
    USING (TRUE); -- Geofence reference policy readable by authenticated users

-- RLS SELECT Policies for attendance_v2_control
DROP POLICY IF EXISTS p_select_attendance_v2_control ON public.attendance_v2_control;
CREATE POLICY p_select_attendance_v2_control ON public.attendance_v2_control
    FOR SELECT TO authenticated
    USING (TRUE); -- Control state readable by authenticated users

-- ------------------------------------------------------------------------------
-- 5. OFFLINE LEASE ISSUANCE RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_attendance_offline_lease(
    p_device_id TEXT,
    p_duration_hours INT DEFAULT 72,
    p_client_release_id INT DEFAULT 48,
    p_client_app_version TEXT DEFAULT 'v5.0.8'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_personnel_id TEXT;
    v_subsidiary TEXT;
    v_lease_id UUID;
    v_valid_from TIMESTAMPTZ := now();
    v_valid_until TIMESTAMPTZ;
    v_max_duration INT := 72;
    v_protocol_version INT := 2;
    v_system_state TEXT;
    v_project RECORD;
    v_geofence RECORD;
    v_scopes JSONB := '[]'::jsonb;
    v_assigned_count INT := 0;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    -- Validate control state
    SELECT system_state, max_offline_lease_duration_hours, protocol_version
    INTO v_system_state, v_max_duration, v_protocol_version
    FROM public.attendance_v2_control WHERE control_id = 1;

    IF v_system_state IS NULL OR v_system_state = 'LEGACY_ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'V2_DISABLED', 'reason', 'LEGACY_ACTIVE');
    END IF;

    -- Resolve authoritative personnel ID
    v_personnel_id := public.get_authoritative_personnel_id();
    IF v_personnel_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'IDENTITY_RESOLUTION_FAILED');
    END IF;

    -- Derive subsidiary
    SELECT subsidiary INTO v_subsidiary FROM public.mx_personnel WHERE id = v_personnel_id;
    IF v_subsidiary IS NULL THEN
        SELECT subsidiary INTO v_subsidiary FROM public.profiles WHERE id = v_uid;
    END IF;
    IF v_subsidiary IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SUBSIDIARY_UNRESOLVED');
    END IF;

    -- Bound duration
    IF p_duration_hours IS NULL OR p_duration_hours <= 0 OR p_duration_hours > v_max_duration THEN
        p_duration_hours := v_max_duration;
    END IF;
    v_valid_until := v_valid_from + (p_duration_hours || ' hours')::interval;

    v_lease_id := gen_random_uuid();

    -- Insert lease header
    INSERT INTO public.attendance_offline_leases (
        lease_id, auth_user_id, personnel_id, valid_from, valid_until,
        attendance_protocol_version, client_release_id, client_app_version, device_id,
        is_revoked, issued_at
    ) VALUES (
        v_lease_id, v_uid, v_personnel_id, v_valid_from, v_valid_until,
        v_protocol_version, p_client_release_id, p_client_app_version, p_device_id,
        FALSE, v_valid_from
    );

    -- Find all projects assigned to this personnel
    FOR v_project IN 
        SELECT id, name FROM public.projects 
        WHERE (v_uid)::text = ANY(assigned_personnel) OR v_personnel_id = ANY(assigned_personnel)
    LOOP
        -- Find latest active geofence version
        SELECT * INTO v_geofence 
        FROM public.project_geofence_versions 
        WHERE project_id = v_project.id 
        ORDER BY effective_from DESC LIMIT 1;

        IF v_geofence.version_id IS NOT NULL THEN
            INSERT INTO public.attendance_offline_lease_scopes (
                scope_id, lease_id, project_id, geofence_version_id,
                warehouse_bypass_allowed, home_office_allowed
            ) VALUES (
                gen_random_uuid(), v_lease_id, v_project.id, v_geofence.version_id,
                v_geofence.warehouse_bypass_allowed, v_geofence.home_office_allowed
            );

            v_scopes := v_scopes || jsonb_build_object(
                'project_id', v_project.id,
                'project_name', v_project.name,
                'geofence_version_id', v_geofence.version_id,
                'latitude', v_geofence.latitude,
                'longitude', v_geofence.longitude,
                'radius_meters', v_geofence.radius_meters,
                'accuracy_threshold_meters', v_geofence.accuracy_threshold_meters,
                'warehouse_bypass_allowed', v_geofence.warehouse_bypass_allowed,
                'home_office_allowed', v_geofence.home_office_allowed
            );
            v_assigned_count := v_assigned_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'lease_id', v_lease_id,
        'auth_user_id', v_uid,
        'personnel_id', v_personnel_id,
        'subsidiary', v_subsidiary,
        'valid_from', v_valid_from,
        'valid_until', v_valid_until,
        'attendance_protocol_version', v_protocol_version,
        'assigned_scopes_count', v_assigned_count,
        'scopes', v_scopes
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_attendance_offline_lease(TEXT, INT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_attendance_offline_lease(TEXT, INT, INT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. RECORD ATTENDANCE EVENT RPC (TRANSACTIONAL CLOCK-IN & CLOCK-OUT ENGINE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance_event(p_event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_personnel_id TEXT;
    v_subsidiary TEXT;
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
    
    v_system_state TEXT;
    v_min_release_id INT;
    v_approved_protocol INT;
    v_canonical_hash TEXT;
    v_existing_event RECORD;
    v_active_shift RECORD;
    v_active_geofence RECORD;
    v_server_distance NUMERIC;
    v_server_geofence_status TEXT;
    v_duration_minutes INT;
    v_payable_hours NUMERIC(5,2);
    v_overtime_hours NUMERIC(5,2);
    v_close_method TEXT;
    v_requires_review BOOLEAN := FALSE;
    v_review_status TEXT := 'NONE';
    v_lease RECORD;
    v_scope RECORD;
BEGIN
    -- 1. Identity Gate
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'NOT_AUTHENTICATED');
    END IF;

    v_personnel_id := public.get_authoritative_personnel_id();
    IF v_personnel_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'IDENTITY_RESOLUTION_FAILED');
    END IF;

    -- Validate client claim if supplied
    IF p_event->>'personnel_id' IS NOT NULL AND p_event->>'personnel_id' <> v_personnel_id THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'IDENTITY_MISMATCH');
    END IF;

    -- Derive subsidiary
    SELECT subsidiary INTO v_subsidiary FROM public.mx_personnel WHERE id = v_personnel_id;
    IF v_subsidiary IS NULL THEN
        SELECT subsidiary INTO v_subsidiary FROM public.profiles WHERE id = v_uid;
    END IF;
    IF v_subsidiary IS NULL THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'SUBSIDIARY_UNRESOLVED');
    END IF;

    -- 2. Control State Gate
    SELECT system_state, minimum_v2_client_release_id, protocol_version
    INTO v_system_state, v_min_release_id, v_approved_protocol
    FROM public.attendance_v2_control WHERE control_id = 1;

    IF v_system_state IS NULL OR v_system_state = 'LEGACY_ACTIVE' THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'V2_DISABLED', 'reason', 'LEGACY_ACTIVE');
    ELSIF v_system_state = 'V2_DORMANT' THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'V2_DORMANT', 'reason', 'V2_DORMANT');
    ELSIF v_system_state = 'V2_DEGRADED' THEN
        -- Allow emergency/server flows only
        IF coalesce(p_event->>'is_emergency_flow', 'false')::boolean = FALSE THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'V2_DEGRADED', 'reason', 'V2_DEGRADED');
        END IF;
    END IF;

    -- Protocol & Pinned Release Check
    v_client_release_id := (p_event->>'client_release_id')::int;
    v_protocol_version := (p_event->>'attendance_protocol_version')::int;

    IF v_min_release_id IS NULL OR v_client_release_id IS NULL OR v_client_release_id < v_min_release_id THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CLIENT_RELEASE_UNAUTHORIZED');
    END IF;

    IF v_protocol_version IS NULL OR v_protocol_version <> v_approved_protocol THEN
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'PROTOCOL_MISMATCH');
    END IF;

    -- Extract fields
    v_event_id := (p_event->>'event_id')::uuid;
    v_shift_id := (p_event->>'shift_id')::uuid;
    v_project_id := (p_event->>'project_id')::uuid;
    v_event_type := upper(p_event->>'event_type');
    v_work_type := upper(p_event->>'work_type');
    v_device_event_timestamp := (p_event->>'device_event_timestamp')::timestamptz;
    v_tz_offset := (p_event->>'timezone_offset_minutes')::smallint;
    v_device_id := p_event->>'device_id';
    v_device_platform := p_event->>'device_platform';
    v_client_app_version := p_event->>'client_app_version';
    v_client_commit_hash := lower(p_event->>'client_commit_hash');
    v_created_offline := coalesce((p_event->>'created_offline')::boolean, false);
    v_offline_lease_id := (p_event->>'offline_lease_id')::uuid;
    v_lat := (p_event->>'latitude')::numeric;
    v_lon := (p_event->>'longitude')::numeric;
    v_accuracy := (p_event->>'accuracy_meters')::numeric;
    v_gps_verified := coalesce((p_event->>'gps_verified')::boolean, false);
    v_geofence_status := upper(coalesce(p_event->>'geofence_status', 'UNKNOWN'));
    v_geofence_distance := (p_event->>'geofence_distance_meters')::numeric;
    v_geofence_version_id := (p_event->>'geofence_version_id')::uuid;
    v_face_verified := coalesce((p_event->>'face_verified')::boolean, false);
    v_face_bypass_reason := p_event->>'face_bypass_reason';
    v_is_manual_adjustment := coalesce((p_event->>'is_manual_adjustment')::boolean, false);
    v_adjustment_reason := p_event->>'adjustment_reason';
    v_reported_departure := (p_event->>'reported_departure_timestamp')::timestamptz;
    v_worker_explanation := p_event->>'worker_explanation';

    -- 3. Idempotency Check & Canonical Hash
    v_canonical_hash := public.compute_canonical_event_hash(p_event);

    SELECT * INTO v_existing_event FROM public.attendance_events WHERE event_id = v_event_id;
    IF v_existing_event.event_id IS NOT NULL THEN
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
                'status', 'IMMUTABLE_EVENT_PAYLOAD_MISMATCH',
                'error', 'Payload conflicts with previously applied event'
            );
        END IF;
    END IF;

    -- 4. Offline Lease Verification (if event created offline)
    IF v_created_offline THEN
        IF v_offline_lease_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_MISSING');
        END IF;

        SELECT * INTO v_lease FROM public.attendance_offline_leases WHERE lease_id = v_offline_lease_id;
        IF v_lease.lease_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_NOT_FOUND');
        END IF;

        -- Dual-Identity Binding
        IF v_lease.auth_user_id <> v_uid OR v_lease.personnel_id <> v_personnel_id THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_IDENTITY_MISMATCH');
        END IF;

        -- Validity & Revocation
        IF v_device_event_timestamp < v_lease.valid_from OR v_device_event_timestamp > v_lease.valid_until THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_EXPIRED');
        END IF;

        IF v_lease.is_revoked AND v_lease.revoked_at <= v_device_event_timestamp THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_REVOKED');
        END IF;

        -- Project Scope Binding
        SELECT * INTO v_scope FROM public.attendance_offline_lease_scopes 
        WHERE lease_id = v_offline_lease_id AND project_id = v_project_id;
        IF v_scope.scope_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_PROJECT_NOT_SCOPED');
        END IF;

        IF v_geofence_version_id IS NOT NULL AND v_geofence_version_id <> v_scope.geofence_version_id THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OFFLINE_LEASE_GEOFENCE_MISMATCH');
        END IF;
    END IF;

    -- 5. Clock-In vs Clock-Out Routing
    IF v_event_type = 'CLOCK_IN' THEN
        -- Concurrency serialization lock on authoritative worker
        PERFORM pg_advisory_xact_lock(hashtextextended(v_personnel_id, 0));

        -- Check if an active OPEN shift already exists
        SELECT * INTO v_active_shift 
        FROM public.attendance_shifts 
        WHERE personnel_id = v_personnel_id AND status = 'OPEN';

        IF v_active_shift.shift_id IS NOT NULL THEN
            -- If same shift_id, event is duplicate clock_in attempt
            IF v_active_shift.shift_id = v_shift_id THEN
                RETURN jsonb_build_object('success', false, 'status', 'CONFLICT', 'error', 'CLOCK_IN_ALREADY_EXISTS');
            ELSE
                -- Competing shift conflict: do not create second open shift
                RETURN jsonb_build_object('success', false, 'status', 'ACTIVE_SHIFT_CONFLICT', 'error', 'Worker already has an active OPEN shift');
            END IF;
        END IF;

        -- Geofence Validation for Online On-Site Clock-In
        IF v_work_type = 'ON_SITE' AND NOT v_created_offline THEN
            SELECT * INTO v_active_geofence 
            FROM public.project_geofence_versions 
            WHERE project_id = v_project_id 
            ORDER BY effective_from DESC LIMIT 1;

            IF v_active_geofence.version_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GEOFENCE_NOT_CONFIGURED');
            END IF;

            v_geofence_version_id := v_active_geofence.version_id;
            v_server_distance := public.calculate_geofence_distance_meters(
                v_lat::double precision, v_lon::double precision,
                v_active_geofence.latitude, v_active_geofence.longitude
            );

            IF v_lat IS NULL OR v_lon IS NULL OR NOT v_gps_verified THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_UNVERIFIED');
            END IF;

            IF v_accuracy IS NULL OR v_accuracy > v_active_geofence.accuracy_threshold_meters THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'GPS_ACCURACY_UNACCEPTABLE');
            END IF;

            IF v_server_distance > v_active_geofence.radius_meters THEN
                RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
            END IF;

            v_server_geofence_status := 'INSIDE';
        ELSE
            v_server_geofence_status := v_geofence_status;
            v_server_distance := v_geofence_distance;
        END IF;

        -- Create shift and event atomically
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
            geofence_distance_meters, geofence_version_id, face_verified, face_bypass_reason,
            is_manual_adjustment, adjustment_reason, reported_departure_timestamp, worker_explanation,
            auth_user_id, server_received_at, canonical_hash, server_authorization_outcome,
            server_geofence_distance_meters, server_geofence_status
        ) VALUES (
            v_event_id, v_shift_id, v_personnel_id, v_project_id,
            'CLOCK_IN', v_work_type, v_device_event_timestamp, v_tz_offset,
            v_device_id, v_device_platform, v_client_app_version, v_client_release_id, v_client_commit_hash,
            v_protocol_version, v_created_offline, v_offline_lease_id,
            v_lat, v_lon, v_accuracy, v_gps_verified, v_geofence_status,
            v_geofence_distance, v_geofence_version_id, v_face_verified, v_face_bypass_reason,
            v_is_manual_adjustment, v_adjustment_reason, v_reported_departure, v_worker_explanation,
            v_uid, now(), v_canonical_hash, 'AUTHORIZED',
            v_server_distance, v_server_geofence_status
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'APPLIED',
            'event_id', v_event_id,
            'shift_id', v_shift_id,
            'event_type', 'CLOCK_IN'
        );

    ELSIF v_event_type = 'CLOCK_OUT' THEN
        -- Advisory lock on target shift
        PERFORM pg_advisory_xact_lock(hashtextextended(v_shift_id::text, 0));

        -- Must target exact existing shift
        SELECT * INTO v_active_shift 
        FROM public.attendance_shifts 
        WHERE shift_id = v_shift_id;

        IF v_active_shift.shift_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'SHIFT_NOT_FOUND');
        END IF;

        IF v_active_shift.personnel_id <> v_personnel_id THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'SHIFT_OWNERSHIP_MISMATCH');
        END IF;

        -- Chronology check
        IF v_device_event_timestamp < v_active_shift.first_clock_in_at THEN
            RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'CLOCK_OUT_BEFORE_CLOCK_IN');
        END IF;

        -- Handle Forgotten ClockOut
        IF v_adjustment_reason = 'FORGOTTEN_CLOCKOUT' THEN
            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_reported_departure - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := 8.00;
            v_overtime_hours := 0.00;
            v_close_method := 'FORGOTTEN_CLOCKOUT_8H';
            v_requires_review := TRUE;
            v_review_status := 'PENDING';
            v_server_geofence_status := 'BYPASS_AUTHORIZED';
        ELSE
            -- Normal Clock-Out Geofence Check
            IF v_work_type = 'ON_SITE' AND NOT v_created_offline THEN
                SELECT * INTO v_active_geofence 
                FROM public.project_geofence_versions 
                WHERE project_id = v_project_id 
                ORDER BY effective_from DESC LIMIT 1;

                IF v_active_geofence.version_id IS NOT NULL THEN
                    v_server_distance := public.calculate_geofence_distance_meters(
                        v_lat::double precision, v_lon::double precision,
                        v_active_geofence.latitude, v_active_geofence.longitude
                    );

                    IF v_lat IS NULL OR v_lon IS NULL OR NOT v_gps_verified OR v_server_distance > v_active_geofence.radius_meters THEN
                        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'OUTSIDE_GEOFENCE');
                    END IF;
                    v_server_geofence_status := 'INSIDE';
                END IF;
            ELSE
                v_server_geofence_status := v_geofence_status;
                v_server_distance := v_geofence_distance;
            END IF;

            v_duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (v_device_event_timestamp - v_active_shift.first_clock_in_at)) / 60)::int;
            v_payable_hours := round((v_duration_minutes / 60.0)::numeric, 2);
            v_overtime_hours := GREATEST(0.00, v_payable_hours - 8.00);
            v_close_method := 'NORMAL_CLOCK_OUT';
        END IF;

        -- If shift was already zombie closed, preserve physical duration but keep 8/0 payroll until reconciliation
        IF v_active_shift.status = 'ZOMBIE_PENDING_RECONCILIATION' THEN
            UPDATE public.attendance_shifts
            SET final_clock_out_at = v_device_event_timestamp,
                physical_duration_minutes = v_duration_minutes,
                requires_review = TRUE,
                review_status = 'PENDING',
                updated_at = now()
            WHERE shift_id = v_shift_id;
        ELSE
            UPDATE public.attendance_shifts
            SET final_clock_out_at = v_device_event_timestamp,
                physical_duration_minutes = v_duration_minutes,
                payable_hours = v_payable_hours,
                overtime_hours = v_overtime_hours,
                status = CASE WHEN v_requires_review THEN 'REQUIRES_REVIEW' ELSE 'COMPLETED' END,
                close_method = v_close_method,
                requires_review = v_requires_review,
                review_status = v_review_status,
                updated_at = now()
            WHERE shift_id = v_shift_id;
        END IF;

        -- Insert event
        INSERT INTO public.attendance_events (
            event_id, shift_id, personnel_id, project_id,
            event_type, work_type, device_event_timestamp, timezone_offset_minutes,
            device_id, device_platform, client_app_version, client_release_id, client_commit_hash,
            attendance_protocol_version, created_offline, offline_lease_id,
            latitude, longitude, accuracy_meters, gps_verified, geofence_status,
            geofence_distance_meters, geofence_version_id, face_verified, face_bypass_reason,
            is_manual_adjustment, adjustment_reason, reported_departure_timestamp, worker_explanation,
            auth_user_id, server_received_at, canonical_hash, server_authorization_outcome,
            server_geofence_distance_meters, server_geofence_status
        ) VALUES (
            v_event_id, v_shift_id, v_personnel_id, v_project_id,
            'CLOCK_OUT', v_work_type, v_device_event_timestamp, v_tz_offset,
            v_device_id, v_device_platform, v_client_app_version, v_client_release_id, v_client_commit_hash,
            v_protocol_version, v_created_offline, v_offline_lease_id,
            v_lat, v_lon, v_accuracy, v_gps_verified, v_geofence_status,
            v_geofence_distance, v_geofence_version_id, v_face_verified, v_face_bypass_reason,
            v_is_manual_adjustment, v_adjustment_reason, v_reported_departure, v_worker_explanation,
            v_uid, now(), v_canonical_hash, 'AUTHORIZED',
            v_server_distance, v_server_geofence_status
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'APPLIED',
            'event_id', v_event_id,
            'shift_id', v_shift_id,
            'event_type', 'CLOCK_OUT',
            'physical_duration_minutes', v_duration_minutes,
            'payable_hours', v_payable_hours
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'status', 'REJECTED', 'error', 'INVALID_EVENT_TYPE');
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_attendance_event(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_attendance_event(JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. BATCH SYNC REPLAY RPC (INDEPENDENT TRANSACTION ISOLATION PER EVENT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_attendance_events(p_events JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event jsonb;
    v_res jsonb;
    v_results jsonb := '[]'::jsonb;
BEGIN
    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        BEGIN
            v_res := public.record_attendance_event(v_event);
            v_results := v_results || jsonb_build_object(
                'event_id', v_event->>'event_id',
                'shift_id', v_event->>'shift_id',
                'event_type', v_event->>'event_type',
                'outcome', v_res
            );
        EXCEPTION WHEN OTHERS THEN
            v_results := v_results || jsonb_build_object(
                'event_id', v_event->>'event_id',
                'shift_id', v_event->>'shift_id',
                'event_type', v_event->>'event_type',
                'outcome', jsonb_build_object(
                    'success', false,
                    'status', 'REJECTED',
                    'error', SQLERRM,
                    'code', SQLSTATE
                )
            );
        END;
    END LOOP;

    RETURN v_results;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_attendance_events(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_attendance_events(JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. ZOMBIE SHIFTS AUTO-CLOSURE JOB RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_zombie_shift_closure(p_threshold_hours NUMERIC DEFAULT 14.00)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INT := 0;
    v_shift RECORD;
    v_duration_min INT;
    v_adj_id UUID;
    v_audit_id UUID;
BEGIN
    FOR v_shift IN 
        SELECT shift_id, personnel_id, first_clock_in_at
        FROM public.attendance_shifts
        WHERE status = 'OPEN' 
          AND now() - first_clock_in_at > (p_threshold_hours || ' hours')::interval
    LOOP
        v_duration_min := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_shift.first_clock_in_at)) / 60)::int;
        
        UPDATE public.attendance_shifts
        SET status = 'ZOMBIE_PENDING_RECONCILIATION',
            final_clock_out_at = now(),
            physical_duration_minutes = v_duration_min,
            payable_hours = 8.00,
            overtime_hours = 0.00,
            close_method = 'ZOMBIE_AUTO_CLOSE_8H',
            requires_review = TRUE,
            review_status = 'PENDING',
            updated_at = now()
        WHERE shift_id = v_shift.shift_id;

        -- Record system adjustment (actor_type = 'SYSTEM', actor_user_id = NULL)
        v_adj_id := gen_random_uuid();
        INSERT INTO public.attendance_adjustments (
            adjustment_id, shift_id, event_id, adjustment_type, previous_values, new_values,
            reason, actor_type, actor_user_id
        ) VALUES (
            v_adj_id, v_shift.shift_id, NULL, 'ZOMBIE_RECONCILIATION',
            jsonb_build_object('status', 'OPEN'),
            jsonb_build_object('status', 'ZOMBIE_PENDING_RECONCILIATION', 'payable_hours', 8.00, 'overtime_hours', 0.00),
            'Automated zombie shift closure exceeding 14.00 hours threshold',
            'SYSTEM', NULL
        );

        -- Record audit log
        v_audit_id := gen_random_uuid();
        INSERT INTO public.attendance_audit_log (
            audit_id, target_type, target_id, action, actor_type, actor_user_id, metadata
        ) VALUES (
            v_audit_id, 'SHIFT', v_shift.shift_id::text, 'SYSTEM_ZOMBIE_CLOSE',
            'SYSTEM', NULL,
            jsonb_build_object('threshold_hours', p_threshold_hours, 'duration_minutes', v_duration_min)
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'closed_zombie_shifts_count', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_zombie_shift_closure(NUMERIC) FROM PUBLIC, authenticated, anon;

-- ------------------------------------------------------------------------------
-- 9. MANAGEMENT RECONCILIATION RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_shift(
    p_shift_id UUID,
    p_payable_hours NUMERIC,
    p_overtime_hours NUMERIC,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_subsidiary TEXT;
    v_shift RECORD;
    v_adj_id UUID;
    v_audit_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
    END IF;

    SELECT role, subsidiary INTO v_caller_role, v_caller_subsidiary 
    FROM public.profiles WHERE id = v_uid;

    IF v_caller_role NOT IN ('Manager', 'HR', 'Supervisor') THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ROLE');
    END IF;

    SELECT * INTO v_shift FROM public.attendance_shifts WHERE shift_id = p_shift_id;
    IF v_shift.shift_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SHIFT_NOT_FOUND');
    END IF;

    IF v_caller_role <> 'Supervisor' AND v_caller_subsidiary <> v_shift.subsidiary THEN
        RETURN jsonb_build_object('success', false, 'error', 'CROSS_SUBSIDIARY_FORBIDDEN');
    END IF;

    -- Update shift
    UPDATE public.attendance_shifts
    SET payable_hours = p_payable_hours,
        overtime_hours = p_overtime_hours,
        status = 'COMPLETED',
        close_method = 'MANUAL_SUPERVISOR_ADJUSTMENT',
        requires_review = FALSE,
        review_status = 'APPROVED',
        review_notes = p_reason,
        reviewed_by = v_uid,
        reviewed_at = now(),
        updated_at = now()
    WHERE shift_id = p_shift_id;

    -- Record adjustment
    v_adj_id := gen_random_uuid();
    INSERT INTO public.attendance_adjustments (
        adjustment_id, shift_id, event_id, adjustment_type, previous_values, new_values,
        reason, actor_type, actor_user_id
    ) VALUES (
        v_adj_id, p_shift_id, NULL, 'PAYABLE_HOURS_OVERRIDE',
        jsonb_build_object('payable_hours', v_shift.payable_hours, 'overtime_hours', v_shift.overtime_hours),
        jsonb_build_object('payable_hours', p_payable_hours, 'overtime_hours', p_overtime_hours),
        p_reason, upper(v_caller_role), v_uid
    );

    -- Record audit
    v_audit_id := gen_random_uuid();
    INSERT INTO public.attendance_audit_log (
        audit_id, target_type, target_id, action, actor_type, actor_user_id, metadata
    ) VALUES (
        v_audit_id, 'SHIFT', p_shift_id::text, 'RECONCILIATION_APPROVED',
        upper(v_caller_role), v_uid,
        jsonb_build_object('payable_hours', p_payable_hours, 'overtime_hours', p_overtime_hours, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'shift_id', p_shift_id, 'status', 'APPROVED');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_shift(UUID, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_shift(UUID, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 10. CONTROL STATE TRANSITION RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_attendance_v2_control_state(
    p_new_state TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_current_state TEXT;
BEGIN
    SELECT system_state INTO v_current_state FROM public.attendance_v2_control WHERE control_id = 1;

    -- Validate transition semantics
    IF v_current_state = 'LEGACY_ACTIVE' AND p_new_state NOT IN ('V2_DORMANT') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRANSITION', 'from', v_current_state, 'to', p_new_state);
    ELSIF v_current_state = 'V2_DORMANT' AND p_new_state NOT IN ('V2_ACTIVE', 'LEGACY_ACTIVE') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRANSITION', 'from', v_current_state, 'to', p_new_state);
    ELSIF v_current_state = 'V2_ACTIVE' AND p_new_state NOT IN ('V2_DEGRADED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRANSITION', 'from', v_current_state, 'to', p_new_state);
    ELSIF v_current_state = 'V2_DEGRADED' AND p_new_state NOT IN ('V2_ACTIVE') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRANSITION', 'from', v_current_state, 'to', p_new_state);
    END IF;

    UPDATE public.attendance_v2_control
    SET system_state = p_new_state,
        state_changed_at = now(),
        v2_activated_at = CASE WHEN p_new_state = 'V2_ACTIVE' THEN now() ELSE v2_activated_at END,
        legacy_frozen_at = CASE WHEN p_new_state = 'V2_ACTIVE' THEN now() ELSE legacy_frozen_at END,
        updated_at = now(),
        updated_by = v_uid
    WHERE control_id = 1;

    INSERT INTO public.attendance_audit_log (
        audit_id, target_type, target_id, action, actor_type, actor_user_id, metadata
    ) VALUES (
        gen_random_uuid(), 'CONTROL', '1', 'CONTROL_FLAG_CHANGED',
        CASE WHEN v_uid IS NULL THEN 'SYSTEM' ELSE 'ADMIN' END, v_uid,
        jsonb_build_object('previous_state', v_current_state, 'new_state', p_new_state, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'previous_state', v_current_state, 'new_state', p_new_state);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transition_attendance_v2_control_state(TEXT, TEXT) FROM PUBLIC, authenticated, anon;

-- >>> SECTION 3: MEDIA SYNC RPCS (PASS 13G) <<<
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



COMMIT;
-- ==============================================================================
-- END OF PASS 13I DORMANT PRODUCTION DEPLOYMENT BUNDLE
-- ==============================================================================
