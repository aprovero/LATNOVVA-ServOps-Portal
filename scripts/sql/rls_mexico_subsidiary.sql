-- ── RLS POLICIES FOR SUBSIDIARY ISOLATION (LATNOVVA US vs MX) ─────────────────
-- This script applies strict Row-Level Security policies to ensure that personnel,
-- projects, and timesheets are isolated per subsidiary, except for Managers and HR 
-- who have cross-subsidiary access based on their current active context.

-- IMPORTANT: These policies assume `public.profiles` has the `subsidiary` and `role` correctly set.

-- 1. Enable RLS on core tables (if not already enabled)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- 2. Helper function to get current user role and subsidiary
CREATE OR REPLACE FUNCTION public.jwt_role() RETURNS text AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'role', '')::text;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION public.jwt_subsidiary() RETURNS text AS $$
  SELECT subsidiary FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE;


-- 3. Projects Policy: 
-- Standard users (Tech, Office, Supervisor) can only see projects matching their subsidiary.
-- Managers and HR can see all projects (filtered in UI by activeSubsidiary toggle).
DROP POLICY IF EXISTS "Subsidiary Isolation for Projects" ON public.projects;
CREATE POLICY "Subsidiary Isolation for Projects" ON public.projects
  FOR ALL 
  USING (
    (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('Manager', 'HR'))) 
    OR 
    (subsidiary = public.jwt_subsidiary())
  );

-- 4. Personnel Policy:
-- Standard users only see personnel in their own subsidiary.
-- Managers and HR can see all personnel.
DROP POLICY IF EXISTS "Subsidiary Isolation for Personnel" ON public.personnel;
CREATE POLICY "Subsidiary Isolation for Personnel" ON public.personnel
  FOR ALL 
  USING (
    (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('Manager', 'HR'))) 
    OR 
    (subsidiary = public.jwt_subsidiary())
  );

-- 5. Timesheets Policy:
-- Techs and Office only see their own timesheets.
-- Supervisors see timesheets for their subsidiary.
-- Managers and HR see all timesheets.
DROP POLICY IF EXISTS "Subsidiary Isolation for Timesheets" ON public.timesheets;
CREATE POLICY "Subsidiary Isolation for Timesheets" ON public.timesheets
  FOR ALL 
  USING (
    (auth.uid() = personnel_id) 
    OR
    (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('Manager', 'HR'))) 
    OR 
    (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'Supervisor') 
        AND 
        subsidiary = public.jwt_subsidiary()
    )
  );

-- 6. Profile Policy (Update to handle subsidiary view)
DROP POLICY IF EXISTS "Profiles visibility by subsidiary" ON public.profiles;
CREATE POLICY "Profiles visibility by subsidiary" ON public.profiles
  FOR SELECT 
  USING (
    (auth.uid() = id)
    OR
    (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('Manager', 'HR'))) 
    OR 
    (subsidiary = public.jwt_subsidiary())
  );
