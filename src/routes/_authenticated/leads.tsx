import { createFileRoute, Link, Outlet, useMatches, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, Trash2, LayoutList, Columns3 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { EmptyState, LeadCardSkeleton, StatCard } from "@/components/crm-ui";
import { LeadCard } from "@/components/LeadCard";
import { CallOutcomeDialog, PaymentDialog, ReminderDialog } from "@/components/lead-dialogs";
import { LEAD_SOURCES, LEAD_STATUSES, PAYMENT_STATUSES, money, type Lead } from "@/lib/crm";
import { fetchLeads, deleteLead, changeStatus } from "@/lib/crm-api";
import { KanbanBoard } from "@/components/KanbanBoard";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { matchIntelligentSearch } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leads")({
  beforeLoad: ({ context }: any) => {
    if (context?.appRole !== 'admin') {
      throw redirect({ to: "/work" });
    }
  },
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
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const { data: leads = [], isLoading } = useQuery({ 
    queryKey: ["leads", activeWorkspaceId], 
    queryFn: () => fetchLeads(activeWorkspaceId || undefined),
    enabled: !!activeWorkspaceId
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [source, setSource] = useState("all");
  const [due, setDue] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  const statusMutation = useMutation({
    mutationFn: async ({ leadId, next }: { leadId: string; next: any }) => {
      const lead = leads.find((l: any) => l.id === leadId);
      if (!lead) return;
      await changeStatus(lead, next, "Moved in Kanban Board");
    },
    onMutate: async ({ leadId, next }) => {
      await queryClient.cancelQueries({ queryKey: ["leads", activeWorkspaceId] });
      const previousLeads = queryClient.getQueryData(["leads", activeWorkspaceId]);
      queryClient.setQueryData(["leads", activeWorkspaceId], (old: any) => {
        if (!old) return old;
        return old.map((l: any) => l.id === leadId ? { ...l, status: next } : l);
      });
      return { previousLeads };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(["leads", activeWorkspaceId], context.previousLeads);
      }
      toast.error("Failed to update status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["leads", activeWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["inboxCount"] });
    },
  });

  const handleDragEnd = (leadId: string, newStatus: any) => {
    statusMutation.mutate({ leadId, next: newStatus });
  };

  const [callLead, setCallLead] = useState<Lead | null>(null);
  const [payLead, setPayLead] = useState<Lead | null>(null);
  const [remindLead, setRemindLead] = useState<Lead | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const rows = leads.filter((lead) => {
      if (term) {
        const hay = `${lead.name || ""} ${lead.phone || ""} ${lead.company || ""} ${lead.city || ""} ${lead.service || ""}`;
        if (!matchIntelligentSearch(hay, term)) return false;
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

  const pipeline = filtered.reduce((sum, l) => (l.status === "lost" ? sum : sum + Number(l.deal_value)), 0);
  const collected = filtered.reduce((sum, l) => sum + Number(l.amount_paid), 0);
  const pending = filtered.reduce(
    (sum, l) => (l.status === "lost" ? sum : sum + Math.max(Number(l.deal_value) - Number(l.amount_paid), 0)),
    0
  );

  const deleteMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      await Promise.all(leadIds.map(id => deleteLead(id)));
    },
    onSuccess: () => {
      toast.success("Selected leads deleted successfully");
      setSelectedLeads(new Set());
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["inboxCount"] });
    },
    onError: () => {
      toast.error("Failed to delete some leads");
    }
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(new Set(filtered.map(l => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedLeads(newSelected);
  };

  const handleDeleteSelected = () => {
    if (!confirm(`Are you sure you want to delete ${selectedLeads.size} leads?`)) return;
    deleteMutation.mutate(Array.from(selectedLeads));
  };

  const handleFindDuplicates = () => {
    const normalizePhone = (p: string | null) => {
      if (!p) return "";
      const digits = p.replace(/\D/g, '');
      return digits.length >= 10 ? digits.slice(-10) : digits;
    };

    const phoneGroups: Record<string, typeof leads> = {};
    leads.forEach(lead => {
      const p = normalizePhone(lead.phone);
      if (!p) return;
      if (!phoneGroups[p]) phoneGroups[p] = [];
      phoneGroups[p].push(lead);
    });

    const duplicateIds = new Set<string>();
    let duplicateCount = 0;
    
    Object.values(phoneGroups).forEach(group => {
      if (group.length > 1) {
        duplicateCount++;
        // Keep the newest one by created_at, others are duplicates
        const sorted = [...group].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        for (let i = 1; i < sorted.length; i++) {
          const item = sorted[i]; if (item && item.id) duplicateIds.add(item.id);
        }
      }
    });

    if (duplicateIds.size === 0) {
      toast.info("No duplicates found!");
      return;
    }

    if (confirm(`Found ${duplicateIds.size} duplicate lead records across ${duplicateCount} phone numbers. Do you want to select them for deletion?`)) {
      setSelectedLeads(new Set([...selectedLeads, ...duplicateIds]));
    }
  };

  const selectClass =
    "rounded-lg border border-input bg-background px-2.5 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppShell
      title="Leads"
      subtitle={`${filtered.length} of ${leads.length} leads`}
      actions={
        <Link
          to="/add-lead"
          className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 text-xs font-semibold text-white shadow-xs whitespace-nowrap shrink-0 transition-colors"
        >
          <Plus className="size-3.5" />
          <span>New Lead</span>
        </Link>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Leads" value={String(filtered.length)} />
        <StatCard label="Pipeline" value={money(pipeline)} />
        <StatCard label="Collected" value={money(collected)} />
        <StatCard label="Pending" value={money(pending)} accent />
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
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center rounded-lg border border-input bg-background p-1 mr-2">
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}
              title="List View"
            >
              <LayoutList className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`rounded-md p-1.5 ${viewMode === "board" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/50"}`}
              title="Kanban Board"
            >
              <Columns3 className="size-4" />
            </button>
          </div>
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
        <div className="space-y-3">
          <LeadCardSkeleton />
          <LeadCardSkeleton />
          <LeadCardSkeleton />
          <LeadCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No leads match"
          body={leads.length ? "Try clearing a filter." : "Add your first lead to get started."}
        />
      ) : viewMode === "board" ? (
        <KanbanBoard
          leads={filtered}
          onDragEnd={handleDragEnd}
          selectedLeads={selectedLeads}
          onSelectLead={handleSelectLead}
          setCallLead={setCallLead}
          setPayLead={setPayLead}
          setRemindLead={setRemindLead}
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLeads.size > 0 && selectedLeads.size === filtered.length}
                  onChange={handleSelectAll}
                  className="size-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
                />
                Select All
              </label>
              <button
                onClick={handleFindDuplicates}
                className="inline-flex items-center gap-1.5 rounded-md bg-secondary/50 hover:bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors"
              >
                <Search className="size-3.5" /> Find Duplicates
              </button>
            </div>
            {selectedLeads.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="size-3.5" />
                {deleteMutation.isPending ? "Deleting..." : `Delete ${selectedLeads.size}`}
              </button>
            )}
          </div>
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onCall={setCallLead}
              onPay={setPayLead}
              onRemind={setRemindLead}
              selected={selectedLeads.has(lead.id)}
              onSelect={handleSelectLead}
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
