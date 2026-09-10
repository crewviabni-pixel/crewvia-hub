import { cn } from "@/lib/utils";
import {
  paymentMeta,
  statusMeta,
  type Lead,
  type LeadStatus,
  type PaymentStatus,
} from "@/lib/crm";
import { Calendar, Check } from "lucide-react";
import { useState } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { updateLeadFields } from "@/lib/crm-api";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function BniDateDisplay({ lead }: { lead: Lead }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [dateStr, setDateStr] = useState(lead.bni_presentation_date || "");

  const mut = useMutation({
    mutationFn: async (date: string | null) => {
      await updateLeadFields(lead, { bni_presentation_date: date }, "BNI presentation date updated");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setEditing(false);
      toast.success("BNI date saved");
    },
  });

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <input 
          type="date" 
          value={dateStr}
          onChange={e => setDateStr(e.target.value)}
          className="text-xs px-2 py-1 border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button 
          onClick={() => mut.mutate(dateStr || null)}
          className="p-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Check className="size-3.5" />
        </button>
        <button 
          onClick={() => setEditing(false)}
          className="px-2 py-1 text-xs text-muted-foreground hover:bg-secondary rounded-md"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (!lead.bni_presentation_date) {
    return (
      <button 
        onClick={() => setEditing(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Calendar className="size-3.5" /> + Add BNI Date
      </button>
    );
  }

  const bniDate = new Date(lead.bni_presentation_date);
  const diff = differenceInCalendarDays(bniDate, new Date());
  
  let diffText = "";
  let colorClass = "text-muted-foreground";

  if (diff === 0) {
    diffText = "Today";
    colorClass = "text-amber-600 font-semibold";
  } else if (diff > 0) {
    diffText = `${diff} day${diff > 1 ? "s" : ""} remaining`;
    colorClass = "text-emerald-600 font-semibold";
  } else {
    diffText = `${Math.abs(diff)} day${Math.abs(diff) > 1 ? "s" : ""} overdue`;
    colorClass = "text-destructive font-semibold";
  }

  return (
    <div 
      className="mt-2 inline-flex items-center gap-2 text-xs border border-border/50 bg-muted/30 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => setEditing(true)}
      title="Click to change date"
    >
      <Calendar className="size-3.5 text-muted-foreground" />
      <span>BNI: <span className="font-medium text-foreground">{format(bniDate, "d MMM yyyy")}</span></span>
      <span className="text-muted-foreground/30">|</span>
      <span className={colorClass}>{diffText}</span>
    </div>
  );
}

export function StatusPill({ status, className }: { status: LeadStatus; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        meta.tone,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function PaymentPill({ status, className }: { status: PaymentStatus; className?: string }) {
  const meta = paymentMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        meta.tone,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        accent && "border-accent/50 bg-accent/10",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function LeadCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm animate-pulse">
      <div className="flex items-start gap-3">
        <div className="size-10 shrink-0 rounded-lg bg-primary/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-1/3 rounded bg-primary/10" />
          <div className="h-4 w-1/2 rounded bg-primary/10" />
          <div className="mt-2 flex gap-1.5">
            <div className="h-5 w-16 rounded-full bg-primary/10" />
            <div className="h-5 w-16 rounded-full bg-primary/10" />
          </div>
        </div>
        <div className="hidden text-right sm:block space-y-2">
          <div className="h-5 w-16 ml-auto rounded bg-primary/10" />
          <div className="h-4 w-20 ml-auto rounded bg-primary/10" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="h-8 w-20 rounded-lg bg-primary/10" />
        <div className="h-8 w-24 rounded-lg bg-primary/10" />
        <div className="h-8 w-24 rounded-lg bg-primary/10" />
        <div className="h-8 w-24 rounded-lg bg-primary/10" />
        <div className="h-8 w-24 ml-auto rounded-lg bg-primary/10" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="h-3 w-1/2 rounded bg-primary/10" />
      <div className="mt-3 h-8 w-1/3 rounded bg-primary/10" />
      <div className="mt-2 h-3 w-2/3 rounded bg-primary/10" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="h-64 w-full rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="h-full w-full rounded bg-primary/10" />
    </div>
  );
}
