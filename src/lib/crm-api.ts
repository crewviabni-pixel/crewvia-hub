import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_REMINDER_CONFIG,
  statusMeta,
  type Activity,
  type ActivityKind,
  type CallOutcome,
  type Lead,
  type LeadStatus,
  type MessageTemplate,
  type Payment,
  type PaymentCategory,
  type Reminder,
} from "@/lib/crm";

/* ---------------------------------- reads ----------------- */

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
  bni_presentation_date?: string | null;
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
      title: `Follow up with ${data.name || data.phone}`,
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
        title: config.titleTemplate.replace("{name}", lead.name || lead.phone),
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
      title: `Follow up with ${lead.name || lead.phone}`,
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

export async function editReminder(
  reminder: Reminder,
  patch: { title?: string; dueAt?: string },
) {
  const update: any = {};
  if (patch.title) update.title = patch.title;
  if (patch.dueAt) update.due_at = patch.dueAt;
  const { error } = await supabase
    .from("reminders")
    .update(update)
    .eq("id", reminder.id);
  if (error) throw error;
  await syncNextReminder(reminder.lead_id);
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

/* -------------------------------- templates -------------------------------- */

export async function fetchMessageTemplates() {
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .order("status")
    .order("scenario")
    .order("followup_order");
  if (error) throw error;
  return data;
}

export async function saveMessageTemplate(
  template: Partial<MessageTemplate> & { name: string; message: string; status: LeadStatus; scenario: CallOutcome; followup_order: number; is_active: boolean }
) {
  if (template.id) {
    const { error } = await supabase
      .from("message_templates")
      .update({
        name: template.name,
        message: template.message,
        status: template.status,
        scenario: template.scenario,
        followup_order: template.followup_order,
        is_active: template.is_active,
      })
      .eq("id", template.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("message_templates").insert(template);
    if (error) throw error;
  }
}

export async function deleteMessageTemplate(id: string) {
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function getNextMessageTemplate(leadId: string, status: LeadStatus, scenario: CallOutcome) {
  // Find current progress
  const { data: progress } = await supabase
    .from("lead_template_progress")
    .select("last_order_used")
    .eq("lead_id", leadId)
    .eq("status", status)
    .eq("scenario", scenario)
    .maybeSingle();

  const lastOrder = progress?.last_order_used ?? -1;

  // Find next template
  const { data: nextTemplate } = await supabase
    .from("message_templates")
    .select("*")
    .eq("status", status)
    .eq("scenario", scenario)
    .eq("is_active", true)
    .gt("followup_order", lastOrder)
    .order("followup_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  return nextTemplate;
}

export async function recordTemplateUsage(leadId: string, status: LeadStatus, scenario: CallOutcome, order: number) {
  const { error } = await supabase
    .from("lead_template_progress")
    .upsert(
      { lead_id: leadId, status, scenario, last_order_used: order },
      { onConflict: "lead_id,status,scenario" }
    );
  if (error) throw error;

  await logActivity({
    leadId,
    kind: "whatsapp",
    summary: "Message template copied",
    detail: `Scenario: ${scenario.replace(/_/g, " ")} (Order ${order})`,
  });
}

