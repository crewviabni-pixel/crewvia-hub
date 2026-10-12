-- ==============================================================================
-- CREWVIA BNI CRM: PRODUCTION DESIGNER USER PROVISIONING & MANAGEMENT RPC
-- ==============================================================================
-- This script allows admins to create, reset passwords, and manage unlimited 
-- designers directly inside the CRM UI without opening the Supabase Dashboard.
-- Run this in your Supabase SQL Editor once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. admin_create_designer
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_designer(
  p_username TEXT,
  p_password TEXT,
  p_name TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_new_user_id UUID;
  v_email TEXT;
  v_clean_username TEXT;
  v_clean_name TEXT;
  v_hashed_pw TEXT;
BEGIN
  v_caller_id := auth.uid();

  -- Verify that the caller is an active admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_caller_id AND role = 'admin' AND is_suspended = false
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create designers.';
  END IF;

  -- Clean & validate username
  v_clean_username := lower(trim(regexp_replace(p_username, '\s+', '', 'g')));
  IF length(v_clean_username) < 3 THEN
    RAISE EXCEPTION 'Username must be at least 3 characters long.';
  END IF;

  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  v_clean_name := trim(coalesce(p_name, ''));
  IF v_clean_name = '' THEN
    v_clean_name := initcap(v_clean_username);
  END IF;

  -- Check if username already exists in user_roles
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE lower(username) = v_clean_username
  ) THEN
    RAISE EXCEPTION 'Username "%" is already taken. Please choose another username.', v_clean_username;
  END IF;

  v_email := v_clean_username || '@crewviabni.com';

  -- Check if email already exists in auth.users
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE lower(email) = lower(v_email)
  ) THEN
    RAISE EXCEPTION 'A user with email "%" already exists in authentication.', v_email;
  END IF;

  v_new_user_id := gen_random_uuid();
  v_hashed_pw := crypt(p_password, gen_salt('bf'));

  -- Insert directly into auth.users with pre-confirmed email (zero email verification needed)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_email,
    v_hashed_pw,
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('username', v_clean_username, 'name', v_clean_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Insert identity into auth.identities for standard email+password sign in
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_new_user_id,
    v_new_user_id,
    jsonb_build_object('sub', v_new_user_id::text, 'email', v_email),
    'email',
    v_email,
    now(),
    now(),
    now()
  );

  -- Insert into public.user_roles
  INSERT INTO public.user_roles (
    user_id,
    role,
    username,
    is_suspended,
    created_at
  ) VALUES (
    v_new_user_id,
    'designer',
    v_clean_username,
    false,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'username', v_clean_username,
    'name', v_clean_name,
    'email', v_email
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. admin_reset_designer_password
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_designer_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_hashed_pw TEXT;
BEGIN
  v_caller_id := auth.uid();

  -- Verify that caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_caller_id AND role = 'admin' AND is_suspended = false
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can reset designer passwords.';
  END IF;

  IF length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'New password must be at least 6 characters long.';
  END IF;

  v_hashed_pw := crypt(p_new_password, gen_salt('bf'));

  -- Update encrypted password in auth.users
  UPDATE auth.users
  SET encrypted_password = v_hashed_pw,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. admin_delete_designer
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_designer(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_caller_id AND role = 'admin' AND is_suspended = false
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete designers.';
  END IF;

  -- Ensure we don't accidentally delete an admin
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Cannot delete an administrator account.';
  END IF;

  -- Delete from auth.users (this cascades or we also delete from user_roles)
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

-- Grant execution to authenticated users (internal checks enforce admin only)
GRANT EXECUTE ON FUNCTION public.admin_create_designer(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_designer_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_designer(UUID) TO authenticated;
