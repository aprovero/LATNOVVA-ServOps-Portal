-- Create platform_settings table in Supabase
-- Run this script in the Supabase SQL Editor (Dashboard) to fix the geofence sync error.

-- 1. Create the platform_settings table
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id text PRIMARY KEY,
    "shiftLengthThreshold" numeric DEFAULT 8,
    "enableShiftNotifications" boolean DEFAULT true,
    "enableAutoClockOut" boolean DEFAULT true,
    "autoClockOutThreshold" numeric DEFAULT 14,
    "geofenceRadius" numeric DEFAULT 250,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "Anyone authenticated can view platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "HR and Managers can manage platform_settings" ON public.platform_settings;

-- 4. Create policy: Anyone authenticated can view settings
CREATE POLICY "Anyone authenticated can view platform_settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- 5. Create policy: Managers and HR can update settings
CREATE POLICY "HR and Managers can manage platform_settings"
ON public.platform_settings FOR ALL
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

-- 6. Seed the default global settings row
INSERT INTO public.platform_settings (id, "shiftLengthThreshold", "enableShiftNotifications", "enableAutoClockOut", "autoClockOutThreshold", "geofenceRadius")
VALUES ('global', 8, true, true, 14, 250)
ON CONFLICT (id) DO NOTHING;
