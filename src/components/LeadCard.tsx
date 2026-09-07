import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BellRing, IndianRupee, MessageCircle, Phone, PhoneCall } from "lucide-react";

import { PaymentPill, StatusPill } from "@/components/crm-ui";
import { StatusChangeDialog, useCrmRefresh } from "@/components/lead-dialogs";
import { LEAD_STATUSES, initials, money, telHref, waHref, type Lead, type LeadStatus } from "@/lib/crm";
import { logWhatsapp } from "@/lib/crm-api";

export function LeadCard({
  lead,
  onCall,
  onPay,
  onRemind,
}: {
  lead: Lead;
  onCall: (lead: Lead) => void;
  onPay: (lead: Lead) => void;
  onRemind: (lead: Lead) => void;
}) {
  const refresh = useCrmRefresh();
  const [statusTarget, setStatusTarget] = useState<LeadStatus | null>(null);

  const whatsapp = useMutation({
    mutationFn: () => logWhatsapp(lead),
    onSuccess: refresh,
  });

  const pending = Number(lead.deal_value) - Number(lead.amount_paid);
  const reminderDue = lead.next_reminder_at ? new Date(lead.next_reminder_at) : null;
  const overdue = reminderDue ? reminderDue.getTime() < Date.now() : false;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary font-display text-sm font-bold text-secondary-foreground">
          {initials(lead.name || "#")}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to="/leads/$leadId"
            params={{ leadId: lead.id }}
            className="font-display text-base font-semibold hover:underline"
          >
            {lead.name || lead.phone}
          </Link>
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
