import { Zap } from "lucide-react";
import { createFileRoute, Link, useParams, useNavigate, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  BellRing,
  Check,
  Edit2,
  IndianRupee,
  MessageCircle,
  Phone,
  PhoneCall,
  Trash2,
  Send,
  Download,
  Brain,
  Sparkles,
  Loader2,
  Eye,
  Share2,
  Ban,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PaymentPill, StatusPill } from "@/components/crm-ui";
import {
  CallOutcomeDialog,
  PaymentDialog,
  ReminderDialog,
  StatusChangeDialog,
  useCrmRefresh,
  SmartActionDialog,
  CustomWhatsAppDialog,
} from "@/components/lead-dialogs";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { createPreviewShareUrl } from "@/lib/preview-utils";
import { fetchLeadInformation, fetchAllWorkItemsForLead, expireWorkPreview, regenerateWorkPreview } from "@/lib/work-api";
import {
  ACTIVITY_LABEL,
  LEAD_SOURCES,
  LEAD_STATUSES,
  money,
  outcomeLabel,
  telHref,
  waHref,
  ACTION_CONFIG,
  type Lead,
  type LeadStatus,
  type Reminder,
} from "@/lib/crm";
import {
  addNote,
  cancelReminder,
  completeReminder,
  deleteLead,
  deletePayment,
  fetchActivities,
  fetchLead,
  fetchPayments,
  fetchReminders,
  logWhatsapp,
  logAutomatedWhatsapp,
  updateLeadFields,
} from "@/lib/crm-api";

