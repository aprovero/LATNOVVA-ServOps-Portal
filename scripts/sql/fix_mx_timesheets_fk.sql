-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: mx_timesheets Foreign Key Constraint and Personnel Synchronization
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the blocking foreign key constraint if it exists on mx_timesheets
ALTER TABLE IF EXISTS public.mx_timesheets
DROP CONSTRAINT IF EXISTS mx_timesheets_personnel_id_fkey;

-- 2. Make sure all users in profiles / auth have a corresponding personnel row
INSERT INTO public.personnel (id, name, email, app_role, status, employee_number, position, subsidiary)
SELECT 
    p.id,
    COALESCE(p.name, p.email, 'Colaborador'),
    COALESCE(p.email, 'user@latnovva.com'),
    COALESCE(p.role, 'Technician'),
    'Active',
    'EMP-' || upper(substr(md5(p.id::text), 1, 6)),
    COALESCE(p.role, 'Technician'),
    COALESCE(p.subsidiary, 'MX')
FROM public.profiles p
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    app_role = EXCLUDED.app_role;
