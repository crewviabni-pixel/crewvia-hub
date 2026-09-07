-- Migration: Replace lead_status enum with new Crewvia pipeline statuses
-- Also fix sync_lead_payments() trigger to handle deal_value=0 correctly

-- Step 1: Create the new enum
CREATE TYPE public.lead_status_new AS ENUM (
  'info_taken',
  'draft_sent',
  'approved',
  'advance_received',
  'presentation_sent',
  'converted',
  'lost'
);

-- Step 2: Migrate existing leads to new statuses
-- Map: new/contacted → info_taken, interested/follow_up → draft_sent, negotiation → approved
ALTER TABLE public.leads
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.leads
  ALTER COLUMN status TYPE public.lead_status_new
  USING CASE status::text
    WHEN 'new' THEN 'info_taken'::public.lead_status_new
    WHEN 'contacted' THEN 'info_taken'::public.lead_status_new
    WHEN 'interested' THEN 'draft_sent'::public.lead_status_new
    WHEN 'follow_up' THEN 'draft_sent'::public.lead_status_new
    WHEN 'negotiation' THEN 'approved'::public.lead_status_new
    WHEN 'converted' THEN 'converted'::public.lead_status_new
    WHEN 'lost' THEN 'lost'::public.lead_status_new
    ELSE 'info_taken'::public.lead_status_new
  END;

ALTER TABLE public.leads
  ALTER COLUMN status SET DEFAULT 'info_taken'::public.lead_status_new;

-- Step 3: Drop old enum and rename new one
DROP TYPE public.lead_status;
ALTER TYPE public.lead_status_new RENAME TO lead_status;

-- Step 4: Fix sync_lead_payments() to handle deal_value=0 correctly
-- When deal_value is 0 (not set) and payments exist, treat as 'paid' not 'partial'
CREATE OR REPLACE FUNCTION public.sync_lead_payments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid; total numeric; value numeric;
BEGIN
  target := COALESCE(NEW.lead_id, OLD.lead_id);
  SELECT COALESCE(SUM(amount),0) INTO total FROM public.payments WHERE lead_id = target;
  SELECT deal_value INTO value FROM public.leads WHERE id = target;
  UPDATE public.leads SET
    amount_paid = total,
    payment_status = CASE
      WHEN total <= 0 THEN 'unpaid'::public.payment_status
      WHEN value > 0 AND total >= value THEN 'paid'::public.payment_status
      WHEN value <= 0 AND total > 0 THEN 'paid'::public.payment_status
      ELSE 'partial'::public.payment_status END
  WHERE id = target;
  RETURN NULL;
END; $$;
