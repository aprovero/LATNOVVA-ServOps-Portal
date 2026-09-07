-- Add customProjectTypes column to platform_settings table
-- Run this in the Supabase SQL Editor to persist custom project types globally.

ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS "customProjectTypes" jsonb DEFAULT '[]'::jsonb;
