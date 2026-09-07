import type { Database } from "@/integrations/supabase/types";

export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];

export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type PaymentCategory = Database["public"]["Enums"]["payment_category"];
export type CallOutcome = Database["public"]["Enums"]["call_outcome"];
export type ActivityKind = Database["public"]["Enums"]["activity_kind"];

export const LEAD_STATUSES: { value: LeadStatus; label: string; tone: string }[] = [
  { value: "info_taken", label: "Info Taken", tone: "bg-sky-100 text-sky-900 border-sky-300" },
  { value: "draft_sent", label: "Draft Sent", tone: "bg-indigo-100 text-indigo-900 border-indigo-300" },
  { value: "approved", label: "Approved", tone: "bg-amber-100 text-amber-900 border-amber-300" },
  { value: "advance_received", label: "Advance Rec.", tone: "bg-orange-100 text-orange-900 border-orange-300" },
  { value: "presentation_sent", label: "Presentation Sent", tone: "bg-violet-100 text-violet-900 border-violet-300" },
  { value: "converted", label: "Converted", tone: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { value: "lost", label: "Lost", tone: "bg-rose-100 text-rose-900 border-rose-300" },
];

/** Config for auto-reminder on status change. Terminal statuses (converted/lost) have no config. */
export const STATUS_REMINDER_CONFIG: Partial<
  Record<LeadStatus, { prompt: string; titleTemplate: string }>
> = {
  info_taken: {
    prompt: "When should you send the draft?",
    titleTemplate: "Send draft to {name}",
  },
  draft_sent: {
    prompt: "When should you follow up?",
    titleTemplate: "Follow up with {name}",
  },
  approved: {
    prompt: "When should you collect the advance?",
    titleTemplate: "Collect advance from {name}",
  },
  advance_received: {
    prompt: "When should you send the presentation?",
    titleTemplate: "Send presentation to {name}",
  },
  presentation_sent: {
    prompt: "When should you collect payment?",
    titleTemplate: "Collect payment from {name}",
  },
};

export const NEXT_STATUS_MAP: Partial<Record<LeadStatus, LeadStatus>> = {
  info_taken: "draft_sent",
  draft_sent: "approved",
  approved: "advance_received",
  advance_received: "presentation_sent",
  presentation_sent: "converted",
};

export type SmartActionType = "send" | "call" | "payment" | "generic";

export const ACTION_CONFIG: Record<LeadStatus, { type: SmartActionType; label: string; category?: PaymentCategory }> = {
  info_taken: { type: "send", label: "Send Draft" },
  draft_sent: { type: "call", label: "Log Call" },
  approved: { type: "payment", label: "Record Advance", category: "advance" },
  advance_received: { type: "send", label: "Send Presentation" },
  presentation_sent: { type: "payment", label: "Record Final", category: "full" },
  converted: { type: "generic", label: "Done" },
  lost: { type: "generic", label: "Done" },
};

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string; tone: string }[] = [
  { value: "unpaid", label: "Unpaid", tone: "bg-rose-100 text-rose-900 border-rose-300" },
  { value: "partial", label: "Partial", tone: "bg-amber-100 text-amber-900 border-amber-300" },
  { value: "paid", label: "Paid", tone: "bg-emerald-100 text-emerald-900 border-emerald-300" },
];

export const CALL_OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "no_answer", label: "No answer" },
  { value: "busy", label: "Busy" },
  { value: "switched_off", label: "Switched off" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "callback_later", label: "Call back later" },
];

export const LEAD_SOURCES = [
  "BNI",
  "Referral",
  "Walk-in",
  "Website",
  "Instagram",
  "WhatsApp",
  "Cold call",
  "Other",
];

export const PAYMENT_METHODS = ["upi", "cash", "bank transfer", "card", "cheque", "other"];

export function statusMeta(status: LeadStatus) {
  return LEAD_STATUSES.find((s) => s.value === status) ?? LEAD_STATUSES[0]!;
}

export function paymentMeta(status: PaymentStatus) {
  return PAYMENT_STATUSES.find((s) => s.value === status) ?? PAYMENT_STATUSES[0]!;
}

export function outcomeLabel(outcome: CallOutcome | null) {
  if (!outcome) return null;
  return CALL_OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome;
}

export function digitsOnly(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

/** Indian numbers are stored loosely; normalise to an international WhatsApp target. */
export function waNumber(phone: string) {
  const d = digitsOnly(phone);
  if (d.length === 10) return `91${d}`;
  return d;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

export function waHref(phone: string, text?: string) {
  const base = `https://wa.me/${waNumber(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  lead_created: "Lead added",
  status_change: "Status changed",
  call: "Call logged",
  payment: "Payment recorded",
  note: "Note added",
  reminder_set: "Reminder set",
  reminder_done: "Reminder completed",
  reminder_snoozed: "Reminder snoozed",
  field_update: "Details updated",
  whatsapp: "WhatsApp opened",
};
