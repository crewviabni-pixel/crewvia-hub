-- ==============================================================================
-- CREWVIA BNI CRM: PRODUCTION DESIGNER USER PROVISIONING & RBAC RPC (WITH CAMPAIGN ASSIGNMENT)
-- ==============================================================================
-- Enables extensions schema in search_path, references extensions.crypt/gen_salt,
-- handles user_roles upsert safely, and implements campaign (workspace) isolation.
-- Run this in your Supabase SQL Editor once.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Designer Workspaces Junction Table
CREATE TABLE IF NOT EXISTS public.designer_workspaces (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, workspace_id)
);

ALTER TABLE public.designer_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to designer_workspaces" ON public.designer_workspaces;
CREATE POLICY "Admins have full access to designer_workspaces" ON public.designer_workspaces
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Designers can read own assigned workspaces" ON public.designer_workspaces;
CREATE POLICY "Designers can read own assigned workspaces" ON public.designer_workspaces
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Update workspaces RLS so designers can only read assigned workspaces
DROP POLICY IF EXISTS "Designers can read workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Designers can read assigned workspaces" ON public.workspaces;
CREATE POLICY "Designers can read assigned workspaces" ON public.workspaces
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.designer_workspaces dw
    WHERE dw.workspace_id = public.workspaces.id AND dw.user_id = auth.uid()
  )
);

-- 2. admin_create_designer (supports optional initial workspace assignment)
CREATE OR REPLACE FUNCTION public.admin_create_designer(
  p_username TEXT,
  p_password TEXT,
  p_name TEXT DEFAULT '',
  p_workspace_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_new_user_id UUID;
  v_email TEXT;
  v_clean_username TEXT;
  v_clean_name TEXT;
  v_hashed_pw TEXT;
  v_ws_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Verify caller is admin
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

  -- Clean up any orphaned user in auth.users that has no role in public.user_roles
  DELETE FROM auth.identities 
  WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE lower(email) = lower(v_email) 
      AND id NOT IN (SELECT user_id FROM public.user_roles)
  );

  DELETE FROM auth.users 
  WHERE lower(email) = lower(v_email) 
    AND id NOT IN (SELECT user_id FROM public.user_roles);

  -- Check if email already exists in auth.users
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE lower(email) = lower(v_email)
  ) THEN
    RAISE EXCEPTION 'A user with email "%" already exists in authentication.', v_email;
  END IF;

  v_new_user_id := gen_random_uuid();
  v_hashed_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- Insert directly into auth.users with pre-confirmed email
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

  -- Insert identity into auth.identities
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
    v_new_user_id::text,
    now(),
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  -- Insert into public.user_roles (safely handles any auth.users trigger that may auto-insert)
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
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'designer',
    username = EXCLUDED.username,
    is_suspended = false;

  -- Assign workspaces if provided
  IF p_workspace_ids IS NOT NULL AND array_length(p_workspace_ids, 1) > 0 THEN
    FOREACH v_ws_id IN ARRAY p_workspace_ids
    LOOP
      IF v_ws_id IS NOT NULL THEN
        INSERT INTO public.designer_workspaces (user_id, workspace_id)
        VALUES (v_new_user_id, v_ws_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'username', v_clean_username,
    'name', v_clean_name,
    'email', v_email
  );
END;
$$;

-- 3. admin_assign_designer_workspaces
CREATE OR REPLACE FUNCTION public.admin_assign_designer_workspaces(
  p_user_id UUID,
  p_workspace_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_ws_id UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_caller_id AND role = 'admin' AND is_suspended = false
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can assign campaigns.';
  END IF;

  -- Delete existing assignments for this user
  DELETE FROM public.designer_workspaces WHERE user_id = p_user_id;

  -- Insert new assignments
  IF p_workspace_ids IS NOT NULL THEN
    FOREACH v_ws_id IN ARRAY p_workspace_ids
    LOOP
      IF v_ws_id IS NOT NULL THEN
        INSERT INTO public.designer_workspaces (user_id, workspace_id)
        VALUES (p_user_id, v_ws_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'assigned_count', coalesce(array_length(p_workspace_ids, 1), 0));
END;
$$;

-- 4. admin_reset_designer_password
CREATE OR REPLACE FUNCTION public.admin_reset_designer_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id UUID;
  v_hashed_pw TEXT;
BEGIN
  v_caller_id := auth.uid();

  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_caller_id AND role = 'admin' AND is_suspended = false
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can reset designer passwords.';
  END IF;

  IF length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'New password must be at least 6 characters long.';
  END IF;

  v_hashed_pw := extensions.crypt(p_new_password, extensions.gen_salt('bf'));

  UPDATE auth.users
  SET encrypted_password = v_hashed_pw,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

-- 5. admin_delete_designer
CREATE OR REPLACE FUNCTION public.admin_delete_designer(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
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

  DELETE FROM public.designer_workspaces WHERE user_id = p_user_id;
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_designer(TEXT, TEXT, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_designer_workspaces(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_designer_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_designer(UUID) TO authenticated;
