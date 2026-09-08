import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, isToday } from "date-fns";
import { Check, Clock, MessageCircle, Pencil, Phone, Send, PhoneCall, IndianRupee, Trash2, List } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState, StatCard, StatCardSkeleton, StatusPill } from "@/components/crm-ui";
import { useCrmRefresh, SmartActionDialog, LeadHistoryDialog, toLocalInputValue } from "@/components/lead-dialogs";
import { ACTIVITY_LABEL, telHref, waHref, ACTION_CONFIG, type Lead, type Reminder, type LeadStatus, type Activity } from "@/lib/crm";
import {
  cancelReminder,
  completeReminder,
  editReminder,
  fetchActivities,
  fetchLeads,
  fetchReminders,
  snoozeReminder,
} from "@/lib/crm-api";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders & Daily Activity — Crewvia BNI CRM" },
      {
        name: "description",
        content: "Kanban board of overdue, today, tomorrow and upcoming follow-ups plus everything logged today.",
      },
      { property: "og:title", content: "Reminders & Daily Activity — Crewvia BNI CRM" },
      { property: "og:description", content: "Follow-up board and today's logged activity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RemindersPage,
});

const COLUMNS = ["Overdue", "Today", "Tomorrow", "This week", "Later"] as const;
type Column = (typeof COLUMNS)[number];

function bucketOf(due: Date): Column {
  const now = new Date();
  if (due.getTime() < now.getTime()) return "Overdue";
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  if (due <= endToday) return "Today";
  const endTomorrow = new Date(endToday);
  endTomorrow.setDate(endTomorrow.getDate() + 1);
  if (due <= endTomorrow) return "Tomorrow";
  const endWeek = new Date(endToday);
  endWeek.setDate(endWeek.getDate() + 7);
  if (due <= endWeek) return "This week";
  return "Later";
}

