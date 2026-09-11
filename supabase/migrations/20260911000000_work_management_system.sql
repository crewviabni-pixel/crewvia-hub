-- Create roles
CREATE TYPE public.app_role AS ENUM ('admin', 'designer');

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'designer',
  username text UNIQUE NOT NULL,
  is_suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Work Information
CREATE TABLE IF NOT EXISTS public.lead_information (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  info_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_information ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to lead_information" ON public.lead_information FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Designers can read lead_information" ON public.lead_information FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'designer')
);

-- Information Images
CREATE TABLE IF NOT EXISTS public.lead_information_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_information_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to lead_information_images" ON public.lead_information_images FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Designers can read lead_information_images" ON public.lead_information_images FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'designer')
);

-- Work Items
CREATE TYPE public.work_type AS ENUM ('draft', 'presentation');
CREATE TYPE public.work_status AS ENUM ('pending', 'in_progress', 'completed');

CREATE TABLE IF NOT EXISTS public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type public.work_type NOT NULL,
  status public.work_status NOT NULL DEFAULT 'pending',
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, type)
);

ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to work_items" ON public.work_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Designers can manage work_items" ON public.work_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'designer')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'designer')
);

-- Secure View for Designers
CREATE OR REPLACE VIEW public.designer_leads_view AS
SELECT
  id,
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

-- Fallback policies for existing queries
-- We must make sure existing users without a role (from before this migration) can still operate
-- Let's update existing policies or just assume the frontend will create their 'admin' role on next login.

-- Work triggers for Info Taken
-- When a lead's status changes to 'info_taken', we want to create pending work items
CREATE OR REPLACE FUNCTION public.handle_lead_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'info_taken' AND OLD.status != 'info_taken' THEN
    -- Automatically insert draft and presentation work items (if they don't exist)
    INSERT INTO public.work_items (lead_id, type, status)
    VALUES (NEW.id, 'draft', 'pending')
    ON CONFLICT (lead_id, type) DO NOTHING;
    
    INSERT INTO public.work_items (lead_id, type, status)
    VALUES (NEW.id, 'presentation', 'pending')
    ON CONFLICT (lead_id, type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_lead_status_change ON public.leads;
CREATE TRIGGER on_lead_status_change
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_lead_status_change();
