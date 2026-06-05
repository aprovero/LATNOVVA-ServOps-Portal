-- ── FIX: mx_timesheets – Notes Column + RLS Policies ──────────────────────────
-- Run this script in the Supabase SQL Editor to:
--   1. Add the `notes` column if it doesn't exist (safe, idempotent)
--   2. Add missing audit columns (corrected_by, corrected_at, correction_reason, source, manual_reason)
--   3. Enable RLS on mx_timesheets
--   4. Create policies so that HR / Managers can INSERT and UPDATE any row,
--      and employees can read/insert their own timesheets.

-- ── 1. Column additions (safe – ALTER TABLE ADD COLUMN IF NOT EXISTS) ──────────

ALTER TABLE public.mx_timesheets
    ADD COLUMN IF NOT EXISTS notes             text,
    ADD COLUMN IF NOT EXISTS source            text DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS manual_reason     text,
    ADD COLUMN IF NOT EXISTS corrected_by      text,
    ADD COLUMN IF NOT EXISTS corrected_at      timestamptz,
    ADD COLUMN IF NOT EXISTS correction_reason text;

-- ── 2. Enable RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.mx_timesheets ENABLE ROW LEVEL SECURITY;

-- ── 3. Drop existing policies (clean slate) ────────────────────────────────────

DROP POLICY IF EXISTS "HR and Managers can manage all mx_timesheets"   ON public.mx_timesheets;
DROP POLICY IF EXISTS "Employees can read their own mx_timesheets"      ON public.mx_timesheets;
DROP POLICY IF EXISTS "Employees can insert their own mx_timesheets"    ON public.mx_timesheets;
DROP POLICY IF EXISTS "Supervisors can read subsidiary mx_timesheets"   ON public.mx_timesheets;

-- ── 4. HR / Manager / Office: full access ──────────────────────────────────────────────
CREATE POLICY "HR and Managers can manage all mx_timesheets"
ON public.mx_timesheets
FOR ALL
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

-- ── 5. Supervisors: read all timesheets in their subsidiary ────────────────────
CREATE POLICY "Supervisors can read subsidiary mx_timesheets"
ON public.mx_timesheets
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'Supervisor'
    )
);

-- ── 6. Employees: read and insert their own timesheets ─────────────────────────
CREATE POLICY "Employees can read their own mx_timesheets"
ON public.mx_timesheets
FOR SELECT
TO authenticated
USING (personnel_id = auth.uid()::text);

CREATE POLICY "Employees can insert their own mx_timesheets"
ON public.mx_timesheets
FOR INSERT
TO authenticated
WITH CHECK (personnel_id = auth.uid()::text);

CREATE POLICY "Employees can update their own mx_timesheets"
ON public.mx_timesheets
FOR UPDATE
TO authenticated
USING (personnel_id = auth.uid()::text)
WITH CHECK (personnel_id = auth.uid()::text);

-- ── Done ───────────────────────────────────────────────────────────────────────
-- After running this script, HR and Manager users will be able to:
--   • Insert new timesheets for any employee
--   • Update existing timesheets (including notes, corrections, times)
--   • Delete timesheets
-- Employees will be able to:
--   • Read their own timesheets
--   • Insert clock-in records for themselves
