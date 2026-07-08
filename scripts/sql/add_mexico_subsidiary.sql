-- Add subsidiary tracking to support LATNOVVA US / LATNOVVA MX separation
-- Default to 'US' for existing records.

-- 1. Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subsidiary text DEFAULT 'US';

-- 2. Personnel
ALTER TABLE public.personnel 
ADD COLUMN IF NOT EXISTS subsidiary text DEFAULT 'US',
ADD COLUMN IF NOT EXISTS subsidiary_metadata jsonb DEFAULT '{}'::jsonb;

-- 3. Projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS subsidiary text DEFAULT 'US',
ADD COLUMN IF NOT EXISTS subsidiary_metadata jsonb DEFAULT '{}'::jsonb;

-- 4. Timesheets
ALTER TABLE public.timesheets 
ADD COLUMN IF NOT EXISTS subsidiary text DEFAULT 'US';

-- Update the admin_create_user RPC to accept subsidiary (optional, but good for future proofing)
-- For now, we just rely on defaults or UI passing it in.
