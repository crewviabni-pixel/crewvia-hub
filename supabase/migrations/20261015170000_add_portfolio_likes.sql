-- ==============================================================================
-- Add like_count and increment_portfolio_likes RPC to portfolio_items
-- ==============================================================================

-- 1. Add like_count column if not exists
ALTER TABLE public.portfolio_items 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- 2. Stored RPC to increment or decrement like count securely
CREATE OR REPLACE FUNCTION public.increment_portfolio_likes(p_id UUID, p_delta INTEGER DEFAULT 1)
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
