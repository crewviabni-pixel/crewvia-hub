-- ==============================================================================
-- CREWVIA BNI CRM: Portfolio Showcase & Presentation Management System
-- Run this in your Supabase SQL Editor if running migrations manually.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  client_name TEXT,
  category TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  cover_image_url TEXT NOT NULL,
  slides JSONB DEFAULT '[]'::jsonb,
  pdf_url TEXT,
  metrics JSONB DEFAULT '[]'::jsonb,
  slide_count INTEGER DEFAULT 1,
  featured BOOLEAN DEFAULT false,
  published BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  work_item_id UUID REFERENCES public.work_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure like_count exists if table already created previously
ALTER TABLE public.portfolio_items ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published portfolio items" ON public.portfolio_items;
CREATE POLICY "Anyone can view published portfolio items"
ON public.portfolio_items
FOR SELECT
TO anon, authenticated
USING (published = true);

DROP POLICY IF EXISTS "Admins have full access to portfolio_items" ON public.portfolio_items;
CREATE POLICY "Admins have full access to portfolio_items"
ON public.portfolio_items
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE OR REPLACE FUNCTION public.increment_portfolio_views(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.portfolio_items
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_portfolio_views(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_portfolio_likes(p_id UUID, p_delta INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.portfolio_items
  SET like_count = GREATEST(0, COALESCE(like_count, 0) + p_delta)
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_portfolio_likes(UUID, INTEGER) TO anon, authenticated;
