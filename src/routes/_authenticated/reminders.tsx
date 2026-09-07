import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, isToday } from "date-fns";
import { Check, Clock, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState, StatCard } from "@/components/crm-ui";
import { useCrmRefresh } from "@/components/lead-dialogs";
import { ACTIVITY_LABEL, telHref, waHref, type Lead, type Reminder } from "@/lib/crm";
import {
  completeReminder,
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
  const { data: reminders = [] } = useQuery({ queryKey: ["reminders"], queryFn: fetchReminders });
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: () => fetchActivities(),
  });

  const leadMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const done = useMutation({
    mutationFn: (r: Reminder) => completeReminder(r),
    onSuccess: () => {
      refresh();
      toast.success("Reminder completed");
    },
  });
  const snooze = useMutation({
    mutationFn: ({ r, hours }: { r: Reminder; hours: number }) =>
      snoozeReminder(r, new Date(Date.now() + hours * 3600_000).toISOString()),
    onSuccess: () => {
      refresh();
      toast.success("Reminder moved");
    },
  });

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

  return (
    <AppShell
      title="Quick reminders & daily activity"
      subtitle="Work the board left to right — overdue first."
    >
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Overdue" value={String(buckets[0]!.items.length)} accent />
        <StatCard label="Due today" value={String(buckets[1]!.items.length)} />
        <StatCard label="Calls today" value={String(callsToday)} />
        <StatCard label="Completed today" value={String(doneToday)} hint={`${leadsToday} new leads`} />
      </div>

      <div className="-mx-4 mb-8 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-3">
          {buckets.map(({ col, items }) => (
            <section key={col} className="w-72 shrink-0 rounded-xl border border-border bg-sidebar p-3">
              <header className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold">{col}</h2>
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold">
                  {items.length}
                </span>
              </header>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    Nothing here
                  </p>
                ) : (
                  items.map((r) => (
                    <ReminderCard
                      key={r.id}
                      reminder={r}
                      lead={leadMap.get(r.lead_id)}
                      onDone={() => done.mutate(r)}
                      onSnooze={(hours) => snooze.mutate({ r, hours })}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

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
    </AppShell>
  );
}

function ReminderCard({
  reminder,
  lead,
  onDone,
  onSnooze,
}: {
  reminder: Reminder;
  lead: Lead | undefined;
  onDone: () => void;
  onSnooze: (hours: number) => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-semibold">{reminder.title}</p>
      {lead ? (
        <Link
          to="/leads/$leadId"
          params={{ leadId: lead.id }}
          className="text-xs text-muted-foreground hover:underline"
        >
          {lead.name} · {lead.phone}
        </Link>
      ) : null}
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {format(new Date(reminder.due_at), "d MMM, h:mm a")}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          onClick={onDone}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground"
        >
          <Check className="size-3" /> Done
        </button>
        <button
          onClick={() => onSnooze(2)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary"
        >
          <Clock className="size-3" /> +2h
        </button>
        <button
          onClick={() => onSnooze(24)}
          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary"
        >
          +1d
        </button>
        {lead ? (
          <>
            <a
              href={telHref(lead.phone)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary"
            >
              <Phone className="size-3" /> Call
            </a>
            <a
              href={waHref(lead.phone, `Hi ${lead.name.split(" ")[0]}, this is Crewvia BNI.`)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900"
            >
              <MessageCircle className="size-3" /> WA
            </a>
          </>
        ) : null}
      </div>
    </article>
  );
}
