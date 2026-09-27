-- ============================================================================
-- PASS 11B: Real Production Stage 1 DARK Infrastructure Deployment
-- Target Project: dvkkxwtqonjgrvloisid (LATNOVVA ServiceTool)
-- ============================================================================

BEGIN;

-- 1. Create Child Table mx_timesheet_punches
CREATE TABLE IF NOT EXISTS public.mx_timesheet_punches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timesheet_id TEXT NOT NULL REFERENCES public.mx_timesheets(id) ON DELETE RESTRICT,
    personnel_id TEXT NOT NULL REFERENCES public.mx_personnel(id) ON DELETE RESTRICT,
    project_id UUID REFERENCES public.projects(id) ON DELETE RESTRICT,
    timestamp TIMESTAMPTZ NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('clockIn', 'clockOut')),
    work_mode VARCHAR(20) DEFAULT 'On Site' CHECK (work_mode IN ('On Site', 'Home Office')),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    accuracy REAL,
    time_source VARCHAR(10) DEFAULT 'device' CHECK (time_source IN ('gps', 'device')),
    manual_adjustment BOOLEAN DEFAULT FALSE,
    adjustment_note TEXT,
    face_verified BOOLEAN DEFAULT FALSE,
    face_bypass_reason TEXT,
    is_outsourced BOOLEAN DEFAULT FALSE,
    outsourced_name TEXT,
    is_zombie_close BOOLEAN DEFAULT FALSE,
    gps_verified BOOLEAN DEFAULT FALSE,
    selfie_url TEXT,
    supervisor_signature_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Child Table Indexes
CREATE INDEX IF NOT EXISTS idx_mx_timesheet_punches_timesheet_id 
    ON public.mx_timesheet_punches (timesheet_id);

CREATE INDEX IF NOT EXISTS idx_mx_timesheet_punches_personnel_timestamp 
    ON public.mx_timesheet_punches (personnel_id, timestamp DESC);

-- 3. Exception Log Table
CREATE TABLE IF NOT EXISTS public.mx_migration_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timesheet_id TEXT NOT NULL,
    array_index INT NOT NULL,
    punch_id UUID,
    error_code TEXT NOT NULL,
    safe_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mx_migration_exceptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mx_migration_exceptions FROM PUBLIC, anon, authenticated;

-- 4. Identity Helper Function
CREATE OR REPLACE FUNCTION public.get_authoritative_personnel_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_email TEXT;
    v_personnel_ids TEXT[];
BEGIN
    SELECT ARRAY_AGG(id) INTO v_personnel_ids
    FROM public.mx_personnel WHERE id = (auth.uid())::text;

    IF ARRAY_LENGTH(v_personnel_ids, 1) = 1 THEN
        RETURN v_personnel_ids[1];
    END IF;

    SELECT LOWER(email) INTO v_user_email
    FROM public.profiles WHERE id = auth.uid();

    IF v_user_email IS NULL OR v_user_email = '' THEN
        RETURN NULL;
    END IF;

    SELECT ARRAY_AGG(id) INTO v_personnel_ids
    FROM public.mx_personnel WHERE LOWER(email) = v_user_email;

    IF ARRAY_LENGTH(v_personnel_ids, 1) = 1 THEN
        RETURN v_personnel_ids[1];
    ELSE
        RETURN NULL;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_authoritative_personnel_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_authoritative_personnel_id() FROM PUBLIC, anon;

-- 5. Storage Bucket Creation (attendance-media)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attendance-media', 'attendance-media', false, 2097152, ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png'];

COMMIT;
