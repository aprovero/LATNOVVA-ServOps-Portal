-- Migration to add GPS accuracy threshold setting configuration
-- Run this script in the Supabase SQL Editor (Dashboard) to update the table structure.

-- 1. Add the "gpsAccuracyThreshold" column with a default value of 100 meters
ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS "gpsAccuracyThreshold" numeric DEFAULT 100;

-- 2. Update existing settings records to the default value if they are null
UPDATE public.platform_settings 
SET "gpsAccuracyThreshold" = 100 
WHERE "gpsAccuracyThreshold" IS NULL;
