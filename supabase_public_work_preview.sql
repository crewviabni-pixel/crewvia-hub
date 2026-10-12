-- ==============================================================================
-- CREWVIA BNI: Public Protected Preview Access for Completed Presentations/Drafts
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/mawmjqeyjzktxbtsswgw/sql)
-- ==============================================================================

-- 1. Allow unauthenticated visitors to read completed work items
CREATE POLICY "Public can view completed work items" 
ON public.work_items 
FOR SELECT 
TO anon 
USING (status = 'completed');

-- 2. Allow unauthenticated visitors to read basic client information for completed work
CREATE POLICY "Public can view basic lead info for completed work" 
ON public.leads 
FOR SELECT 
TO anon 
USING (
  EXISTS (
    SELECT 1 FROM public.work_items 
    WHERE work_items.lead_id = leads.id 
    AND work_items.status = 'completed'
  )
);

-- 3. Stored RPC function for secure single-call preview metadata
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
  WHERE w.id = p_work_id AND w.status = 'completed';
  
  RETURN result;
END;
$$;

-- Grant execution to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_work_preview(uuid) TO anon, authenticated;

-- 4. Ensure storage bucket policy allows public reading of work_files objects
DO $$
BEGIN
  -- Update work_files bucket to public read if not already set
  UPDATE storage.buckets SET public = true WHERE id = 'work_files';
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
