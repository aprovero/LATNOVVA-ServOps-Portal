-- ==============================================================================
-- MIGRATION: 20261013000001_default_subsidiary_mx.sql
-- DESCRIPTION: Ensure all new users, profiles, personnel, projects, and subsidiary-
--              dependent entities strictly default to subsidiary 'MX'.
-- ==============================================================================

-- 1. Alter Column Defaults on Core Entity Tables to 'MX'
ALTER TABLE public.profiles 
  ALTER COLUMN subsidiary SET DEFAULT 'MX';

ALTER TABLE public.personnel 
  ALTER COLUMN subsidiary SET DEFAULT 'MX';

ALTER TABLE public.projects 
  ALTER COLUMN subsidiary SET DEFAULT 'MX';

ALTER TABLE public.timesheets 
  ALTER COLUMN subsidiary SET DEFAULT 'MX';

-- 2. mx_personnel check and default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'mx_personnel' 
      AND column_name = 'subsidiary'
  ) THEN
    ALTER TABLE public.mx_personnel ALTER COLUMN subsidiary SET DEFAULT 'MX';
  END IF;
END $$;

-- 3. Update admin_create_user RPC to explicitly populate subsidiary as 'MX' on profile insert
CREATE OR REPLACE FUNCTION public.admin_create_user(
  user_email text,
  user_name text,
  user_role text,
  user_password text DEFAULT '',
  user_client_id uuid DEFAULT NULL,
  user_subsidiary text DEFAULT 'MX'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- 1. Create the user in auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, is_super_admin
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    user_email,
    CASE WHEN user_password <> '' THEN extensions.crypt(user_password, extensions.gen_salt('bf')) ELSE NULL END,
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', user_name, 'role', user_role),
    now(),
    now(),
    '', '', '', false
  )
  RETURNING id INTO new_user_id;

  -- 2. Create identity
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    new_user_id, new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', user_email),
    'email', user_email,
    now(), now(), now()
  );

  -- 3. Create profile with explicit subsidiary defaulting to 'MX'
  INSERT INTO public.profiles (id, name, email, role, client_id, subsidiary)
  VALUES (new_user_id, user_name, user_email, user_role, user_client_id, COALESCE(user_subsidiary, 'MX'))
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    client_id = EXCLUDED.client_id,
    subsidiary = COALESCE(EXCLUDED.subsidiary, public.profiles.subsidiary, 'MX');

  RETURN new_user_id;
END;
$$;
