CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to workspaces" ON public.workspaces FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Designers can read workspaces" ON public.workspaces FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'designer')
);

DO $$
DECLARE
  default_ws_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE name = 'old') THEN
    INSERT INTO public.workspaces (name) VALUES ('old') RETURNING id INTO default_ws_id;
  ELSE
    SELECT id INTO default_ws_id FROM public.workspaces WHERE name = 'old' LIMIT 1;
  END IF;

  -- Add workspace_id to leads
  BEGIN
    ALTER TABLE public.leads ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_column THEN
    -- Column exists, do nothing
  END;

  UPDATE public.leads SET workspace_id = default_ws_id WHERE workspace_id IS NULL;
  
  -- Add workspace_id to message_templates
  BEGIN
    ALTER TABLE public.message_templates ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_column THEN
    -- Column exists, do nothing
  END;
  
  UPDATE public.message_templates SET workspace_id = default_ws_id WHERE workspace_id IS NULL;
END $$;

-- Update the view to include workspace_id
CREATE OR REPLACE VIEW public.designer_leads_view AS
SELECT
  id,
  workspace_id,
  bni_presentation_date,
  call_count,
  city,
  company,
  converted_at,
  created_at,
  email,
  last_call_at,
  last_call_outcome,
  last_contacted_at,
  lost_reason,
  name,
  next_reminder_at,
  notes,
  owner_id,
  service,
  source,
  status,
  updated_at
FROM public.leads;
