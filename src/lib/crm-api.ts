import { supabase } from "@/integrations/supabase/client";
import type {
  Activity,
  ActivityKind,
  CallOutcome,
  Lead,
  LeadStatus,
  Payment,
  PaymentCategory,
  Reminder,
} from "@/lib/crm";
import { statusMeta, STATUS_REMINDER_CONFIG } from "@/lib/crm";

/* ---------------------------------- reads --------------------------------- */

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLead(id: string): Promise<Lead> {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function fetchActivities(leadId?: string): Promise<Activity[]> {
  let q = supabase.from("activities").select("*").order("created_at", { ascending: false });
  if (typeof leadId === "string") q = q.eq("lead_id", leadId);
  else q = q.limit(300);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .order("due_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPayments(leadId?: string): Promise<Payment[]> {
  let q = supabase.from("payments").select("*").order("paid_at", { ascending: false });
  if (typeof leadId === "string") q = q.eq("lead_id", leadId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/* -------------------------------- audit trail ------------------------------ */

export async function logActivity(input: {
  leadId: string;
  kind: ActivityKind;
  summary: string;
  detail?: string | null;
  meta?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("activities").insert({
    lead_id: input.leadId,
    kind: input.kind,
    summary: input.summary,
    detail: input.detail ?? null,
    meta: (input.meta ?? {}) as never,
  });
  if (error) throw error;
}

/* --------------------------------- writes --------------------------------- */

export type NewLeadInput = {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  city?: string;
  source: string;
  service?: string;
  status: LeadStatus;
  deal_value: number;
  notes?: string;
  firstReminderAt?: string | null;
};

export async function createLead(input: NewLeadInput): Promise<Lead> {
  const { firstReminderAt, ...rest } = input;
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...rest,
      email: rest.email || null,
      company: rest.company || null,
      city: rest.city || null,
      service: rest.service || null,
      notes: rest.notes || null,
      next_reminder_at: firstReminderAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await logActivity({
    leadId: data.id,
    kind: "lead_created",
    summary: `Lead added from ${data.source}`,
    detail: data.service ? `Interested in ${data.service}` : null,
    meta: { status: data.status, deal_value: data.deal_value },
  });

  if (firstReminderAt) {
    await createReminder({
      leadId: data.id,
      title: `Follow up with ${data.name}`,
      dueAt: firstReminderAt,
    });
  }
  return data;
}

export async function updateLeadFields(
  lead: Lead,
  patch: Partial<Lead>,
  summary = "Lead details updated",
) {
  const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
  if (error) throw error;
  const changed = Object.keys(patch).join(", ");
  await logActivity({
    leadId: lead.id,
    kind: "field_update",
    summary,
    detail: `Updated: ${changed}`,
    meta: patch as Record<string, unknown>,
  });
}

export async function deleteLead(leadId: string) {
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw error;
}

export async function changeStatus(
  lead: Lead,
  next: LeadStatus,
  note?: string,
  reminderAt?: string,
) {
  if (lead.status === next) return;
  const patch: Partial<Lead> = { status: next };
  if (next === "converted") patch.converted_at = new Date().toISOString();
  if (next === "lost") patch.lost_reason = note ?? lead.lost_reason ?? null;
  const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
  if (error) throw error;
  await logActivity({
    leadId: lead.id,
    kind: "status_change",
    summary: `${statusMeta(lead.status).label} → ${statusMeta(next).label}`,
    detail: note ?? null,
    meta: { from: lead.status, to: next },
  });

  // Auto-create reminder if a time was picked for this status
  if (reminderAt) {
    const config = STATUS_REMINDER_CONFIG[next];
    if (config) {
      await createReminder({
        leadId: lead.id,
        title: config.titleTemplate.replace("{name}", lead.name),
        dueAt: reminderAt,
      });
    }
  }
}

export async function logCall(
  lead: Lead,
  outcome: CallOutcome,
  note?: string,
  nextStatus?: LeadStatus,
  reminderAt?: string
) {
  const now = new Date().toISOString();
  const patch: Partial<Lead> = {
    call_count: lead.call_count + 1,
    last_call_at: now,
    last_call_outcome: outcome,
  };
  if (outcome === "connected") patch.last_contacted_at = now;
  if (nextStatus && nextStatus !== lead.status) {
    patch.status = nextStatus;
    if (nextStatus === "converted") patch.converted_at = now;
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
  if (error) throw error;

  await logActivity({
    leadId: lead.id,
    kind: "call",
    summary: `Call #${lead.call_count + 1} — ${outcome.replace(/_/g, " ")}`,
    detail: note ?? null,
    meta: { outcome, call_number: lead.call_count + 1 },
  });

  if (patch.status && patch.status !== lead.status) {
    await logActivity({
      leadId: lead.id,
      kind: "status_change",
      summary: `${statusMeta(lead.status).label} → ${statusMeta(patch.status).label}`,
      detail: "Updated from call outcome",
      meta: { from: lead.status, to: patch.status },
    });
  }

  if (reminderAt) {
    await createReminder({
      leadId: lead.id,
      title: `Follow up with ${lead.name}`,
      dueAt: reminderAt,
    });
  }
}

export async function recordPayment(
  lead: Lead, 
  amount: number, 
  method: string, 
  category: PaymentCategory,
  note?: string
) {
  const { error } = await supabase.from("payments").insert({
    lead_id: lead.id,
    amount,
    method,
    category,
    note: note ?? null,
  });
  if (error) throw error;
  await logActivity({
    leadId: lead.id,
    kind: "payment",
    summary: `${category} payment received via ${method}`,
    detail: note ?? null,
    meta: { amount, method, category },
  });
}

export async function deletePayment(payment: Payment) {
  const { error } = await supabase.from("payments").delete().eq("id", payment.id);
  if (error) throw error;
  await logActivity({
    leadId: payment.lead_id,
    kind: "payment",
    summary: "Payment entry removed",
    meta: { amount: payment.amount, removed: true },
  });
}

export async function addNote(lead: Lead, text: string) {
  await logActivity({ leadId: lead.id, kind: "note", summary: "Note added", detail: text });
}

export async function logWhatsapp(lead: Lead) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("leads")
    .update({ last_contacted_at: now })
    .eq("id", lead.id);
  if (error) throw error;
  await logActivity({ leadId: lead.id, kind: "whatsapp", summary: "WhatsApp message opened" });
}

/* -------------------------------- reminders -------------------------------- */

export async function createReminder(input: { leadId: string; title: string; dueAt: string }) {
  const { error } = await supabase.from("reminders").insert({
    lead_id: input.leadId,
    title: input.title,
    due_at: input.dueAt,
  });
  if (error) throw error;
  await syncNextReminder(input.leadId);
  await logActivity({
    leadId: input.leadId,
    kind: "reminder_set",
    summary: `Reminder set — ${input.title}`,
    detail: new Date(input.dueAt).toLocaleString("en-IN"),
    meta: { due_at: input.dueAt },
  });
}

export async function completeReminder(reminder: Reminder) {
  const { error } = await supabase
    .from("reminders")
    .update({ state: "done", completed_at: new Date().toISOString() })
    .eq("id", reminder.id);
  if (error) throw error;
  await syncNextReminder(reminder.lead_id);
  await logActivity({
    leadId: reminder.lead_id,
    kind: "reminder_done",
    summary: `Reminder completed — ${reminder.title}`,
  });
}

export async function snoozeReminder(reminder: Reminder, dueAt: string) {
  const { error } = await supabase
    .from("reminders")
    .update({ due_at: dueAt, state: "pending" })
    .eq("id", reminder.id);
  if (error) throw error;
  await syncNextReminder(reminder.lead_id);
  await logActivity({
    leadId: reminder.lead_id,
    kind: "reminder_snoozed",
    summary: `Reminder moved — ${reminder.title}`,
    detail: new Date(dueAt).toLocaleString("en-IN"),
    meta: { due_at: dueAt },
  });
}

export async function cancelReminder(reminder: Reminder) {
  const { error } = await supabase
    .from("reminders")
    .update({ state: "cancelled" })
    .eq("id", reminder.id);
  if (error) throw error;
  await syncNextReminder(reminder.lead_id);
  await logActivity({
    leadId: reminder.lead_id,
    kind: "reminder_snoozed",
    summary: `Reminder cancelled — ${reminder.title}`,
  });
}

export async function cancelAllReminders(leadId: string) {
  const { error } = await supabase
    .from("reminders")
    .update({ state: "cancelled" })
    .eq("lead_id", leadId)
    .eq("state", "pending");
  if (error) throw error;
  await syncNextReminder(leadId);
}

/** Keeps leads.next_reminder_at aligned with the earliest open reminder. */
async function syncNextReminder(leadId: string) {
  const { data } = await supabase
    .from("reminders")
    .select("due_at")
    .eq("lead_id", leadId)
    .eq("state", "pending")
    .order("due_at", { ascending: true })
    .limit(1);
  await supabase
    .from("leads")
    .update({ next_reminder_at: data?.[0]?.due_at ?? null })
    .eq("id", leadId);
}