function RemindersPage() {
  const refresh = useCrmRefresh();
  const lq = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });
  const aq = useQuery({ queryKey: ["activities"], queryFn: () => fetchActivities() });
  const rq = useQuery({ queryKey: ["reminders"], queryFn: fetchReminders });

  const isLoading = lq.isLoading || aq.isLoading || rq.isLoading;
  const reminders = rq.data || [];
  const leads = lq.data || [];
  const activities = aq.data || [];

  const done = useMutation({
    mutationFn: (r: Reminder) => completeReminder(r),
    onSuccess: () => {
      refresh();
      toast.success("Completed");
    },
  });
  const snooze = useMutation({
    mutationFn: (p: { r: Reminder; hours: number }) => {
      const due = new Date(p.r.due_at);
      due.setHours(due.getHours() + p.hours);
      return snoozeReminder(p.r, due.toISOString());
    },
    onSuccess: () => {
      refresh();
      toast.success("Snoozed");
    },
  });
  const deleteMut = useMutation({
    mutationFn: (r: Reminder) => cancelReminder(r),
    onSuccess: () => {
      refresh();
      toast.success("Reminder deleted");
    },
  });
  const editMut = useMutation({
    mutationFn: (p: { r: Reminder; title: string; dueAt: string }) =>
      editReminder(p.r, { title: p.title, dueAt: new Date(p.dueAt).toISOString() }),
    onSuccess: () => {
      refresh();
      toast.success("Reminder updated");
    },
  });

  const leadMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const pending = reminders.filter((r) => r.state === "pending");
  const buckets = COLUMNS.map((col) => ({
    col,
    items: pending.filter((r) => bucketOf(new Date(r.due_at)) === col),
  }));

  const todayActivities = activities.filter((a) => isToday(new Date(a.created_at)));
  const callsToday = todayActivities.filter((a) => a.kind === "call").length;
  const doneToday = reminders.filter(
    (r) => r.state === "done" && r.completed_at && isToday(new Date(r.completed_at)),
  ).length;
  const leadsToday = leads.filter((l) => isToday(new Date(l.created_at))).length;

  const [activeTab, setActiveTab] = useState<Column>("Today");
  const [completing, setCompleting] = useState<{r: Reminder, lead: Lead | undefined} | null>(null);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);

  return (
    <AppShell
      title="Quick reminders & daily activity"
      subtitle="Work the board left to right — overdue first."
    >
      {isLoading ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="mb-8 space-y-4">
            <div className="h-10 w-full rounded-xl bg-card border border-border animate-pulse" />
            <div className="h-48 w-full rounded-xl bg-card border border-border animate-pulse" />
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Overdue" value={String(buckets.find(b => b.col === "Overdue")?.items.length || 0)} accent />
            <StatCard label="Due today" value={String(buckets.find(b => b.col === "Today")?.items.length || 0)} />
            <StatCard label="Calls today" value={String(callsToday)} />
            <StatCard label="Completed today" value={String(doneToday)} hint={`${leadsToday} new leads`} />
          </div>

          <div className="mb-8">
            <div className="mb-6 flex overflow-x-auto rounded-xl bg-secondary/50 p-1">
              {COLUMNS.map((col) => {
                const count = buckets.find((b) => b.col === col)?.items.length || 0;
                return (
                  <button
                    key={col}
                    onClick={() => setActiveTab(col)}
                    className={`flex-1 min-w-[100px] whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === col
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                    }`}
                  >
                    {col} <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs opacity-80">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-border bg-card/50 p-4 sm:p-6">
              <TimelineView
                items={buckets.find((b) => b.col === activeTab)?.items || []}
                leadMap={leadMap}
                activities={activities}
                onDone={(r, lead) => setCompleting({ r, lead })}
                snooze={snooze}
                onDelete={(r) => deleteMut.mutate(r)}
                onEdit={(r, title, dueAt) => editMut.mutate({ r, title, dueAt })}
                onShowHistory={(lead) => setHistoryLead(lead)}
              />
            </div>
          </div>
        </>
      )}

      <h2 className="mb-3 font-display text-xl font-bold">Today's activity</h2>
      {todayActivities.length === 0 ? (
        <EmptyState title="Nothing logged today" body="Calls, payments, notes and status changes appear here." />
      ) : (
        <ol className="space-y-2">
          {todayActivities.map((a) => {
            const lead = leadMap.get(a.lead_id);
            return (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.summary}</p>
                  {a.detail ? <p className="text-sm text-muted-foreground">{a.detail}</p> : null}
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {ACTIVITY_LABEL[a.kind]} · {format(new Date(a.created_at), "h:mm a")}
                  </p>
                </div>
                {lead ? (
                  <Link
                    to="/leads/$leadId"
                    params={{ leadId: lead.id }}
                    className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {lead.name}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {completing && (
        <SmartActionDialog
          open={!!completing}
          onOpenChange={(v) => !v && setCompleting(null)}
          reminder={completing.r}
          lead={completing.lead ?? null}
        />
      )}
      
      <LeadHistoryDialog 
        lead={historyLead}
        open={!!historyLead}
        onOpenChange={(v) => !v && setHistoryLead(null)}
      />
    </AppShell>
  );
}

function TimelineView({
  items,
  leadMap,
  activities,
  onDone,
  snooze,
  onDelete,
  onEdit,
  onShowHistory,
}: {
  items: Reminder[];
  leadMap: Map<string, Lead>;
  activities: Activity[];
  onDone: (r: Reminder, lead?: Lead) => void;
  snooze: any;
  onDelete: (r: Reminder) => void;
  onEdit: (r: Reminder, title: string, dueAt: string) => void;
  onShowHistory: (lead: Lead) => void;
}) {
  if (items.length === 0) {
    return <EmptyState title="All clear" body="No reminders for this time period." />;
  }

  // Sort by time ascending
  const sorted = [...items].sort(
    (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
  );

  return (
    <div className="relative border-l-2 border-border/60 ml-12 sm:ml-16 py-4 space-y-6">
      {sorted.map((r) => {
        const time = format(new Date(r.due_at), "h a");
        const lead = leadMap.get(r.lead_id);
        const leadActivities = activities.filter(a => a.lead_id === r.lead_id && ["call", "note", "payment", "status_change"].includes(a.kind));
        const lastActivity = leadActivities.length > 0 ? leadActivities[0] : null;

        return (
          <div key={r.id} className="relative pl-6 sm:pl-8">
            <div className="absolute -left-[5px] top-6 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
            <div className="absolute -left-16 sm:-left-20 top-5 w-12 sm:w-16 text-right">
              <span className="text-[11px] sm:text-xs font-bold text-muted-foreground uppercase tracking-tight">
                {time}
              </span>
            </div>
            <ReminderCard
              reminder={r}
              lead={lead}
              lastActivity={lastActivity}
              onDone={() => onDone(r, lead)}
              onSnooze={(hours) => snooze.mutate({ r: r, hours })}
              onDelete={() => onDelete(r)}
              onEdit={(title, dueAt) => onEdit(r, title, dueAt)}
              onShowHistory={() => lead && onShowHistory(lead)}
            />
          </div>
        );
      })}
    </div>
  );
}

function getReminderContext(status?: LeadStatus) {
  switch (status) {
    case "take_info":
      return "Action: Call the lead to gather requirements.";
    case "info_taken":
      return "Action: Send draft or presentation to move forward.";
    case "draft_sent":
      return "Action: Check for draft feedback or approval.";
    case "approved":
      return "Action: Draft approved! Request advance payment.";
    case "advance_received":
      return "Action: Advance received. Send presentation or finalize deal.";
    case "presentation_sent":
      return "Action: Follow up on presentation. Push for conversion.";
    case "converted":
      return "Action: Lead is converted. Ensure deliverables are met.";
    case "lost":
      return "Lead is lost. Review if worth reviving.";
    default:
      return "Follow up needed.";
  }
}

function ReminderCard({
  reminder,
  lead,
  lastActivity,
  onDone,
  onSnooze,
  onDelete,
  onEdit,
  onShowHistory,
}: {
  reminder: Reminder;
  lead: Lead | undefined;
  lastActivity?: Activity | null;
  onDone: () => void;
  onSnooze: (hours: number) => void;
  onDelete: () => void;
  onEdit: (title: string, dueAt: string) => void;
  onShowHistory: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(reminder.title);
  const [editDue, setEditDue] = useState(toLocalInputValue(new Date(reminder.due_at)));

  const fieldClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              className={fieldClass}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Reminder title"
            />
          ) : (
            <p className="font-display text-base font-semibold text-foreground">{reminder.title}</p>
          )}
          {lead ? (
            <div className="mt-1 flex items-center gap-2">
              <Link
                to="/leads/$leadId"
                params={{ leadId: lead.id }}
                className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                {lead.name ? lead.name + " · " : ""}{lead.phone}
              </Link>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!editing && lead?.status && <StatusPill status={lead.status} />}
          {!editing && lead && (
            <button
              onClick={onShowHistory}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="History"
            >
              <List className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => {
              if (editing) {
                onEdit(editTitle, editDue);
                setEditing(false);
              } else {
                setEditing(true);
              }
            }}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={editing ? "Save" : "Edit"}
          >
            {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this reminder?")) onDelete();
            }}
            className="rounded-md border border-destructive/30 p-1.5 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reschedule to</label>
          <input
            type="datetime-local"
            className={fieldClass}
            value={editDue}
            onChange={(e) => setEditDue(e.target.value)}
          />
        </div>
      ) : (
        <div className="mb-4 space-y-2">
          <div className="rounded-lg bg-secondary/50 p-2.5 text-sm text-secondary-foreground border border-secondary/20">
            <p className="font-medium">{getReminderContext(lead?.status)}</p>
          </div>
          {lastActivity && (
            <div className="rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground border border-border/50">
              <span className="font-semibold">{ACTIVITY_LABEL[lastActivity.kind]}:</span>{" "}
              {lastActivity.summary}
              {lastActivity.detail ? ` — ${lastActivity.detail}` : ""}
              <span className="text-[10px] opacity-70 block mt-1">
                {format(new Date(lastActivity.created_at), "MMM d, h:mm a")}
              </span>
            </div>
          )}
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            {format(new Date(reminder.due_at), "h:mm a")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const action = lead ? ACTION_CONFIG[lead.status] : null;
              let Icon = Check;
              if (action?.type === "send") Icon = Send;
              if (action?.type === "call") Icon = PhoneCall;
              if (action?.type === "payment") Icon = IndianRupee;

              return (
                <button
                  onClick={onDone}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm"
                >
                  <Icon className="size-3.5" /> {action?.label || "Done"}
                </button>
              );
            })()}
            <button
              onClick={() => onSnooze(2)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              <Clock className="size-3.5" /> +2h
            </button>
            <button
              onClick={() => onSnooze(24)}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              +1d
            </button>
            {lead ? (
              <>
                <a
                  href={telHref(lead.phone)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  <Phone className="size-3.5" /> Call
                </a>
                <a
                  href={waHref(lead.phone, `Hi${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}, this is Crewvia BNI.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100"
                >
                  <MessageCircle className="size-3.5" /> WA
                </a>
              </>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}
