-- Repair and Enhance RLS Policies for Sync Resiliency (v2 - Fixed Type Casting)
-- This script ensures that all roles have the necessary write permissions
-- to prevent synchronization failures when pushing offline changes.

-- 1. PROJECTS TABLE
-- Managers and Global Admins can do everything
DROP POLICY IF EXISTS "Managers can manage all projects" ON public.projects;
CREATE POLICY "Managers can manage all projects"
ON public.projects FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.role IN ('Manager', 'HR') OR profiles.client_id IS NULL)
    )
);

-- Supervisors can update projects they are assigned to
-- Note: assigned_personnel is a text[] array in this schema
DROP POLICY IF EXISTS "Supervisors can update assigned projects" ON public.projects;
CREATE POLICY "Supervisors can update assigned projects"
ON public.projects FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'Supervisor'
        AND projects.assigned_personnel @> ARRAY[auth.uid()::text]
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'Supervisor'
        AND projects.assigned_personnel @> ARRAY[auth.uid()::text]
    )
);

-- 2. PERSONNEL TABLE
-- Supervisors need to be able to update personnel (e.g. prevailing wage status) 
-- for people assigned to their projects.
DROP POLICY IF EXISTS "Supervisors can update project personnel" ON public.personnel;
CREATE POLICY "Supervisors can update project personnel"
ON public.personnel FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p_me
        JOIN public.projects proj ON proj.assigned_personnel @> ARRAY[p_me.id::text]
        WHERE p_me.id = auth.uid()
        AND p_me.role = 'Supervisor'
        AND proj.assigned_personnel @> ARRAY[public.personnel.id::text]
    )
);

-- 3. REPORTS TABLE
-- Ensure Techs and Supervisors can insert and update their own reports
DROP POLICY IF EXISTS "Users can manage own reports" ON public.reports;
CREATE POLICY "Users can manage own reports"
ON public.reports FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Managers can manage all reports for their client (or all if Global)
DROP POLICY IF EXISTS "Managers can manage client reports" ON public.reports;
CREATE POLICY "Managers can manage client reports"
ON public.reports FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (
            profiles.role IN ('Manager', 'HR') 
            AND (profiles.client_id = public.reports.client_id OR profiles.client_id IS NULL)
        )
    )
);

-- 4. TIMESHEETS TABLE
-- Techs/Supervisors can insert their own timesheets
DROP POLICY IF EXISTS "Users can insert own timesheets" ON public.timesheets;
CREATE POLICY "Users can insert own timesheets"
ON public.timesheets FOR INSERT
TO authenticated
WITH CHECK (personnel_id = auth.uid());

-- Users can update their own timesheets if not yet approved
DROP POLICY IF EXISTS "Users can update own unapproved timesheets" ON public.timesheets;
CREATE POLICY "Users can update own unapproved timesheets"
ON public.timesheets FOR UPDATE
TO authenticated
USING (personnel_id = auth.uid() AND status = 'Pending')
WITH CHECK (personnel_id = auth.uid() AND status = 'Pending');

-- 5. CLIENTS TABLE
-- Global Admins can manage all clients
DROP POLICY IF EXISTS "Global Admins can manage all clients" ON public.clients;
CREATE POLICY "Global Admins can manage all clients"
ON public.clients FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.client_id IS NULL
        AND profiles.role IN ('Manager', 'HR')
    )
);
