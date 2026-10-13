-- ==============================================================================
-- MIGRATION: 20261013000002_auto_provision_personnel_auth.sql
-- DESCRIPTION: Ensure all staff with login roles (Office, HR, Manager, Supervisor)
--              or corporate @latnovva.com emails are guaranteed to have Auth accounts.
-- ==============================================================================

-- 1. Helper function to ensure an auth user exists for a personnel record
CREATE OR REPLACE FUNCTION public.ensure_user_auth_provisioned(
  target_email text,
  target_name text,
  target_role text DEFAULT 'Tech',
  target_subsidiary text DEFAULT 'MX'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF target_email IS NULL OR TRIM(target_email) = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Check if user already exists in auth.users
  SELECT id INTO v_uid 
  FROM auth.users 
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(target_email)) 
  LIMIT 1;

  IF v_uid IS NOT NULL THEN
    -- Ensure profiles row exists and is consistent
    INSERT INTO public.profiles (id, name, email, role, subsidiary)
    VALUES (v_uid, target_name, LOWER(TRIM(target_email)), target_role, COALESCE(target_subsidiary, 'MX'))
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, public.profiles.name),
      role = COALESCE(EXCLUDED.role, public.profiles.role),
      subsidiary = COALESCE(EXCLUDED.subsidiary, public.profiles.subsidiary, 'MX');

    RETURN v_uid;
  END IF;

  -- 2. Create the user in auth.users with default rotation-required password
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
    LOWER(TRIM(target_email)),
    extensions.crypt('Latnovva2026!', extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', target_name, 'role', target_role),
    now(),
    now(),
    '', '', '', false
  )
  RETURNING id INTO v_uid;

  -- 3. Create identity
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    v_uid, v_uid,
    jsonb_build_object('sub', v_uid, 'email', LOWER(TRIM(target_email))),
    'email', LOWER(TRIM(target_email)),
    now(), now(), now()
  );

  -- 4. Create the profile row (password_policy_version = 0 forces rotation on first login)
  INSERT INTO public.profiles (id, name, email, role, subsidiary, password_policy_version)
  VALUES (v_uid, target_name, LOWER(TRIM(target_email)), target_role, COALESCE(target_subsidiary, 'MX'), 0)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    subsidiary = EXCLUDED.subsidiary;

  RETURN v_uid;
END;
$$;
