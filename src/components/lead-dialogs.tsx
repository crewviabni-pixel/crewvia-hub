import { useWhatsAppBridge } from "@/lib/whatsapp-bridge";
import { logAutomatedWhatsapp } from "@/lib/crm-api";
import { fetchCompletedWorkItemsForLead } from "@/lib/work-api";
import { createPreviewShareUrl } from "@/lib/preview-utils";
import { Zap, Loader2, Eye, MessageCircle, Copy, Info } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c4.54 0 8.24 3.7 8.24 8.24 0 2.2-.86 4.27-2.42 5.82a8.187 8.187 0 0 1-5.82 2.42c-1.42 0-2.82-.37-4.06-1.08l-.29-.17-3.11.82.83-3.03-.19-.31a8.17 8.17 0 0 1-1.25-4.47c0-4.54 3.7-8.24 8.24-8.24m-3.53 3.12c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.43 0 1.43 1.03 2.81 1.18 3.01.15.19 2.01 3.14 4.95 4.38.7.3 1.24.48 1.66.61.7.22 1.34.19 1.84.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.18-1.41-.07-.13-.26-.2-.55-.35s-1.75-.86-2.02-.96c-.27-.1-.47-.15-.67.15-.2.29-.77.96-.94 1.16-.18.19-.35.22-.64.07-.29-.15-1.23-.45-2.34-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.59.13-.13.29-.35.43-.52.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.08-.14-.67-1.63-.92-2.23-.24-.59-.49-.51-.67-.52l-.57-.01z" />
    </svg>
  );
}
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
  renderTemplate,
  waHref,
} from "@/lib/crm";
import { changeStatus, completeReminder, createReminder, logCall, recordPayment, addNote, cancelAllReminders, fetchActivities, getNextMessageTemplate, recordTemplateUsage, fetchTemplatesForStatus,
  fetchTemplatesForStatusAndScenario,
  fetchLeadTemplateProgress
} from "@/lib/crm-api";
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
      <DialogContent className="sm:max-w-lg">
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
            {lead && <TemplateSuggester lead={lead} status={lead.status} scenario={outcome} />}
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
  const { isInstalled, sendDirect } = useWhatsAppBridge();
  const [sending, setSending] = useState(false);
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

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [messageText, setMessageText] = useState("");

  // Memoize presets so identity and getTime() doesn't drift on re-render while modal is open
  const presets = useMemo(() => presetDates(), [open]);

  // default amount if missing
  const defaultAmount = lead ? lead.deal_value - lead.amount_paid : 0;
  
  const action = lead ? ACTION_CONFIG[lead.status] : null;
  const nextStatus = lead ? NEXT_STATUS_MAP[lead.status] : null;
  const config = nextStatus ? STATUS_REMINDER_CONFIG[nextStatus] : null;

  // Query completed work items for lead
  const { data: completedWorks = [] } = useQuery({
    queryKey: ["completed-work-for-lead", lead?.id],
    queryFn: () => (lead?.id ? fetchCompletedWorkItemsForLead(lead.id) : Promise.resolve([])),
    enabled: open && !!lead?.id,
  });

  // Query templates for this lead status
  const { data: statusTemplates = [] } = useQuery({
    queryKey: ["templates-for-status", lead?.status, lead?.workspace_id],
    queryFn: () => (lead?.status ? fetchTemplatesForStatus(lead.status, lead.workspace_id || undefined) : Promise.resolve([])),
    enabled: open && !!lead?.status && action?.type === "send",
  });

  // Query template order tracking for this lead
  const { data: templateProgress = [] } = useQuery({
    queryKey: ["lead-template-progress", lead?.id, lead?.status],
    queryFn: () => (lead?.id && lead?.status ? fetchLeadTemplateProgress(lead.id, lead.status) : Promise.resolve([])),
    enabled: open && !!lead?.id && action?.type === "send",
  });

  // Determine last order used for this lead
  const lastOrderUsed = useMemo(() => {
    if (!templateProgress || templateProgress.length === 0) return -1;
    return Math.max(...templateProgress.map((p: any) => p.last_order_used));
  }, [templateProgress]);

  // Determine recommended template based on sequence tracking (first with followup_order > lastOrderUsed)
  const recommendedTemplate = useMemo(() => {
    if (!statusTemplates || statusTemplates.length === 0) return null;
    const next = statusTemplates.find((t: any) => t.followup_order > lastOrderUsed);
    return next || statusTemplates[0];
  }, [statusTemplates, lastOrderUsed]);

  // Determine latest completed draft & presentation
  const latestDraft = useMemo(() => {
    return completedWorks
      .filter((w: any) => w.type === "draft")
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  }, [completedWorks]);

  const latestPres = useMemo(() => {
    return completedWorks
      .filter((w: any) => w.type === "presentation")
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  }, [completedWorks]);

  const draftUrl = useMemo(() => {
    return latestDraft ? createPreviewShareUrl({ ...latestDraft, lead }, { preferLiveDomain: true }) : null;
  }, [latestDraft, lead]);

  const presentationUrl = useMemo(() => {
    return latestPres ? createPreviewShareUrl({ ...latestPres, lead }, { preferLiveDomain: true }) : null;
  }, [latestPres, lead]);

  // Pre-select recommended template when opening
  useEffect(() => {
    if (open && recommendedTemplate) {
      setSelectedTemplateId(recommendedTemplate.id);
    }
  }, [open, recommendedTemplate?.id]);

  const activeSelectedTemplate = useMemo(() => {
    return statusTemplates.find((t: any) => t.id === selectedTemplateId) || recommendedTemplate || statusTemplates[0] || null;
  }, [statusTemplates, selectedTemplateId, recommendedTemplate]);

  // Synchronize message text when active template or lead preview links change
  useEffect(() => {
    if (open && lead && action?.type === "send") {
      let rawMsg = activeSelectedTemplate?.message;
      if (!rawMsg) {
        if (lead.status === "info_taken") {
          rawMsg = "Hi ${name}, your presentation draft is ready for review! 🚀\n\nYou can preview the design securely here:\n👉 ${draft}\n\nPlease review it and let us know your feedback!";
        } else {
          rawMsg = "Hi ${name}, your final presentation is ready! 🎯\n\nYou can preview the full presentation here:\n👉 ${presentation}\n\nPlease review and let us know if everything looks great!";
        }
      }
      setMessageText(renderTemplate(rawMsg, lead, { draftUrl, presentationUrl }));
    }
  }, [open, lead?.id, lead?.status, activeSelectedTemplate, draftUrl, presentationUrl, action?.type]);

  // Auto pre-select follow up date for send action (default: tomorrow morning / 24h)
  useEffect(() => {
    if (open && action?.type === "send" && !selectedDate && !noFollowUp) {
      const tomorrowPreset = presets.find((p) => p.label.includes("Tomorrow")) || presets[1] || presets[0];
      if (tomorrowPreset) {
        setSelectedDate(tomorrowPreset.date);
      }
    }
  }, [open, action?.type, presets]);

  const handleDirectSend = async (reminderAt?: Date) => {
    if (!lead || !reminder) return;
    if (!messageText.trim()) {
      toast.error("Please enter a message to send.");
      return;
    }

    setSending(true);
    const toastId = toast.loading(`Sending WhatsApp to ${lead.name || lead.phone}...`);
    try {
      // 1. Try zero-reload WhatsApp Bridge extension first
      const res = await sendDirect({
        leadId: lead.id,
        phone: lead.phone,
        text: messageText.trim(),
        leadName: lead.name || undefined,
      });

      if (res.success) {
        await logAutomatedWhatsapp(lead, messageText.trim());
        if (activeSelectedTemplate) {
          await recordTemplateUsage(
            lead.id,
            lead.status,
            (activeSelectedTemplate.scenario as CallOutcome) || "connected",
            activeSelectedTemplate.followup_order
          );
        }
        await completeReminder(reminder);
        if (nextStatus) {
          await changeStatus(lead, nextStatus, undefined, reminderAt?.toISOString());
        } else if (reminderAt) {
          await createReminder({ leadId: lead.id, title: `Follow up with ${lead.name}`, dueAt: reminderAt.toISOString() });
        }
        toast.success(`WhatsApp delivered to ${lead.name || lead.phone}! Moved to ${statusMeta(nextStatus || lead.status).label}.`, { id: toastId });
        refresh();
        onOpenChange(false);
      } else {
        // Fallback gracefully to WhatsApp Web so sending NEVER fails!
        window.open(waHref(lead.phone, messageText.trim()), "_blank");
        await logAutomatedWhatsapp(lead, messageText.trim());
        if (activeSelectedTemplate) {
          await recordTemplateUsage(
            lead.id,
            lead.status,
            (activeSelectedTemplate.scenario as CallOutcome) || "connected",
            activeSelectedTemplate.followup_order
          );
        }
        await completeReminder(reminder);
        if (nextStatus) {
          await changeStatus(lead, nextStatus, undefined, reminderAt?.toISOString());
        } else if (reminderAt) {
          await createReminder({ leadId: lead.id, title: `Follow up with ${lead.name}`, dueAt: reminderAt.toISOString() });
        }
        toast.success(`WhatsApp Web opened & task completed!`, { id: toastId });
        refresh();
        onOpenChange(false);
      }
    } catch (err: any) {
      window.open(waHref(lead.phone, messageText.trim()), "_blank");
      toast.info(`Opened WhatsApp Web: ${err?.message || "Extension offline"}`, { id: toastId });
    } finally {
      setSending(false);
    }
  };

  const handleCopyAndComplete = async (reminderAt?: Date) => {
    if (!lead || !reminder) return;
    try {
      await copyToClipboardFallback(messageText.trim());
      await logAutomatedWhatsapp(lead, messageText.trim());
      await completeReminder(reminder);
      if (nextStatus) {
        await changeStatus(lead, nextStatus, undefined, reminderAt?.toISOString());
      } else if (reminderAt) {
        await createReminder({ leadId: lead.id, title: `Follow up with ${lead.name}`, dueAt: reminderAt.toISOString() });
      }
      toast.success(`Message copied! Moved to ${statusMeta(nextStatus || lead.status).label}.`);
      refresh();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to copy message: " + (err?.message || "Unknown error"));
    }
  };

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
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {negative ? "Report Setback / Issue" : action?.label || "Complete Task"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-50/80 border border-emerald-200/80 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-xs sm:text-sm font-semibold text-emerald-950 truncate">
                Completing: <span className="font-normal text-emerald-900">{reminder?.title}</span>
              </p>
            </div>
            {lead && (
              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full shrink-0">
                {lead.name || lead.phone}
              </span>
            )}
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
              {lead && <TemplateSuggester lead={lead} status={lead.status} scenario={outcome} />}
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

                    {!negative && action?.type === "send" && lead && (
            <div className="space-y-3.5 rounded-xl border border-border p-3.5 bg-sidebar">
              {/* Readiness Status Banner */}
              {lead.status === "info_taken" ? (
                draftUrl ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="font-semibold truncate">Draft Ready for Review</span>
                      {latestDraft?.created_at && (
                        <span className="text-[11px] text-emerald-700 truncate hidden sm:inline">
                          ({format(new Date(latestDraft.created_at), "MMM d")})
                        </span>
                      )}
                    </div>
                    <a
                      href={draftUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 shrink-0 rounded bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-300 hover:bg-emerald-100 shadow-xs transition-colors"
                    >
                      <Eye className="size-3" /> Test Preview
                    </a>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 shadow-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                      <span>⚠️ Draft not completed yet in Work Management</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      The design team hasn't completed a draft item for this lead. You can still customize the message or add a custom preview link.
                    </p>
                  </div>
                )
              ) : (
                presentationUrl ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="font-semibold truncate">Presentation Ready</span>
                      {latestPres?.created_at && (
                        <span className="text-[11px] text-emerald-700 truncate hidden sm:inline">
                          ({format(new Date(latestPres.created_at), "MMM d")})
                        </span>
                      )}
                    </div>
                    <a
                      href={presentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 shrink-0 rounded bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 border border-emerald-300 hover:bg-emerald-100 shadow-xs transition-colors"
                    >
                      <Eye className="size-3" /> Test Preview
                    </a>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 shadow-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                      <span>⚠️ Presentation not completed yet in Work Management</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-amber-800">
                      The design team hasn't completed a presentation item for this lead. You can still customize the message or add a link manually.
                    </p>
                  </div>
                )
              )}

              {/* Template picker with ⭐ Recommended Order */}
              {statusTemplates.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="template-order-select" className="text-xs font-semibold text-foreground">
                        Select Template Order
                      </label>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              tabIndex={0}
                              className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground cursor-help transition-colors rounded-full focus:outline-none"
                              aria-label="Sequence recommendation details"
                            >
                              <Info className="size-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] p-2.5 text-xs bg-popover text-popover-foreground border shadow-md leading-relaxed z-50">
                            <p className="font-semibold text-foreground mb-1 flex items-center gap-1">
                              <span>⭐ Sequence Recommendation</span>
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              Starred orders indicate the optimal follow-up sequence based on previous messages sent to this lead. You can also pick any order manually.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {statusTemplates.length} {statusTemplates.length === 1 ? "order" : "orders"} available
                    </span>
                  </div>
                  <select
                    id="template-order-select"
                    value={activeSelectedTemplate?.id || ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedTemplateId(id);
                      const tmpl = statusTemplates.find((t: any) => t.id === id);
                      if (tmpl) {
                        setMessageText(renderTemplate(tmpl.message, lead, { draftUrl, presentationUrl }));
                      }
                    }}
                    className={fieldClass}
                  >
                    {statusTemplates.map((t: any) => {
                      const isRec = t.id === recommendedTemplate?.id;
                      return (
                        <option key={t.id} value={t.id}>
                          {isRec ? `⭐ Order ${t.followup_order}: ${t.name} (Recommended)` : `Order ${t.followup_order}: ${t.name}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Message text area */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <label className="font-semibold text-foreground">
                      WhatsApp Message
                    </label>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (Preview link auto-replaced)
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">{messageText.length} chars</span>
                </div>
                <textarea
                  rows={5}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background p-3 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring font-sans resize-y"
                  placeholder="Type message to client..."
                />
              </div>

              {/* Quick insert buttons and recipient note */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground mr-0.5">Quick Insert:</span>
                  {draftUrl && (
                    <button
                      type="button"
                      onClick={() => setMessageText((prev) => (prev ? `${prev}\n\n👉 Preview Draft: ${draftUrl}` : (draftUrl || "")))}
                      className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25 transition-colors shadow-xs"
                      title="Insert client's secure draft preview link"
                    >
                      <Eye className="size-3" /> Draft Link
                    </button>
                  )}
                  {presentationUrl && (
                    <button
                      type="button"
                      onClick={() => setMessageText((prev) => (prev ? `${prev}\n\n👉 Preview Presentation: ${presentationUrl}` : (presentationUrl || "")))}
                      className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25 transition-colors shadow-xs"
                      title="Insert client's secure presentation preview link"
                    >
                      <Eye className="size-3" /> Presentation Link
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const firstName = (lead?.name?.split(" ")[0]) || "Client";
                      setMessageText((prev) => (prev ? `${prev} ${firstName}` : firstName));
                    }}
                    className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-[11px] font-medium hover:bg-secondary transition-colors"
                  >
                    Client Name
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Recipient: <span className="font-semibold text-foreground font-mono">{lead.phone}</span>
                </div>
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
        <DialogFooter className="pt-3 border-t border-border mt-1">
          {!negative && action?.type === "send" ? (
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full">
              <button
                type="button"
                onClick={() => save.mutate(selectedDate || undefined)}
                disabled={save.isPending || sending}
                className="rounded-lg border border-border px-3.5 py-2.5 text-xs font-semibold hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0"
                title="Complete task and schedule follow-up without sending WhatsApp message"
              >
                Save without Sending
              </button>

              <div className="flex items-center gap-2 justify-end">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleCopyAndComplete(selectedDate || undefined)}
                        disabled={sending || !messageText.trim()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-secondary px-3.5 py-2.5 text-xs font-semibold text-foreground transition-all shadow-xs"
                      >
                        <Copy className="size-3.5" />
                        <span>Copy Message</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs bg-popover text-popover-foreground border shadow-md p-2">
                      Copy message to clipboard & mark task complete
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleDirectSend(selectedDate || undefined)}
                        disabled={sending || !messageText.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                      >
                        {sending ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <WhatsAppIcon className="size-4 fill-white" />
                            <span>Send & Complete</span>
                          </>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs bg-popover text-popover-foreground border shadow-md p-2">
                      1-Click Send on WhatsApp via Bridge & complete task
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ) : (
            <button
              onClick={() => save.mutate(selectedDate || undefined)}
              disabled={
                save.isPending ||
                (negative ? !note.trim() : (!selectedDate && !noFollowUp && !markLost))
              }
              className="w-full sm:w-auto rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Save & Complete Task
            </button>
          )}
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

function copyToClipboardFallback(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  return new Promise<void>((resolve, reject) => {
    const success = document.execCommand("copy");
    textArea.remove();
    if (success) resolve();
    else reject(new Error("document.execCommand failed"));
  });
};

export function TemplateSuggester({ lead, status, scenario }: { lead: Lead; status: LeadStatus; scenario: CallOutcome }) {
  // Query all active templates for status & scenario
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['templates-for-suggester', status, scenario, lead.workspace_id],
    queryFn: () => fetchTemplatesForStatusAndScenario(status, scenario, lead.workspace_id || undefined),
  });

  // Query progress tracking for this lead
  const { data: progressList = [] } = useQuery({
    queryKey: ['leadTemplateProgress', lead.id, status, scenario],
    queryFn: () => fetchLeadTemplateProgress(lead.id, status, scenario),
  });

  // Query completed work items to resolve draftUrl & presentationUrl
  const { data: completedWork = [] } = useQuery({
    queryKey: ['completed-work-for-suggester', lead.id],
    queryFn: () => fetchCompletedWorkItemsForLead(lead.id),
    enabled: !!lead.id,
  });

  const latestDraft = useMemo(() => {
    return completedWork
      .filter((w: any) => w.type === 'draft')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  }, [completedWork]);

  const latestPres = useMemo(() => {
    return completedWork
      .filter((w: any) => w.type === 'presentation')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
  }, [completedWork]);

  const draftUrl = latestDraft ? createPreviewShareUrl({ ...latestDraft, lead }, { preferLiveDomain: true }) : null;
  const presentationUrl = latestPres ? createPreviewShareUrl({ ...latestPres, lead }, { preferLiveDomain: true }) : null;

  // Determine last order used and recommended template
  const lastOrderUsed = useMemo(() => {
    if (!progressList || progressList.length === 0) return -1;
    return progressList[0]?.last_order_used ?? -1;
  }, [progressList]);

  const recommendedTemplate = useMemo(() => {
    if (!templates || templates.length === 0) return null;
    const next = templates.find((t: any) => t.followup_order > lastOrderUsed);
    return next || templates[0];
  }, [templates, lastOrderUsed]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => {
    if (recommendedTemplate) {
      setSelectedTemplateId(recommendedTemplate.id);
    }
  }, [recommendedTemplate?.id, scenario]);

  const activeTemplate = useMemo(() => {
    return templates.find((t: any) => t.id === selectedTemplateId) || recommendedTemplate || templates[0] || null;
  }, [templates, selectedTemplateId, recommendedTemplate]);

  const [customText, setCustomText] = useState("");

  useEffect(() => {
    if (activeTemplate) {
      setCustomText(renderTemplate(activeTemplate.message, lead, { draftUrl, presentationUrl }));
    }
  }, [activeTemplate?.id, draftUrl, presentationUrl, lead]);

  const queryClient = useQueryClient();
  const { sendDirect } = useWhatsAppBridge();
  const [sendingTemplate, setSendingTemplate] = useState(false);

  const handleDirectSendTemplate = async (msg: string) => {
    if (!activeTemplate) return;
    setSendingTemplate(true);
    const toastId = toast.loading(`Dispatching template to ${lead.name || lead.phone}...`);
    try {
      const res = await sendDirect({
        leadId: lead.id,
        phone: lead.phone,
        text: msg,
        leadName: lead.name || undefined,
      });

      if (res.success) {
        await logAutomatedWhatsapp(lead, msg);
        await recordTemplateUsage(lead.id, status, scenario, activeTemplate.followup_order);
        toast.success(`Template delivered to ${lead.name || lead.phone}!`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['leadTemplateProgress', lead.id, status, scenario] });
        queryClient.invalidateQueries({ queryKey: ['activities', lead.id] });
      } else {
        window.open(waHref(lead.phone, msg), "_blank");
        await logAutomatedWhatsapp(lead, msg);
        await recordTemplateUsage(lead.id, status, scenario, activeTemplate.followup_order);
        toast.success(`Opened WhatsApp Web!`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ['leadTemplateProgress', lead.id, status, scenario] });
      }
    } catch (err: any) {
      window.open(waHref(lead.phone, msg), "_blank");
      toast.info(`Opened WhatsApp Web: ${err?.message || "Extension offline"}`, { id: toastId });
    } finally {
      setSendingTemplate(false);
    }
  };

  const handleCopy = async () => {
    if (!activeTemplate) return;
    try {
      await copyToClipboardFallback(customText);
      await recordTemplateUsage(lead.id, status, scenario, activeTemplate.followup_order);
      toast.success('Message copied to clipboard!');
      queryClient.invalidateQueries({ queryKey: ['leadTemplateProgress', lead.id, status, scenario] });
    } catch (err: any) {
      toast.error('Failed to copy message: ' + (err?.message || 'Unknown error'));
    }
  };

  if (loadingTemplates) {
    return <div className="animate-pulse h-12 bg-secondary/30 rounded-lg mt-2"></div>;
  }

  if (!templates || templates.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <MessageCircle className="size-3.5" /> Follow-up Template
        </p>
        <span className="text-[10px] text-muted-foreground font-medium">
          {templates.length} {templates.length === 1 ? "order" : "orders"} available
        </span>
      </div>

      {templates.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="suggester-order-select" className="text-[11px] font-semibold text-foreground">
                Select Template Order
              </label>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground cursor-help transition-colors rounded-full focus:outline-none"
                      aria-label="Sequence recommendation details"
                    >
                      <Info className="size-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] p-2 text-xs bg-popover text-popover-foreground border shadow-md leading-relaxed z-50">
                    <p className="font-semibold mb-0.5">⭐ Sequence Recommendation</p>
                    <p className="text-[11px] text-muted-foreground">
                      Starred options represent the optimal follow-up step based on sequence tracking for this lead.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">
              {templates.length} available
            </span>
          </div>
          <select
            id="suggester-order-select"
            value={activeTemplate?.id || ""}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
          >
            {templates.map((t: any) => {
              const isRec = t.id === recommendedTemplate?.id;
              return (
                <option key={t.id} value={t.id}>
                  {isRec ? `⭐ Order ${t.followup_order}: ${t.name} (Recommended)` : `Order ${t.followup_order}: ${t.name}`}
                </option>
              );
            })}
          </select>
        </div>
      )}

      <textarea
        rows={3}
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        className="w-full rounded-md border border-input bg-background p-2 text-xs leading-relaxed outline-none focus:ring-1 focus:ring-ring font-sans resize-y"
        placeholder="Template message..."
      />

      <div className="flex items-center justify-between gap-2 pt-1">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleDirectSendTemplate(customText)}
                disabled={sendingTemplate || !customText.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
              >
                {sendingTemplate ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <WhatsAppIcon className="size-3.5 fill-white" />
                )}
                <span>Send WhatsApp</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs bg-popover text-popover-foreground border shadow-md p-1.5">
              1-Click Send on WhatsApp via Bridge
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors"
        >
          <Copy className="size-3" /> Copy Message
        </button>
      </div>
    </div>
  );
}

/* -------------------------- custom whatsapp dialog -------------------------- */

export function CustomWhatsAppDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { isInstalled, sendDirect } = useWhatsAppBridge();
  const [sending, setSending] = useState(false);

  const { data: completedWork = [] } = useQuery({
    queryKey: ["completed-work-for-dialog", lead?.id],
    queryFn: () => (lead?.id ? fetchCompletedWorkItemsForLead(lead.id) : Promise.resolve([])),
    enabled: open && !!lead?.id,
  });

  const firstName = lead?.name ? lead.name.split(" ")[0] : "there";
  const [message, setMessage] = useState("");

  // Sync initial message when dialog opens or lead changes
  useEffect(() => {
    if (open && lead) {
      setMessage(`Hi ${firstName}, this is Crewvia BNI.`);
    }
  }, [open, lead?.id]);

  const handleSend = async () => {
    if (!lead) return;
    if (!message.trim()) {
      toast.error("Please enter a message to send.");
      return;
    }

    setSending(true);
    const toastId = toast.loading(`Dispatching WhatsApp to ${lead.name || lead.phone}...`);
    try {
      const res = await sendDirect({
        leadId: lead.id,
        phone: lead.phone,
        text: message.trim(),
        leadName: lead.name || undefined,
      });

      if (res.success) {
        await logAutomatedWhatsapp(lead, message.trim());
        toast.success(`WhatsApp message delivered to ${lead.name || lead.phone}!`, { id: toastId });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["activities", lead.id] });
        onOpenChange(false);
      } else {
        toast.error(res.error || "Failed to deliver WhatsApp message", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to dispatch WhatsApp message", { id: toastId });
    } finally {
      setSending(false);
    }
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <WhatsAppIcon className="size-4 text-emerald-600" />
            Send WhatsApp Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/50 p-2.5 rounded-lg border border-border">
            <span>Recipient: <b className="text-foreground">{lead.name || "Lead"}</b></span>
            <span>Phone: <b className="text-foreground font-mono">{lead.phone}</b></span>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Custom Message (supports formatting & line spacing)
            </label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message here..."
              className="w-full rounded-lg border border-input bg-background p-3 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-ring font-sans resize-y"
            />
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">Quick Presets:</span>
            {completedWork.map((w: any) => {
              const shareUrl = createPreviewShareUrl({ ...w, lead }, { preferLiveDomain: true });
              const label = w.type === "presentation" ? "Presentation" : "Draft";
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() =>
                    setMessage(
                      `Hi ${firstName}, your ${label.toLowerCase()} is ready for review! 🚀\n\nYou can preview the design securely here:\n👉 ${shareUrl}\n\nPlease review it and let us know your feedback!`
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25 transition-colors shadow-xs"
                  title="Insert secure preview link into message"
                >
                  <Eye className="size-3" />
                  <span>Insert ${label} Link</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMessage(`Hi ${firstName}, this is Crewvia BNI.`)}
              className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] hover:bg-secondary transition-colors"
            >
              Greeting
            </button>
            <button
              type="button"
              onClick={() =>
                setMessage(
                  `Hi ${firstName}! 😊\nAs discussed on the call, sharing the details required to prepare your BNI presentation.\n\nOur presentation service is ₹1,699, and we'll first create your initial draft absolutely FREE for your review and approval.\n\nTo get started, please share:\n1. Company Name\n2. Your Work / Services\n3. Logo / Banners (if available)\n\nLooking forward to working together! 🙌`
                )
              }
              className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] hover:bg-secondary transition-colors"
            >
              Requirements
            </button>
            <button
              type="button"
              onClick={() =>
                setMessage(
                  `Hi ${firstName}, your presentation draft is ready for review! Please check and let us know your feedback.`
                )
              }
              className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] hover:bg-secondary transition-colors"
            >
              Draft Ready
            </button>
            <button
              type="button"
              onClick={() =>
                setMessage(
                  `Hi ${firstName}, following up on our recent discussion regarding your presentation. Would you be free for a quick call today?`
                )
              }
              className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] hover:bg-secondary transition-colors"
            >
              Follow-up
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={sending}
            className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <WhatsAppIcon className="size-3.5 fill-white" />
                      <span>Send WhatsApp</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs bg-popover text-popover-foreground border shadow-md p-1.5">
                1-Click Send via WhatsApp Bridge
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
