-- Add enableFastLogin column to platform_settings table
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS "enableFastLogin" boolean DEFAULT false;
