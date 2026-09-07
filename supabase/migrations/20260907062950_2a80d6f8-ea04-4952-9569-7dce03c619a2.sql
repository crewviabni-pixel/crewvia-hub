
CREATE TYPE public.lead_status AS ENUM ('new','contacted','interested','follow_up','negotiation','converted','lost');
CREATE TYPE public.payment_status AS ENUM ('unpaid','partial','paid');
CREATE TYPE public.call_outcome AS ENUM ('connected','no_answer','busy','wrong_number','switched_off','callback_later');
CREATE TYPE public.reminder_state AS ENUM ('pending','done','snoozed','cancelled');
CREATE TYPE public.activity_kind AS ENUM ('lead_created','status_change','call','payment','note','reminder_set','reminder_done','reminder_snoozed','field_update','whatsapp');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  company text,
  city text,
  source text NOT NULL DEFAULT 'BNI',
  service text,
  status public.lead_status NOT NULL DEFAULT 'new',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  deal_value numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  call_count integer NOT NULL DEFAULT 0,
  last_call_at timestamptz,
  last_call_outcome public.call_outcome,
  last_contacted_at timestamptz,
  next_reminder_at timestamptz,
  converted_at timestamptz,
  lost_reason text,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_status_idx ON public.leads(status);
CREATE INDEX leads_created_idx ON public.leads(created_at DESC);
CREATE INDEX leads_reminder_idx ON public.leads(next_reminder_at);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  kind public.activity_kind NOT NULL,
  summary text NOT NULL,
  detail text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_lead_idx ON public.activities(lead_id, created_at DESC);
CREATE INDEX activities_created_idx ON public.activities(created_at DESC);

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  state public.reminder_state NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminders_due_idx ON public.reminders(due_at);
CREATE INDEX reminders_state_idx ON public.reminders(state);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text NOT NULL DEFAULT 'upi',
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_lead_idx ON public.payments(lead_id);
CREATE INDEX payments_paid_idx ON public.payments(paid_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.leads, public.activities, public.reminders, public.payments TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team can manage leads" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can manage activities" ON public.activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can manage reminders" ON public.reminders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "team can manage payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER reminders_touch BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- keep payment rollups accurate from the payments ledger
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
      ELSE 'partial'::public.payment_status END
  WHERE id = target;
  RETURN NULL;
END; $$;

CREATE TRIGGER payments_sync AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_payments();
