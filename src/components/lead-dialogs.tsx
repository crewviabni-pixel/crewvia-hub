import { useState, useMemo } from "react";
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
  STATUS_REMINDER_CONFIG,
  money,
  statusMeta,
  type CallOutcome,
  type Lead,
  type LeadStatus,
  type PaymentCategory,
  type Reminder,
  NEXT_STATUS_MAP,
  ACTION_CONFIG,
  ACTIVITY_LABEL,
} from "@/lib/crm";
import { changeStatus, completeReminder, createReminder, logCall, recordPayment, addNote, cancelAllReminders, fetchActivities } from "@/lib/crm-api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

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
  const [reminderAt, setReminderAt] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      await logCall(lead, outcome, note.trim() || undefined, nextStatus || undefined, reminderAt || undefined);
    },
    onSuccess: () => {
      refresh();
      toast.success("Call logged");
      setNote("");
      setNextStatus("");
      setReminderAt("");
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
        <div className="space-y-4">
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
            <label className="mb-1.5 block text-sm font-medium">Follow-up Reminder</label>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => setReminderAt("")}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  reminderAt === "" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                }`}
              >
                None
              </button>
              {presetDates().map((p) => {
                const val = p.date.toISOString();
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setReminderAt(val)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      reminderAt === val ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <input
              type="datetime-local"
              className={fieldClass}
              value={reminderAt ? toLocalInputValue(new Date(reminderAt)) : ""}
              onChange={(e) => {
                if (e.target.value) setReminderAt(new Date(e.target.value).toISOString());
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Note</label>
            <textarea
              className={fieldClass}
              rows={2}
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
  const [category, setCategory] = useState<PaymentCategory>("partial");
  const [note, setNote] = useState("");

  const pending = lead ? Number(lead.deal_value) - Number(lead.amount_paid) : 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const value = Number(amount);
      if (!value || value <= 0) throw new Error("Enter a valid amount");
      await recordPayment(lead, value, method, category, note.trim() || undefined);
    },
    onSuccess: () => {
      refresh();
      toast.success("Payment recorded");
      setAmount("");
      setNote("");
      setCategory("partial");
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
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Deal {money(lead?.deal_value)} · Paid {money(lead?.amount_paid)} · Pending{" "}
            <span className="font-semibold text-foreground">{money(pending)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {pending > 0 ? (
              <button
                type="button"
                onClick={() => { setAmount(String(pending)); setCategory("full"); }}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-secondary"
              >
                Full pending {money(pending)}
              </button>
            ) : null}
            {pending > 0 ? (
              <button
                type="button"
                onClick={() => { setAmount(String(Math.round(pending / 2))); setCategory("partial"); }}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-secondary"
              >
                Half {money(Math.round(pending / 2))}
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
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
              <label className="mb-1.5 block text-sm font-medium">Category</label>
              <select
                className={fieldClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as PaymentCategory)}
              >
                <option value="advance">Advance</option>
                <option value="partial">Partial</option>
                <option value="full">Full / Final</option>
              </select>
            </div>
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

/* ----------------------------- status change ------------------------------ */

export function StatusChangeDialog({
  lead,
  nextStatus,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  nextStatus: LeadStatus | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const refresh = useCrmRefresh();
  const [custom, setCustom] = useState("");

  const config = nextStatus ? STATUS_REMINDER_CONFIG[nextStatus] : null;

  const save = useMutation({
    mutationFn: async (reminderAt?: string) => {
      if (!lead || !nextStatus) return;
      await changeStatus(lead, nextStatus, undefined, reminderAt);
    },
    onSuccess: () => {
      refresh();
      toast.success("Status updated");
      setCustom("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusLabel = nextStatus ? statusMeta(nextStatus).label : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Moving to {statusLabel} — {lead?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {config ? (
            <>
              <p className="text-sm font-medium">{config.prompt}</p>
              <div className="flex flex-wrap gap-2">
                {presetDates().map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    disabled={save.isPending}
                    onClick={() => save.mutate(p.date.toISOString())}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                  >
                    {p.label}
                  </button>
                ))}
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Change status to <span className="font-semibold">{statusLabel}</span>?
            </p>
          )}
        </div>
        <DialogFooter className="flex gap-2 sm:gap-2">
          {config && custom ? (
            <button
              onClick={() => save.mutate(new Date(custom).toISOString())}
              disabled={save.isPending}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Set reminder & update
            </button>
          ) : null}
          <button
            onClick={() => save.mutate(undefined)}
            disabled={save.isPending}
            className={`rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60 ${
              config && custom ? "" : "flex-1 bg-primary text-primary-foreground"
            }`}
          >
            {config ? "Skip reminder" : "Confirm"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------- smart action ------------------------------ */

export function SmartActionDialog({
  reminder,
  lead,
  open,
  onOpenChange,
}: {
  reminder: Reminder | null;
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const refresh = useCrmRefresh();
  const [custom, setCustom] = useState("");

  const [negative, setNegative] = useState(false);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [advance, setAdvance] = useState(true);
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState("upi");

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [noFollowUp, setNoFollowUp] = useState(false);
  const [markLost, setMarkLost] = useState(false);

  // Memoize presets so identity and getTime() doesn't drift on re-render while modal is open
  const presets = useMemo(() => presetDates(), [open]);

  // default amount if missing
  const defaultAmount = lead ? lead.deal_value - lead.amount_paid : 0;
  
  const action = lead ? ACTION_CONFIG[lead.status] : null;
  const nextStatus = lead ? NEXT_STATUS_MAP[lead.status] : null;
  const config = nextStatus ? STATUS_REMINDER_CONFIG[nextStatus] : null;

  const save = useMutation({
    mutationFn: async (reminderAt?: Date) => {
      if (!reminder || !lead || !action) return;
      
      await completeReminder(reminder);

      if (negative) {
        if (note) await addNote(lead, `Setback/Issue: ${note}`);
        
        // Even in a setback, if they entered a specific payment amount on a payment step, record it.
        if (action.type === "payment" && amount !== "") {
          await recordPayment(lead, Number(amount), method, action.category || "partial", note || undefined);
        }

        if (markLost) {
          await changeStatus(lead, "lost");
          await cancelAllReminders(lead.id);
        } else if (reminderAt) {
          await createReminder({
            leadId: lead.id,
            title: reminder.title, // retry same step
            dueAt: reminderAt.toISOString(),
          });
        }
        return;
      }

      // Positive flows
      if (action.type === "call") {
        const willAdvance = outcome === "connected" && advance;
        await logCall(
          lead,
          outcome,
          note || undefined,
          willAdvance && nextStatus ? nextStatus : undefined,
          reminderAt?.toISOString()
        );
      } else if (action.type === "payment") {
        const finalAmount = amount === "" ? defaultAmount : Number(amount);
        await recordPayment(lead, finalAmount, method, action.category || "partial", note || undefined);
        if (nextStatus) {
          await changeStatus(lead, nextStatus, undefined, reminderAt?.toISOString());
        } else if (reminderAt) {
          await createReminder({ leadId: lead.id, title: `Follow up with ${lead.name}`, dueAt: reminderAt.toISOString() });
        }
      } else if (action.type === "send") {
        if (nextStatus) {
          await changeStatus(lead, nextStatus, undefined, reminderAt?.toISOString());
        }
      } else {
        if (nextStatus) {
          await changeStatus(lead, nextStatus, undefined, reminderAt?.toISOString());
        } else if (reminderAt) {
          await createReminder({ leadId: lead.id, title: `Follow up with ${lead.name}`, dueAt: reminderAt.toISOString() });
        }
      }
    },
    onSuccess: () => {
      refresh();
      toast.success("Task completed");
      setCustom("");
      setNegative(false);
      setNote("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setNegative(false);
        setNote("");
        setSelectedDate(null);
        setNoFollowUp(false);
        setMarkLost(false);
        setCustom("");
      }
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {negative ? "Report Setback / Issue" : action?.label || "Complete Task"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <p className="text-sm font-semibold text-emerald-900">
              Completing: <span className="font-normal">{reminder?.title}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="neg"
              checked={negative}
              onChange={(e) => {
                setNegative(e.target.checked);
                if (!e.target.checked) setMarkLost(false);
              }}
              className="rounded border-border text-destructive focus:ring-destructive size-4"
            />
            <label htmlFor="neg" className="text-sm font-semibold text-destructive">
              Didn't go as planned / Report an issue
            </label>
          </div>

          {!negative && action?.type === "call" && (
            <div className="space-y-3 rounded-lg border border-border p-3 bg-sidebar">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Call outcome</label>
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as CallOutcome)}
                  className={fieldClass}
                >
                  {CALL_OUTCOMES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {outcome === "connected" && nextStatus && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="adv"
                    checked={advance}
                    onChange={(e) => setAdvance(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary size-4"
                  />
                  <label htmlFor="adv" className="text-sm font-medium">
                    Advance to <span className="font-bold">{statusMeta(nextStatus).label}</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {!negative && action?.type === "payment" && (
            <div className="space-y-3 rounded-lg border border-border p-3 bg-sidebar">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Amount received</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-muted-foreground">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value) || "")}
                    placeholder={(lead ? (lead.deal_value - lead.amount_paid) : 0).toString()}
                    className={`${fieldClass} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Payment method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={fieldClass}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(negative || action?.type === "call" || action?.type === "payment") && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {negative ? "Reason / Notes (Required)" : "Notes (Optional)"}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={fieldClass}
                rows={2}
                placeholder={negative ? "e.g. They asked to call back next week..." : "Add any details here..."}
              />
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-medium">
              {negative
                ? "When should we retry this?"
                : (advance && nextStatus && config)
                ? `Next: ${statusMeta(nextStatus).label}. ${config.prompt}`
                : "When should we follow up?"}
            </p>
            <div className="flex flex-wrap gap-2">
              {negative && (
                <button
                  type="button"
                  onClick={() => { setMarkLost(true); setNoFollowUp(false); setSelectedDate(null); setCustom(""); }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    markLost
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-border hover:bg-secondary text-destructive"
                  }`}
                >
                  Mark as Lost
                </button>
              )}
              <button
                type="button"
                onClick={() => { setNoFollowUp(true); setMarkLost(false); setSelectedDate(null); setCustom(""); }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  noFollowUp
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                No follow-up needed
              </button>
              {presets.map((p) => {
                const isActive = selectedDate?.getTime() === p.date.getTime();
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setSelectedDate(p.date); setNoFollowUp(false); setMarkLost(false); setCustom(""); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Custom date & time</label>
            <input
              type="datetime-local"
              className={fieldClass}
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setSelectedDate(e.target.value ? new Date(e.target.value) : null);
                setNoFollowUp(false);
                setMarkLost(false);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={() => save.mutate(selectedDate || undefined)}
            disabled={
              save.isPending ||
              (negative ? !note.trim() : (!selectedDate && !noFollowUp && !markLost))
            }
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Save & Complete Task
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- history -------------------------------- */

export function LeadHistoryDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities", lead?.id],
    queryFn: () => lead ? fetchActivities(lead.id) : Promise.resolve([]),
    enabled: !!lead && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">History — {lead?.name || lead?.phone}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-3">
                  <div className="h-4 w-1/2 rounded bg-primary/10 mb-2" />
                  <div className="h-3 w-1/3 rounded bg-primary/10" />
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No activity recorded yet.</p>
          ) : (
            <ol className="relative border-l-2 border-border/60 ml-3 space-y-4">
              {activities.map((a) => (
                <li key={a.id} className="relative pl-5">
                  <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <p className="text-sm font-semibold">{a.summary}</p>
                    {a.detail ? <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{a.detail}</p> : null}
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                      {ACTIVITY_LABEL[a.kind]} · {format(new Date(a.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
