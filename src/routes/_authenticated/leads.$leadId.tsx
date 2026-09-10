import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  BellRing,
  Check,
  Edit2,
  IndianRupee,
  MessageCircle,
  Phone,
  PhoneCall,
  Trash2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PaymentPill, StatusPill } from "@/components/crm-ui";
import {
  CallOutcomeDialog,
  PaymentDialog,
  ReminderDialog,
  StatusChangeDialog,
  useCrmRefresh,
  SmartActionDialog,
} from "@/components/lead-dialogs";
import {
  ACTIVITY_LABEL,
  LEAD_SOURCES,
  LEAD_STATUSES,
  money,
  outcomeLabel,
  telHref,
  waHref,
  ACTION_CONFIG,
  type Lead,
  type LeadStatus,
  type Reminder,
} from "@/lib/crm";
import {
  addNote,
  cancelReminder,
  completeReminder,
  deleteLead,
  deletePayment,
  fetchActivities,
  fetchLead,
  fetchPayments,
  fetchReminders,
  logWhatsapp,
  updateLeadFields,
} from "@/lib/crm-api";

export const Route = createFileRoute("/_authenticated/leads/$leadId")({
  head: () => ({
    meta: [
      { title: "Lead details — Crewvia BNI CRM" },
      {
        name: "description",
        content: "Full lead profile with call history, payments, reminders and complete audit trail.",
      },
      { property: "og:title", content: "Lead details — Crewvia BNI CRM" },
      { property: "og:description", content: "Call history, payments, reminders and audit trail." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadDetail,
});

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function LeadDetail() {
  const { leadId } = useParams({ from: "/_authenticated/leads/$leadId" });
  const refresh = useCrmRefresh();

  const { data: lead, isLoading } = useQuery({
    queryKey: ["leads", leadId],
    queryFn: () => fetchLead(leadId),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", leadId],
    queryFn: () => fetchActivities(leadId),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", leadId],
    queryFn: () => fetchPayments(leadId),
  });
  const { data: allReminders = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: fetchReminders,
  });

  const [callOpen, setCallOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<LeadStatus | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Lead>>({});
  const [completing, setCompleting] = useState<Reminder | null>(null);
  const saveNote = useMutation({
    mutationFn: () => addNote(lead!, note.trim()),
    onSuccess: () => {
      setNote("");
      refresh();
      toast.success("Note saved");
    },
  });
  const saveFields = useMutation({
    mutationFn: () => updateLeadFields(lead!, draft),
    onSuccess: () => {
      setEditing(false);
      setDraft({});
      refresh();
      toast.success("Lead updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const whatsapp = useMutation({ mutationFn: () => logWhatsapp(lead!), onSuccess: refresh });

  const dropReminder = useMutation({
    mutationFn: (id: string) => cancelReminder(allReminders.find((r) => r.id === id)!),
    onSuccess: refresh,
  });
  const removePayment = useMutation({
    mutationFn: (id: string) => deletePayment(payments.find((p) => p.id === id)!),
    onSuccess: () => {
      refresh();
      toast.success("Payment removed");
    },
  });

  const navigate = useNavigate();
  const deleteMut = useMutation({
    mutationFn: async () => {
      if (confirm("Are you sure you want to delete this lead? This action cannot be undone.")) {
        await deleteLead(leadId);
        return true;
      }
      return false;
    },
    onSuccess: (deleted) => {
      if (deleted) {
        toast.success("Lead deleted");
        navigate({ to: "/leads" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !lead) {
    return (
      <AppShell title="Loading Lead">
        <div className="grid gap-4 lg:grid-cols-3 animate-pulse">
          <div className="space-y-4 lg:col-span-2">
            <div className="h-32 rounded-xl bg-card border border-border flex items-center justify-center">
              <div className="h-8 w-1/3 bg-primary/10 rounded-md" />
            </div>
            <div className="h-64 rounded-xl bg-card border border-border" />
          </div>
          <div className="space-y-4">
            <div className="h-48 rounded-xl bg-sidebar border border-border" />
            <div className="h-48 rounded-xl bg-sidebar border border-border" />
          </div>
        </div>
      </AppShell>
    );
  }

  const reminders = allReminders.filter((r) => r.lead_id === lead.id);
  const openReminders = reminders.filter((r) => r.state === "pending");
  const pending = Number(lead.deal_value) - Number(lead.amount_paid);
  const value = <K extends keyof Lead>(key: K) => (draft[key] ?? lead[key]) as Lead[K];

  return (
    <AppShell title={lead.name || lead.phone} subtitle={`${lead.name ? lead.phone + " · " : ""}added ${format(new Date(lead.created_at), "d MMM yyyy")}`}>
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All leads
        </Link>
        <button
          onClick={() => deleteMut.mutate()}
          disabled={deleteMut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" /> Delete lead
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* quick actions */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={lead.status} />
              <PaymentPill status={lead.payment_status} />
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {lead.source}
              </span>
              {lead.last_call_at ? (
                <span className="text-xs text-muted-foreground">
                  Last call {formatDistanceToNow(new Date(lead.last_call_at), { addSuffix: true })}
                  {outcomeLabel(lead.last_call_outcome) ? ` · ${outcomeLabel(lead.last_call_outcome)}` : ""}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={telHref(lead.phone)}
                onClick={() => setCallOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                <Phone className="size-3.5" /> Call {lead.phone}
              </a>
              <a
                href={waHref(lead.phone, `Hi${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}, this is Crewvia BNI.`)}
                target="_blank"
                rel="noreferrer"
                onClick={() => whatsapp.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900"
              >
                <MessageCircle className="size-3.5" /> WhatsApp
              </a>
              <button
                onClick={() => setCallOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                <PhoneCall className="size-3.5" /> Log call
              </button>
              <button
                onClick={() => setRemindOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                <BellRing className="size-3.5" /> Reminder
              </button>
              <button
                onClick={() => setPayOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                <IndianRupee className="size-3.5" /> Payment
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => s.value !== lead.status && setStatusTarget(s.value)}
                  disabled={s.value === lead.status}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    s.value === lead.status ? s.tone : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* details */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Details</h2>
              <button
                onClick={() => {
                  setEditing((v) => !v);
                  setDraft({});
                }}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {editing ? "Cancel" : "Edit"}
              </button>
            </div>

            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["name", "Name"],
                    ["phone", "Phone"],
                    ["email", "Email"],
                    ["company", "Company"],
                    ["city", "City"],
                    ["service", "Service"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {label}
                    </label>
                    <input
                      className={fieldClass}
                      value={(value(key) as string | null) ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Source
                  </label>
                  <select
                    className={fieldClass}
                    value={value("source")}
                    onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Deal value (₹)
                  </label>
                  <input
                    className={fieldClass}
                    inputMode="numeric"
                    value={String(value("deal_value"))}
                    onChange={(e) => setDraft((d) => ({ ...d, deal_value: Number(e.target.value) }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Notes
                  </label>
                  <textarea
                    className={fieldClass}
                    rows={3}
                    value={(value("notes") as string | null) ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    onClick={() => saveFields.mutate()}
                    disabled={saveFields.isPending || Object.keys(draft).length === 0}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Field label="Email" value={lead.email} />
                <Field label="Company" value={lead.company} />
                <Field label="City" value={lead.city} />
                <Field label="Service" value={lead.service} />
                <Field label="Deal value" value={money(lead.deal_value)} />
                <Field label="Pending" value={money(pending)} />
                <Field label="Total calls" value={String(lead.call_count)} />
                <Field
                  label="Last contacted"
                  value={
                    lead.last_contacted_at
                      ? format(new Date(lead.last_contacted_at), "d MMM yyyy, h:mm a")
                      : null
                  }
                />
                {lead.notes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notes
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap">{lead.notes}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </div>

          {/* timeline */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">
              Timeline & audit trail ({activities.length})
            </h2>
            <div className="mb-4 flex gap-2">
              <input
                className={fieldClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note to the timeline…"
              />
              <button
                onClick={() => saveNote.mutate()}
                disabled={!note.trim() || saveNote.isPending}
                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-accent" />
                    <p className="text-sm font-semibold">{a.summary}</p>
                    {a.detail ? (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.detail}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {ACTIVITY_LABEL[a.kind]} · {format(new Date(a.created_at), "d MMM yyyy, h:mm a")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Payments</h2>
            <p className="text-sm text-muted-foreground">
              {money(lead.amount_paid)} collected of {money(lead.deal_value)}
            </p>
            <div className="mt-3 space-y-2">
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{money(p.amount)}</p>
                        {p.category ? (
                          <span className="rounded-sm bg-secondary px-1 py-0.5 text-[10px] font-medium uppercase text-secondary-foreground">
                            {p.category}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                        {p.method} · {format(new Date(p.paid_at), "d MMM yyyy")}
                      </p>
                    </div>
                    <button
                      onClick={() => removePayment.mutate(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove payment"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">
              Reminders ({openReminders.length} open)
            </h2>
            <div className="space-y-2">
              {reminders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reminders yet.</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {r.state} · {format(new Date(r.due_at), "d MMM, h:mm a")}
                    </p>
                    {r.state === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        {(() => {
                          const action = lead ? ACTION_CONFIG[lead.status] : null;
                          let Icon = Check;
                          if (action?.type === "send") Icon = Send;
                          if (action?.type === "call") Icon = PhoneCall;
                          if (action?.type === "payment") Icon = IndianRupee;

                          return (
                            <button
                              onClick={() => setCompleting(r)}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm"
                            >
                              <Icon className="size-3" /> {action?.label || "Done"}
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => dropReminder.mutate(r.id)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <CallOutcomeDialog lead={lead} open={callOpen} onOpenChange={setCallOpen} />
      <PaymentDialog lead={lead} open={payOpen} onOpenChange={setPayOpen} />
      <ReminderDialog lead={lead} open={remindOpen} onOpenChange={setRemindOpen} />
      <StatusChangeDialog
        lead={lead}
        nextStatus={statusTarget}
        open={!!statusTarget}
        onOpenChange={(v) => !v && setStatusTarget(null)}
      />
      <SmartActionDialog
        lead={lead}
        reminder={completing}
        open={!!completing}
        onOpenChange={(v) => !v && setCompleting(null)}
      />
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}
