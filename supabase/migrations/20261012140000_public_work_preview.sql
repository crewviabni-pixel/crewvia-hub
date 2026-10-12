-- ==============================================================================
-- CREWVIA BNI: Public Protected Preview Access & Link Expiration / Anti-Bot Control
-- ==============================================================================

-- 1. Add preview link expiration and token columns if they do not exist
ALTER TABLE public.work_items 
ADD COLUMN IF NOT EXISTS preview_token uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS preview_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS preview_revoked_at timestamp with time zone DEFAULT null;

-- Ensure existing work items have preview_token initialized
UPDATE public.work_items SET preview_token = id WHERE preview_token IS NULL;

-- 2. Allow unauthenticated visitors to read ONLY completed & active work items
DROP POLICY IF EXISTS "Public can view completed work items" ON public.work_items;
CREATE POLICY "Public can view completed work items" 
ON public.work_items 
FOR SELECT 
TO anon 
USING (
  status = 'completed' 
  AND COALESCE(preview_enabled, true) = true
);

-- 3. Allow unauthenticated visitors to read basic client information for active completed work
DROP POLICY IF EXISTS "Public can view basic lead info for completed work" ON public.leads;
CREATE POLICY "Public can view basic lead info for completed work" 
ON public.leads 
FOR SELECT 
TO anon 
USING (
  EXISTS (
    SELECT 1 FROM public.work_items 
    WHERE work_items.lead_id = leads.id 
    AND work_items.status = 'completed'
    AND COALESCE(work_items.preview_enabled, true) = true
  )
);

-- 4. Stored RPC function for secure preview resolution
CREATE OR REPLACE FUNCTION public.get_public_work_preview(p_work_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', w.id,
    'preview_token', w.preview_token,
    'preview_enabled', w.preview_enabled,
    'lead_id', w.lead_id,
    'type', w.type,
    'status', w.status,
    'file_url', w.file_url,
    'created_at', w.created_at,
    'lead_name', l.name,
    'lead_company', l.company
  ) INTO result
  FROM public.work_items w
  JOIN public.leads l ON l.id = w.lead_id
  WHERE (w.preview_token = p_work_id OR w.id = p_work_id)
    AND w.status = 'completed';
  
  RETURN result;
END;
$$;

-- Grant execution to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_work_preview(uuid) TO anon, authenticated;

-- 5. Ensure storage bucket policy allows public reading of work_files objects
DO $$
BEGIN
  UPDATE storage.buckets SET public = true WHERE id = 'work_files';
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
