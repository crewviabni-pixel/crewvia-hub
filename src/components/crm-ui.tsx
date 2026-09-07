import { cn } from "@/lib/utils";
import {
  paymentMeta,
  statusMeta,
  type LeadStatus,
  type PaymentStatus,
} from "@/lib/crm";

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
