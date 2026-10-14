-- ==============================================================================
-- CREWVIA BNI CRM: WORKSPACE / CAMPAIGN DEFAULT PRICE CONFIGURATION
-- ==============================================================================
-- Adds default_price numeric column to public.workspaces with default 10000.
-- Admins have full access through existing workspaces RLS policy.

ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS default_price NUMERIC DEFAULT 10000;

COMMENT ON COLUMN public.workspaces.default_price IS 'Default product deal value for leads created or imported into this campaign';