export const Route = createFileRoute("/_authenticated/leads/$leadId")({
  beforeLoad: ({ context }: any) => {
    if (context?.appRole !== 'admin') {
      throw redirect({ to: "/work" });
    }
  },
  head: () => ({
    meta: [
      { title: "Lead details — Crewvia BNI CRM" },
      {
        name: "description",
        content: "Full lead profile with call history, payments, reminders and complete audit trail.",
      },
      { property: "og:title", content: "Lead details — Crewvia BNI CRM" },
      { property: "og:description", content: "Call history, payments, reminders and audit trail." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeadDetail,
});

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function LeadDetail() {
  const { leadId } = useParams({ from: "/_authenticated/leads/$leadId" });
  const refresh = useCrmRefresh();
  const queryClient = useQueryClient();
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["leads", leadId],
    queryFn: () => fetchLead(leadId),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", leadId],
    queryFn: () => fetchActivities(leadId),
  });
  const { data: leadInfo } = useQuery({
    queryKey: ["lead-info-images", leadId],
    queryFn: () => fetchLeadInformation(leadId),
    enabled: !!leadId,
  });
  const { data: workItems = [] } = useQuery({
    queryKey: ["all-work-items", leadId],
    queryFn: () => fetchAllWorkItemsForLead(leadId),
    enabled: !!leadId,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", leadId],
    queryFn: () => fetchPayments(leadId),
  });
  const { data: allReminders = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: () => fetchReminders(),
  });

  const [callOpen, setCallOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<LeadStatus | null>(null);
  const [previewWorkItem, setPreviewWorkItem] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiInsight, setAiInsight] = useState<{ summary: string; actions: string[] } | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const generateAIInsight = () => {
    setAiGenerating(true);
    setTimeout(() => {
      // Dynamic Heuristic "AI" Analysis
      const notes = lead?.notes || "";
      const lowerNotes = notes.toLowerCase();
      
      let summary = `Based on the timeline, ${lead?.name || "this lead"} is currently in the "${lead?.status.replace('_', ' ')}" stage.`;
      const actions: string[] = [];

      // 1. Note Analysis
      if (lowerNotes.includes("budget") || lowerNotes.includes("expensive") || lowerNotes.includes("price")) {
        summary += " They appear to be highly price-sensitive.";
        actions.push("Send a detailed breakdown of value and ROI to justify the cost.");
        actions.push("Consider offering a small initial discount or flexible payment terms.");
      }
      if (lowerNotes.includes("competitor") || lowerNotes.includes("other agency") || lowerNotes.includes("quotes")) {
        summary += " They are actively comparing quotes with competitors.";
        actions.push("Highlight your unique selling propositions immediately.");
      }
      if (lowerNotes.includes("urgent") || lowerNotes.includes("asap") || lowerNotes.includes("fast")) {
        summary += " There is a high urgency to this request.";
        actions.push("Prioritize this lead: follow up within 24 hours.");
      }

      // 2. Deal Value Analysis
      const value = Number(lead?.deal_value) || 0;
      if (value > 50000) {
        summary += " This is a high-value deal.";
        actions.push("Assign senior team members to handle the presentation.");
      }

      // 3. Activity / Responsiveness
      const calls = activities.filter(a => a.kind === "call").length;
      if (calls > 3 && lead?.status === "take_info") {
        summary += ` You've already made ${calls} calls with no progression.`;
        actions.push("Send a final 'break-up' email to gauge real interest, then stop calling.");
      } else if (calls === 0) {
        actions.push("Initiate the first phone call ASAP to establish personal rapport.");
      }

      // 4. Fallback actions if none matched
      if (actions.length === 0) {
        summary += " The lead seems to be progressing normally.";
        actions.push("Continue following the standard sales process.");
        actions.push(`Next step: move lead to the ${lead?.status === 'take_info' ? 'Info Taken' : 'Next'} stage.`);
      }

      setAiInsight({ summary, actions: actions.slice(0, 3) });
      setAiGenerating(false);
      toast.success("Smart Analysis Complete!");
    }, 1200);
  };
  const [draft, setDraft] = useState<Partial<Lead>>({});
  const [completing, setCompleting] = useState<Reminder | null>(null);
  const saveNote = useMutation({
    mutationFn: () => addNote(lead!, note.trim()),
    onSuccess: () => {
      setNote("");
      refresh();
      toast.success("Note saved");
    },
  });
  const saveFields = useMutation({
    mutationFn: () => updateLeadFields(lead!, draft),
    onSuccess: () => {
      setEditing(false);
      setDraft({});
      refresh();
      toast.success("Lead updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [customWaOpen, setCustomWaOpen] = useState(false);

  const whatsapp = useMutation({ mutationFn: () => logWhatsapp(lead!), onSuccess: refresh });

  const dropReminder = useMutation({
    mutationFn: (id: string) => cancelReminder(allReminders.find((r: Reminder) => r.id === id)!),
    onSuccess: refresh,
  });
  const removePayment = useMutation({
    mutationFn: (id: string) => deletePayment(payments.find((p) => p.id === id)!),
    onSuccess: () => {
      refresh();
      toast.success("Payment removed");
    },
  });

  const navigate = useNavigate();
  const deleteMut = useMutation({
    mutationFn: async () => {
      if (confirm("Are you sure you want to delete this lead? This action cannot be undone.")) {
        await deleteLead(leadId);
        return true;
      }
      return false;
    },
    onSuccess: (deleted) => {
      if (deleted) {
        toast.success("Lead deleted");
        navigate({ to: "/leads" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !lead) {
    return (
      <AppShell title="Loading Lead">
        <div className="grid gap-4 lg:grid-cols-3 animate-pulse">
          <div className="space-y-4 lg:col-span-2">
            <div className="h-32 rounded-xl bg-card border border-border flex items-center justify-center">
              <div className="h-8 w-1/3 bg-primary/10 rounded-md" />
            </div>
            <div className="h-64 rounded-xl bg-card border border-border" />
          </div>
          <div className="space-y-4">
            <div className="h-48 rounded-xl bg-sidebar border border-border" />
            <div className="h-48 rounded-xl bg-sidebar border border-border" />
          </div>
        </div>
      </AppShell>
    );
  }

  const reminders = allReminders.filter((r) => r.lead_id === lead.id);
  const openReminders = reminders.filter((r) => r.state === "pending");
  const pending = Number(lead.deal_value) - Number(lead.amount_paid);
  const value = <K extends keyof Lead>(key: K) => (draft[key] ?? lead[key]) as Lead[K];

  return (
    <AppShell title={lead.name || lead.phone} subtitle={`${lead.name ? lead.phone + " · " : ""}added ${format(new Date(lead.created_at), "d MMM yyyy")}`}>
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/leads"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All leads
        </Link>
        <button
          onClick={() => deleteMut.mutate()}
          disabled={deleteMut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" /> Delete lead
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* quick actions */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={lead.status} />
              <PaymentPill status={lead.payment_status} />
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {lead.source}
              </span>
              {lead.last_call_at ? (
                <span className="text-xs text-muted-foreground">
                  Last call {formatDistanceToNow(new Date(lead.last_call_at), { addSuffix: true })}
                  {outcomeLabel(lead.last_call_outcome) ? ` · ${outcomeLabel(lead.last_call_outcome)}` : ""}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={telHref(lead.phone)}
                onClick={() => setCallOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                <Phone className="size-3.5" /> Call {lead.phone}
              </a>
              <button
                type="button"
                onClick={() => setCustomWaOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all"
                title="Send custom WhatsApp message"
              >
                <Zap className="size-3.5 text-emerald-600 fill-emerald-600" />
                WhatsApp
              </button>
              <button
                onClick={() => setCallOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                <PhoneCall className="size-3.5" /> Log call
              </button>
              <button
                onClick={() => setRemindOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                <BellRing className="size-3.5" /> Reminder
              </button>
              <button
                onClick={() => setPayOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
              >
                <IndianRupee className="size-3.5" /> Payment
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {LEAD_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => s.value !== lead.status && setStatusTarget(s.value)}
                  disabled={s.value === lead.status}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    s.value === lead.status ? s.tone : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* details */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Details</h2>
              <button
                onClick={() => {
                  setEditing((v) => !v);
                  setDraft({});
                }}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {editing ? "Cancel" : "Edit"}
              </button>
            </div>

            {editing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["name", "Name"],
                    ["phone", "Phone"],
                    ["email", "Email"],
                    ["company", "Company"],
                    ["city", "City"],
                    ["service", "Service"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {label}
                    </label>
                    <input
                      className={fieldClass}
                      value={(value(key) as string | null) ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Source
                  </label>
                  <select
                    className={fieldClass}
                    value={value("source")}
                    onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Deal value (₹)
                  </label>
                  <input
                    className={fieldClass}
                    inputMode="numeric"
                    value={String(value("deal_value"))}
                    onChange={(e) => setDraft((d) => ({ ...d, deal_value: Number(e.target.value) }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Notes
                  </label>
                  <textarea
                    className={fieldClass}
                    rows={3}
                    value={(value("notes") as string | null) ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    onClick={() => saveFields.mutate()}
                    disabled={saveFields.isPending || Object.keys(draft).length === 0}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    Save changes
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Field label="Email" value={lead.email} />
                <Field label="Company" value={lead.company} />
                <Field label="City" value={lead.city} />
                <Field label="Service" value={lead.service} />
                <Field label="Deal value" value={money(lead.deal_value)} />
                <Field label="Pending" value={money(pending)} />
                <Field label="Total calls" value={String(lead.call_count)} />
                <Field
                  label="Last contacted"
                  value={
                    lead.last_contacted_at
                      ? format(new Date(lead.last_contacted_at), "d MMM yyyy, h:mm a")
                      : null
                  }
                />
                  <div className="sm:col-span-2 space-y-3 pt-2">
                    <div className="rounded-lg border border-border p-3 bg-secondary/20">
                      <div className="flex items-center justify-between mb-2">
                        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">General Notes & AI</dt>
                        <button onClick={(e) => { e.preventDefault(); generateAIInsight(); }} disabled={aiGenerating} className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-200 shadow-sm">
                          {aiGenerating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                          AI Insights
                        </button>
                      </div>
                      {lead.notes ? (
                        <dd className="text-sm whitespace-pre-wrap text-foreground/90">{lead.notes}</dd>
                      ) : (
                        <dd className="text-sm italic text-muted-foreground">No notes added. (Click AI Insights to analyze timeline instead)</dd>
                      )}
                    </div>
                    {aiInsight && (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <h4 className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">
                          <Brain className="size-3.5" /> Smart Analysis
                        </h4>
                        <p className="text-sm text-indigo-900 mb-3">{aiInsight.summary}</p>
                        <ul className="space-y-1">
                          {aiInsight.actions.map((act, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-indigo-800 font-medium">
                              <Check className="size-3.5 mt-0.5 shrink-0 text-indigo-500" />
                              {act}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
              </dl>
            )}
          </div>

          
          {/* Design Work & Information */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Design Work & Information</h2>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Information</h4>
                <div className="rounded-md bg-secondary p-4 text-sm whitespace-pre-wrap">
                  {leadInfo?.info?.info_text || "No information provided."}
                </div>
              </div>
              
              <div>
                   <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Reference Images</h4>
                   {(!leadInfo?.images || leadInfo.images.length === 0) ? (
                     <p className="text-sm text-muted-foreground">No reference images attached.</p>
                   ) : (
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                       {leadInfo.images.map((img: any) => (
                         <div key={img.id} className="relative rounded-lg border group overflow-hidden bg-muted aspect-square block">
                           <img src={img.file_url} alt={img.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                             <p className="text-white text-xs truncate drop-shadow-md font-medium w-full text-center">
                               {img.title}
                             </p>
                             <a href={img.file_url} target="_blank" rel="noreferrer" className="w-full bg-white/20 hover:bg-white/40 text-white rounded py-1 text-center text-xs backdrop-blur-sm transition-colors">
                               View
                             </a>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                </div>

              <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Work Files</h4>
                  {(!workItems || workItems.length === 0) ? (
                    <p className="text-sm text-muted-foreground">No work files have been requested yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {workItems.map((item: any) => {
                        const isExpired = item.preview_enabled === false;
                        const isCompleted = item.status === "completed" && item.file_url;

                        return (
                          <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border p-3.5 bg-card/60">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold capitalize">{item.type}</p>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                                  {item.status.replace("_", " ")}
                                </span>
                                {isCompleted && (
                                  isExpired ? (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 inline-flex items-center gap-1">
                                      <Ban className="size-2.5" /> Link Expired
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                      <ShieldCheck className="size-2.5" /> Link Active
                                    </span>
                                  )
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">{format(new Date(item.created_at), "d MMM yyyy, h:mm a")}</p>
                            </div>

                            {isCompleted ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Preview in software */}
                                <button
                                  type="button"
                                  onClick={() => setPreviewWorkItem({ ...item, lead })}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-all shadow-sm"
                                >
                                  <Eye className="size-3.5" /> Preview
                                </button>

                                {/* Expire / Revoke Button (shown when active) */}
                                {!isExpired ? (
                                  <button
                                    type="button"
                                    disabled={processingItemId === item.id}
                                    onClick={async () => {
                                      try {
                                        setProcessingItemId(item.id);
                                        await expireWorkPreview(item.id);
                                        await queryClient.invalidateQueries({ queryKey: ["all-work-items", leadId] });
                                        toast.warning(`Preview link for ${item.type} expired! Client can no longer view this presentation.`);
                                      } catch (err: any) {
                                        toast.error(err.message || "Failed to expire preview link");
                                      } finally {
                                        setProcessingItemId(null);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                                    title="Immediately expire this preview link so the client cannot view it"
                                  >
                                    {processingItemId === item.id ? <Loader2 className="size-3 animate-spin" /> : <Ban className="size-3" />}
                                    <span>Expire</span>
                                  </button>
                                ) : null}

                                {/* Regenerate Button */}
                                <button
                                  type="button"
                                  disabled={processingItemId === item.id}
                                  onClick={async () => {
                                    try {
                                      setProcessingItemId(item.id);
                                      const res = await regenerateWorkPreview(item.id);
                                      await queryClient.invalidateQueries({ queryKey: ["all-work-items", leadId] });
                                      const newUrl = createPreviewShareUrl({ ...item, preview_token: res.preview_token, preview_enabled: true, lead }, { preferLiveDomain: true });
                                      navigator.clipboard.writeText(newUrl);
                                      toast.success(`New ${item.type} preview link generated & copied to clipboard! Previous link invalidated.`);
                                    } catch (err: any) {
                                      toast.error(err.message || "Failed to regenerate preview link");
                                    } finally {
                                      setProcessingItemId(null);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                                    isExpired
                                      ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
                                      : "border border-border bg-secondary/80 text-foreground hover:bg-secondary"
                                  }`}
                                  title={isExpired ? "Reactivate link with a fresh token" : "Invalidate old link and create a fresh new URL"}
                                >
                                  {processingItemId === item.id ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                                  <span>{isExpired ? "Regenerate Link" : "Regenerate"}</span>
                                </button>

                                {/* Copy Link */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const shareUrl = createPreviewShareUrl({ ...item, lead }, { preferLiveDomain: true });
                                    navigator.clipboard.writeText(shareUrl);
                                    if (isExpired) {
                                      toast.warning("Copied link, but note this link is currently EXPIRED! Tap Regenerate Link to reactivate.");
                                    } else {
                                      toast.success("Client preview link copied to clipboard!");
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                                  title="Copy Client Preview Link"
                                >
                                  <Share2 className="size-3.5" /> Copy Link
                                </button>

                                {/* Download raw file */}
                                <a 
                                  href={`${item.file_url}?download=${encodeURIComponent(lead?.name || 'Lead')}-${item.type}.${item.file_url.split('.').pop()}`}
                                  download
                                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/30 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                  title="Download raw file"
                                >
                                  <Download className="size-3.5" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">In progress by design team</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
            </div>
          </div>

          {/* timeline */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">
              Timeline & audit trail ({activities.length})
            </h2>
            <div className="mb-4 flex gap-2">
              <input
                className={fieldClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note to the timeline…"
              />
              <button
                onClick={() => saveNote.mutate()}
                disabled={!note.trim() || saveNote.isPending}
                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-accent" />
                    <p className="text-sm font-semibold">{a.summary}</p>
                    {a.detail ? (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.detail}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {ACTIVITY_LABEL[a.kind]} · {format(new Date(a.created_at), "d MMM yyyy, h:mm a")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Payments</h2>
            <p className="text-sm text-muted-foreground">
              {money(lead.amount_paid)} collected of {money(lead.deal_value)}
            </p>
            <div className="mt-3 space-y-2">
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{money(p.amount)}</p>
                        {p.category ? (
                          <span className="rounded-sm bg-secondary px-1 py-0.5 text-[10px] font-medium uppercase text-secondary-foreground">
                            {p.category}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                        {p.method} · {format(new Date(p.paid_at), "d MMM yyyy")}
                      </p>
                    </div>
                    <button
                      onClick={() => removePayment.mutate(p.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove payment"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">
              Reminders ({openReminders.length} open)
            </h2>
            <div className="space-y-2">
              {reminders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reminders yet.</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {r.state} · {format(new Date(r.due_at), "d MMM, h:mm a")}
                    </p>
                    {r.state === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        {(() => {
                          const action = lead ? ACTION_CONFIG[lead.status] : null;
                          let Icon = Check;
                          if (action?.type === "send") Icon = Send;
                          if (action?.type === "call") Icon = PhoneCall;
                          if (action?.type === "payment") Icon = IndianRupee;

                          return (
                            <button
                              onClick={() => setCompleting(r)}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm"
                            >
                              <Icon className="size-3" /> {action?.label || "Done"}
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => dropReminder.mutate(r.id)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <CallOutcomeDialog lead={lead} open={callOpen} onOpenChange={setCallOpen} />
      <PaymentDialog lead={lead} open={payOpen} onOpenChange={setPayOpen} />
      <ReminderDialog lead={lead} open={remindOpen} onOpenChange={setRemindOpen} />
      <StatusChangeDialog
        lead={lead}
        nextStatus={statusTarget}
        open={!!statusTarget}
        onOpenChange={(v) => !v && setStatusTarget(null)}
      />
      <SmartActionDialog
        lead={lead}
        reminder={completing}
        open={!!completing}
        onOpenChange={(v) => !v && setCompleting(null)}
      />
      <CustomWhatsAppDialog
        lead={lead}
        open={customWaOpen}
        onOpenChange={setCustomWaOpen}
      />
      {previewWorkItem && (
        <DocumentPreviewModal
          open={!!previewWorkItem}
          onOpenChange={(v) => !v && setPreviewWorkItem(null)}
          workItem={previewWorkItem}
          onOpenWhatsApp={() => setCustomWaOpen(true)}
          onWorkItemUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["all-work-items", leadId] });
          }}
        />
      )}
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}
