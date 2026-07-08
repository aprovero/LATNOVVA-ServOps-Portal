-- Migration SQL to enable Facial ID features in Supabase

-- 1. Add enableFacialId to platform_settings
ALTER TABLE public.platform_settings 
ADD COLUMN IF NOT EXISTS "enableFacialId" boolean DEFAULT false;

-- 2. Add faceDescriptor to personnel table
ALTER TABLE public.personnel 
ADD COLUMN IF NOT EXISTS "faceDescriptor" jsonb DEFAULT null;

-- 3. Add faceDescriptor to mx_personnel table
ALTER TABLE public.mx_personnel 
ADD COLUMN IF NOT EXISTS "faceDescriptor" jsonb DEFAULT null;
