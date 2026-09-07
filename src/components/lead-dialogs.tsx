import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CALL_OUTCOMES,
  LEAD_STATUSES,
  PAYMENT_METHODS,
  money,
  type CallOutcome,
  type Lead,
  type LeadStatus,
} from "@/lib/crm";
import { createReminder, logCall, recordPayment } from "@/lib/crm-api";

export function useCrmRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["activities"] });
    void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
  };
}

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

/* --------------------------------- call ---------------------------------- */

export function CallOutcomeDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const refresh = useCrmRefresh();
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState<LeadStatus | "">("");

  const save = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      await logCall(lead, outcome, note.trim() || undefined, nextStatus || undefined);
    },
    onSuccess: () => {
      refresh();
      toast.success("Call logged");
      setNote("");
      setNextStatus("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Log call — {lead?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">Outcome</p>
            <div className="grid grid-cols-2 gap-2">
              {CALL_OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    outcome === o.value
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Move status to (optional)</label>
            <select
              className={fieldClass}
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as LeadStatus | "")}
            >
              <option value="">Keep current</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Note</label>
            <textarea
              className={fieldClass}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was discussed?"
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Save call
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- payment -------------------------------- */

export function PaymentDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const refresh = useCrmRefresh();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("upi");
  const [note, setNote] = useState("");

  const pending = lead ? Number(lead.deal_value) - Number(lead.amount_paid) : 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const value = Number(amount);
      if (!value || value <= 0) throw new Error("Enter a valid amount");
      await recordPayment(lead, value, method, note.trim() || undefined);
    },
    onSuccess: () => {
      refresh();
      toast.success("Payment recorded");
      setAmount("");
      setNote("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Record payment — {lead?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Deal {money(lead?.deal_value)} · Paid {money(lead?.amount_paid)} · Pending{" "}
            <span className="font-semibold text-foreground">{money(pending)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {pending > 0 ? (
              <button
                type="button"
                onClick={() => setAmount(String(pending))}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-secondary"
              >
                Full pending {money(pending)}
              </button>
            ) : null}
            {pending > 0 ? (
              <button
                type="button"
                onClick={() => setAmount(String(Math.round(pending / 2)))}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-secondary"
              >
                Half {money(Math.round(pending / 2))}
              </button>
            ) : null}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Amount</label>
            <input
              className={fieldClass}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Method</label>
            <select
              className={fieldClass}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Note</label>
            <input
              className={fieldClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reference / remark"
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Save payment
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- reminder -------------------------------- */

export function presetDates() {
  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const twoDays = new Date(now);
  twoDays.setDate(twoDays.getDate() + 2);
  twoDays.setHours(10, 0, 0, 0);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);
  return [
    { label: "In 1 hour", date: inHour },
    { label: "Tonight 8 PM", date: tonight },
    { label: "Tomorrow 10 AM", date: tomorrow },
    { label: "In 2 days", date: twoDays },
    { label: "Next week", date: nextWeek },
  ].filter((p) => p.date.getTime() > now.getTime());
}

export function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ReminderDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const refresh = useCrmRefresh();
  const [title, setTitle] = useState("");
  const [custom, setCustom] = useState("");

  const save = useMutation({
    mutationFn: async (dueAt: Date) => {
      if (!lead) return;
      await createReminder({
        leadId: lead.id,
        title: title.trim() || `Follow up with ${lead.name}`,
        dueAt: dueAt.toISOString(),
      });
    },
    onSuccess: () => {
      refresh();
      toast.success("Reminder set");
      setTitle("");
      setCustom("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Set reminder — {lead?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">What for?</label>
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lead ? `Follow up with ${lead.name}` : "Follow up"}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Quick pick</p>
            <div className="flex flex-wrap gap-2">
              {presetDates().map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate(p.date)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Custom date & time</label>
            <input
              type="datetime-local"
              className={fieldClass}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => custom && save.mutate(new Date(custom))}
            disabled={!custom || save.isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Set custom reminder
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
