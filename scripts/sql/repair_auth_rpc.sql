-- 1. Enable the pgcrypto extension in the extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- 2. Repair admin_create_user (Returns UUID of new user)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  user_email text,
  user_name text,
  user_role text,
  user_password text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Create the user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    is_super_admin
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    user_email,
    CASE 
      WHEN user_password <> '' THEN extensions.crypt(user_password, extensions.gen_salt('bf'))
      ELSE NULL 
    END,
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', user_name, 'role', user_role),
    now(),
    now(),
    '',
    '',
    '',
    false
  )
  RETURNING id INTO new_user_id;

  -- Create identity so user can actually log in
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    new_user_id,
    new_user_id,
    jsonb_build_object('sub', new_user_id, 'email', user_email),
    'email',
    user_email,
    now(),
    now(),
    now()
  );

  RETURN new_user_id;
END;
$$;

-- 3. Repair admin_update_user
CREATE OR REPLACE FUNCTION public.admin_update_user(
  target_user_id uuid,
  new_email text,
  new_role text,
  new_password text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Update email and role metadata
  UPDATE auth.users
  SET 
    email = new_email,
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', new_role),
    updated_at = now()
  WHERE id = target_user_id;

  -- Update password only if a new one is provided
  IF new_password <> '' THEN
    UPDATE auth.users
    SET 
      encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf'))
    WHERE id = target_user_id;
  END IF;

  -- Update identity to match new email
  UPDATE auth.identities
  SET 
    identity_data = jsonb_build_object('sub', target_user_id, 'email', new_email),
    updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;
