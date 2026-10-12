import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMessageTemplates, saveMessageTemplate, deleteMessageTemplate } from "@/lib/crm-api";
import { LEAD_STATUSES, CALL_OUTCOMES, renderTemplate, type MessageTemplate, type LeadStatus, type CallOutcome } from "@/lib/crm";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [{ title: "Message Templates — Crewvia BNI CRM" }],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates", activeWorkspaceId],
    queryFn: () => fetchMessageTemplates(activeWorkspaceId || undefined),
    enabled: !!activeWorkspaceId
  });

  const deleteMut = useMutation({
    mutationFn: deleteMessageTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted");
    },
  });

  const [editing, setEditing] = useState<Partial<MessageTemplate> | null>(null);

  if (isLoading) {
    return <AppShell title="Message Templates"><div className="animate-pulse h-32 bg-card rounded-xl"></div></AppShell>;
  }

  const grouped = templates.reduce((acc, t) => {
    const status = t.status as string;
    const scenario = t.scenario as string;
    if (!acc[status]) acc[status] = {};
    if (!acc[status][scenario]) acc[status][scenario] = [];
    acc[status][scenario].push(t);
    return acc;
  }, {} as Record<string, Record<string, MessageTemplate[]>>);

  return (
    <AppShell 
      title="Message Templates" 
      subtitle="Manage WhatsApp follow-up sequences based on lead status and call scenarios."
    >
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setEditing({
            name: "",
            message: "",
            status: "take_info",
            scenario: "no_answer",
            followup_order: 0,
            is_active: true,
            workspace_id: activeWorkspaceId || null
          })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="size-4" /> New Template
        </button>
      </div>

      <div className="space-y-8">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border text-muted-foreground">
            No templates found. Create one to get started.
          </div>
        ) : (
          LEAD_STATUSES.map((status) => {
            const scens = grouped[status.value];
            if (!scens) return null;

            return (
              <div key={status.value} className="space-y-4">
                <h2 className="text-lg font-bold font-display px-2 border-l-4 border-primary">
                  {status.label}
                </h2>
                
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {CALL_OUTCOMES.map((scen) => {
                    const list = scens[scen.value];
                    if (!list || list.length === 0) return null;

                    return (
                      <div key={scen.value} className="bg-card rounded-xl border border-border overflow-hidden">
                        <div className="bg-muted/30 px-4 py-2.5 border-b border-border">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            {scen.label}
                          </p>
                        </div>
                        <div className="divide-y divide-border">
                          {list.map((t) => (
                            <div key={t.id} className="p-4 relative hover:bg-muted/10 transition-colors">
                              <div className="flex justify-between items-start gap-4">
                                <div>
                                  <p className="font-semibold text-sm flex items-center gap-2">
                                    <span className="bg-secondary text-secondary-foreground text-[10px] px-1.5 py-0.5 rounded font-mono">Order {t.followup_order}</span>
                                    {t.name}
                                    {!t.is_active && <span className="text-xs text-destructive">(Inactive)</span>}
                                  </p>
                                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                    {t.message}
                                  </p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => setEditing(t)} className="p-1.5 text-muted-foreground hover:bg-secondary rounded-md">
                                    <Pencil className="size-3.5" />
                                  </button>
                                  <button onClick={() => confirm("Delete this template?") && deleteMut.mutate(t.id!)} className="p-1.5 text-destructive/70 hover:bg-destructive/10 rounded-md">
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <TemplateEditor 
          template={editing} 
          onClose={() => setEditing(null)} 
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ["templates"] });
            setEditing(null);
          }}
        />
      )}
    </AppShell>
  );
}

function TemplateEditor({ template, onClose, onSave }: { template: Partial<MessageTemplate>, onClose: () => void, onSave: () => void }) {
  const [form, setForm] = useState(template);
  const saveMut = useMutation({
    mutationFn: () => saveMessageTemplate(form as any),
    onSuccess: () => {
      toast.success("Template saved");
      onSave();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: keyof MessageTemplate, v: any) => setForm(f => ({ ...f, [k]: v }));
  const fieldClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl flex flex-col max-h-[90vh]">
        <h2 className="text-xl font-bold font-display mb-4">{form.id ? "Edit Template" : "New Template"}</h2>
        
        <div className="grid gap-4 overflow-y-auto pr-2 pb-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name</label>
              <input className={fieldClass} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Call Not Picked - Initial" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Order</label>
              <input type="number" min="0" className={fieldClass} value={form.followup_order} onChange={e => set("followup_order", parseInt(e.target.value) || 0)} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status Trigger</label>
              <select className={fieldClass} value={form.status} onChange={e => set("status", e.target.value)}>
                {LEAD_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Scenario Trigger</label>
              <select className={fieldClass} value={form.scenario} onChange={e => set("scenario", e.target.value)}>
                {CALL_OUTCOMES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-xs font-medium text-muted-foreground">
              <span>Message Content</span>
              <span>Click a variable to insert:</span>
            </div>
            
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                { tag: "${name}", label: "${name} (First Name)", desc: "e.g. Rahul" },
                { tag: "${draft}", label: "✨ ${draft} (Preview Link)", desc: "Auto-replaces with client's draft link" },
                { tag: "${presentation}", label: "✨ ${presentation} (Preview Link)", desc: "Auto-replaces with presentation link" },
                { tag: "${fullname}", label: "${fullname}", desc: "Full client name" },
                { tag: "${company}", label: "${company}", desc: "Company name" },
                { tag: "${city}", label: "${city}", desc: "City" },
                { tag: "${phone}", label: "${phone}", desc: "Phone number" },
              ].map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => {
                    const current = form.message || "";
                    set("message", current ? `${current} ${v.tag}` : v.tag);
                  }}
                  title={v.desc}
                  className="rounded border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-mono text-secondary-foreground hover:bg-secondary hover:border-primary/40 transition-colors"
                >
                  {v.label}
                </button>
              ))}
            </div>

            <textarea 
              className={fieldClass} 
              rows={6} 
              value={form.message} 
              onChange={e => set("message", e.target.value)}
              placeholder="Hi ${name}, your presentation draft is ready for review! 🚀&#10;&#10;Preview it here:&#10;👉 ${draft}&#10;&#10;Please let us know your feedback!"
            />

            {(form.status === "info_taken" || form.status === "advance_received") && (
              <p className="mt-1.5 text-xs text-primary font-medium flex items-center gap-1">
                💡 Tip: Use <code className="bg-primary/10 px-1 py-0.5 rounded text-[11px] font-bold">{"${draft}"}</code> or <code className="bg-primary/10 px-1 py-0.5 rounded text-[11px] font-bold">{"${presentation}"}</code>. When sending from reminders, it will automatically be replaced with the client's actual, secure preview link!
              </p>
            )}
          </div>

          <div className="rounded-lg bg-secondary/30 border border-border p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Live Preview (Sample Client)</h3>
            <div className="text-sm whitespace-pre-wrap font-sans text-foreground">
              {renderTemplate(
                form.message || "",
                { name: "Rahul", company: "Tech Inc", city: "Mumbai", phone: "9876543210" },
                {
                  draftUrl: "https://bni.crewvia.in/preview/sample-draft-uuid?p=demo",
                  presentationUrl: "https://bni.crewvia.in/preview/sample-pres-uuid?p=demo",
                }
              )}
            </div>
          </div>
          
          <div className="rounded-lg bg-secondary/30 border border-border p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Live Preview (Fallback Client)</h3>
            <div className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
              {renderTemplate(
                form.message || "",
                { name: "" },
                {
                  draftUrl: "https://bni.crewvia.in/preview/sample-draft-uuid?p=demo",
                  presentationUrl: "https://bni.crewvia.in/preview/sample-pres-uuid?p=demo",
                }
              )}
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} className="rounded border-input" />
            Template is Active
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-lg">Cancel</button>
          <button 
            onClick={() => saveMut.mutate()} 
            disabled={!form.name || !form.message}
            className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}
