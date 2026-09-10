-- Add BNI presentation date to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS bni_presentation_date date;

-- Create message_templates table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  message text NOT NULL,
  status public.lead_status NOT NULL,
  scenario public.call_outcome NOT NULL,
  followup_order int2 NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_templates_pkey PRIMARY KEY (id)
);

-- Enable RLS for message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to message_templates
CREATE POLICY "Enable read/write for authenticated users" 
ON public.message_templates 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Create lead_template_progress table
CREATE TABLE IF NOT EXISTS public.lead_template_progress (
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status public.lead_status NOT NULL,
  scenario public.call_outcome NOT NULL,
  last_order_used int2 NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lead_template_progress_pkey PRIMARY KEY (lead_id, status, scenario)
);

-- Enable RLS for lead_template_progress
ALTER TABLE public.lead_template_progress ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access to lead_template_progress
CREATE POLICY "Enable read/write for authenticated users" 
ON public.lead_template_progress 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
