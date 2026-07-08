-- Create mx_attendance_overrides and mx_work_schedules tables in Supabase
-- Run this in the Supabase SQL Editor

-- ── 1. Create mx_attendance_overrides ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mx_attendance_overrides (
    id text PRIMARY KEY,
    employee_id text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    type text NOT NULL,
    duration text NOT NULL,
    custom_hours numeric,
    notes text,
    approved_by text,
    created_by text,
    created_at text,
    updated_at text
);

-- Enable RLS
ALTER TABLE public.mx_attendance_overrides ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone authenticated can view mx_attendance_overrides" ON public.mx_attendance_overrides;
DROP POLICY IF EXISTS "HR and Managers can manage mx_attendance_overrides" ON public.mx_attendance_overrides;

-- RLS Policies
CREATE POLICY "Anyone authenticated can view mx_attendance_overrides"
ON public.mx_attendance_overrides FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "HR and Managers can manage mx_attendance_overrides"
ON public.mx_attendance_overrides FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Manager', 'HR', 'Office')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Manager', 'HR', 'Office')
    )
);


-- ── 2. Create mx_work_schedules ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mx_work_schedules (
    id text PRIMARY KEY,
    name text NOT NULL,
    start_time text NOT NULL,
    lunch_start text,
    lunch_end text,
    end_time text NOT NULL,
    standard_daily_hours numeric NOT NULL,
    work_days integer[] NOT NULL
);

-- Enable RLS
ALTER TABLE public.mx_work_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone authenticated can view mx_work_schedules" ON public.mx_work_schedules;
DROP POLICY IF EXISTS "HR and Managers can manage mx_work_schedules" ON public.mx_work_schedules;

-- RLS Policies
CREATE POLICY "Anyone authenticated can view mx_work_schedules"
ON public.mx_work_schedules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "HR and Managers can manage mx_work_schedules"
ON public.mx_work_schedules FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Manager', 'HR', 'Office')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('Manager', 'HR', 'Office')
    )
);
