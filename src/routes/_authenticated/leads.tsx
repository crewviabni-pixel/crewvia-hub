import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState, StatCard } from "@/components/crm-ui";
import { LeadCard } from "@/components/LeadCard";
import { CallOutcomeDialog, PaymentDialog, ReminderDialog } from "@/components/lead-dialogs";
import { LEAD_SOURCES, LEAD_STATUSES, PAYMENT_STATUSES, money, type Lead } from "@/lib/crm";
import { fetchLeads } from "@/lib/crm-api";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Crewvia BNI CRM" },
      { name: "description", content: "All Crewvia BNI leads with one-tap call, WhatsApp, status, payment and reminder actions." },
      { property: "og:title", content: "Leads — Crewvia BNI CRM" },
      { property: "og:description", content: "All Crewvia BNI leads with one-tap actions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadsLayout,
});

function LeadsLayout() {
  const matches = useMatches();
  const isChild = matches.some((m) => m.routeId === "/_authenticated/leads/$leadId");
  if (isChild) return <Outlet />;
  return <LeadsList />;
}

type SortKey = "recent" | "created" | "value" | "reminder";

function LeadsList() {
  const { data: leads = [], isLoading } = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [source, setSource] = useState("all");
  const [due, setDue] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const [callLead, setCallLead] = useState<Lead | null>(null);
  const [payLead, setPayLead] = useState<Lead | null>(null);
  const [remindLead, setRemindLead] = useState<Lead | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const rows = leads.filter((lead) => {
      if (term) {
        const hay = `${lead.name} ${lead.phone} ${lead.company ?? ""} ${lead.city ?? ""} ${lead.service ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status !== "all" && lead.status !== status) return false;
      if (payment !== "all" && lead.payment_status !== payment) return false;
      if (source !== "all" && lead.source !== source) return false;
      if (due !== "all") {
        const next = lead.next_reminder_at ? new Date(lead.next_reminder_at) : null;
        if (due === "none" && next) return false;
        if (due === "overdue" && (!next || next.getTime() >= Date.now())) return false;
        if (due === "today" && (!next || next.getTime() > endOfToday.getTime())) return false;
      }
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === "value") return Number(b.deal_value) - Number(a.deal_value);
      if (sort === "created") return +new Date(b.created_at) - +new Date(a.created_at);
      if (sort === "reminder") {
        const av = a.next_reminder_at ? +new Date(a.next_reminder_at) : Infinity;
        const bv = b.next_reminder_at ? +new Date(b.next_reminder_at) : Infinity;
        return av - bv;
      }
      return +new Date(b.updated_at) - +new Date(a.updated_at);
    });
  }, [leads, search, status, payment, source, due, sort]);

  const pipeline = filtered.reduce((sum, l) => sum + Number(l.deal_value), 0);
  const collected = filtered.reduce((sum, l) => sum + Number(l.amount_paid), 0);

  const selectClass =
    "rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppShell
      title="Leads"
      subtitle={`${filtered.length} of ${leads.length} leads`}
      actions={
        <Link
          to="/add-lead"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
        >
          <Plus className="size-3.5" /> New lead
        </Link>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Leads" value={String(filtered.length)} />
        <StatCard label="Pipeline" value={money(pipeline)} />
        <StatCard label="Collected" value={money(collected)} />
        <StatCard label="Pending" value={money(pipeline - collected)} accent />
      </div>

      <div className="mb-4 space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, company, city…"
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
          >
            <option value="all">All payments</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select className={selectClass} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className={selectClass} value={due} onChange={(e) => setDue(e.target.value)}>
            <option value="all">Any reminder</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="none">No reminder</option>
          </select>
          <select
            className={selectClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="recent">Recently updated</option>
            <option value="created">Newest added</option>
            <option value="value">Highest value</option>
            <option value="reminder">Reminder soonest</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading leads…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No leads match"
          body={leads.length ? "Try clearing a filter." : "Add your first lead to get started."}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onCall={setCallLead}
              onPay={setPayLead}
              onRemind={setRemindLead}
            />
          ))}
        </div>
      )}

      <CallOutcomeDialog
        lead={callLead}
        open={!!callLead}
        onOpenChange={(v) => !v && setCallLead(null)}
      />
      <PaymentDialog lead={payLead} open={!!payLead} onOpenChange={(v) => !v && setPayLead(null)} />
      <ReminderDialog
        lead={remindLead}
        open={!!remindLead}
        onOpenChange={(v) => !v && setRemindLead(null)}
      />
    </AppShell>
  );
}
