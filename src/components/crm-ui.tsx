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
