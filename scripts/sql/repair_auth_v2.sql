-- ── STEP 1: FIX FOR EXISTING ACCOUNT (aprovero@gmail.com) ──────────────────
-- This creates the missing profile so you can log in immediately.
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'aprovero@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.personnel (id, name, email, app_role, status, employee_number, position)
    VALUES (v_user_id, 'Andres Provero', 'aprovero@gmail.com', 'Manager', 'Active', 'EMP-ADMIN-G', 'System Administrator')
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      app_role = EXCLUDED.app_role;
  END IF;
END $$;


-- ── STEP 2: UPGRADE ADMIN_CREATE_USER (PERMANENT FIX) ───────────────────
-- This ensures all future invites automatically create a profile.
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

  -- 3. Create public personnel profile (Ensures Login succeeds)
  INSERT INTO public.personnel (id, name, email, app_role, status, employee_number, position)
  VALUES (
    new_user_id, 
    user_name, 
    user_email, 
    user_role, 
    'Active', 
    'EMP-' || upper(substr(md5(random()::text), 1, 6)),
    user_role || ' (Admin Invited)'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    app_role = EXCLUDED.app_role,
    position = EXCLUDED.position;

  RETURN new_user_id;
END;
$$;
