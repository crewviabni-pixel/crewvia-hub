import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BellRing, IndianRupee, MessageCircle, Phone, PhoneCall, Brain, Zap, Loader2 } from "lucide-react";
import { calculateLeadScore } from "@/lib/ai-scoring";

import { PaymentPill, StatusPill, BniDateDisplay } from "@/components/crm-ui";
import { StatusChangeDialog, useCrmRefresh } from "@/components/lead-dialogs";
import { LEAD_STATUSES, initials, money, telHref, type Lead, type LeadStatus } from "@/lib/crm";

export function LeadCard({
  lead,
  onCall,
  onPay,
  onRemind,
  selected,
  onSelect,
}: {
  lead: Lead;
  onCall: (lead: Lead) => void;
  onPay: (lead: Lead) => void;
  onRemind: (lead: Lead) => void;
  selected?: boolean;
  onSelect?: (leadId: string, checked: boolean) => void;
}) {
  const refresh = useCrmRefresh();
  const [statusTarget, setStatusTarget] = useState<LeadStatus | null>(null);

  const pending = Number(lead.deal_value) - Number(lead.amount_paid);
  const reminderDue = lead.next_reminder_at ? new Date(lead.next_reminder_at) : null;
  const overdue = reminderDue ? reminderDue.getTime() < Date.now() : false;
  
  const ai = calculateLeadScore(lead);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {onSelect && (
          <div className="pt-2.5">
            <input 
              type="checkbox" 
              checked={selected}
              onChange={(e) => onSelect(lead.id, e.target.checked)}
              className="size-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
            />
          </div>
        )}
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary font-display text-sm font-bold text-secondary-foreground">
          {initials(lead.name || "#")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to="/leads/$leadId"
              params={{ leadId: lead.id }}
              className="font-display text-base font-semibold hover:underline"
            >
              {lead.name || lead.phone}
            </Link>
            <div className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${ai.color}`} title={`AI NBA: ${ai.nextBestAction}`}>
              <Brain className="size-3" /> {ai.score}
            </div>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {lead.phone}
            {lead.company ? ` · ${lead.company}` : ""}
            {lead.city ? ` · ${lead.city}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill status={lead.status} />
            <PaymentPill status={lead.payment_status} />
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {lead.source}
            </span>
            {lead.call_count > 0 ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {lead.call_count} call{lead.call_count > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          <div className="mt-1">
            <BniDateDisplay lead={lead} />
          </div>
          {lead.custom_data && typeof lead.custom_data === 'object' && Object.keys(lead.custom_data as Record<string, any>).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(lead.custom_data as Record<string, any>).map(([key, val]) => {
                if (!val) return null;
                return (
                  <span key={key} className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                    {String(val)}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <div className="hidden text-right sm:block space-y-0.5">
          <p className="font-display text-sm font-bold">{money(lead.deal_value)} <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider ml-1">Total</span></p>
          {Number(lead.deal_value) > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">{money(lead.amount_paid)} <span className="text-[10px] uppercase tracking-wider ml-1">Rcvd</span></p>
              {pending > 0 ? (
                <p className="text-xs font-medium text-amber-600">{money(pending)} <span className="text-[10px] uppercase tracking-wider ml-1">Pend</span></p>
              ) : (
                <p className="text-xs font-medium text-emerald-600">Fully Paid</p>
              )}
            </>
          ) : null}
        </div>
      </div>

      {reminderDue ? (
        <p
          className={`mt-3 text-xs font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}
        >
          <BellRing className="mr-1 inline size-3.5" />
          {overdue ? "Overdue " : "Due "}
          {formatDistanceToNow(reminderDue, { addSuffix: true })}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={telHref(lead.phone)}
          onClick={() => onCall(lead)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Phone className="size-3.5" /> Call
        </a>
        <button
          onClick={() => onCall(lead)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
        >
          <PhoneCall className="size-3.5" /> Log call
        </button>
        <button
          onClick={() => onRemind(lead)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
        >
          <BellRing className="size-3.5" /> Remind
        </button>
        <button
          onClick={() => onPay(lead)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
        >
          <IndianRupee className="size-3.5" /> Payment
        </button>
        <select
          aria-label="Change status"
          value={lead.status}
          onChange={(e) => {
            const next = e.target.value as LeadStatus;
            if (next !== lead.status) setStatusTarget(next);
          }}
          className="ml-auto rounded-lg border border-input bg-background px-2 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <StatusChangeDialog
        lead={lead}
        nextStatus={statusTarget}
        open={!!statusTarget}
        onOpenChange={(v) => !v && setStatusTarget(null)}
      />
    </div>
  );
}
