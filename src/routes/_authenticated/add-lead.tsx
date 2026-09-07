import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { presetDates, toLocalInputValue, useCrmRefresh } from "@/components/lead-dialogs";
import { LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from "@/lib/crm";
import { createLead } from "@/lib/crm-api";

export const Route = createFileRoute("/_authenticated/add-lead")({
  head: () => ({
    meta: [
      { title: "Add Lead — Crewvia BNI CRM" },
      {
        name: "description",
        content: "Capture a new Crewvia BNI lead in seconds with source, service, deal value and a first follow-up reminder.",
      },
      { property: "og:title", content: "Add Lead — Crewvia BNI CRM" },
      { property: "og:description", content: "Capture a new lead in seconds." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AddLead,
});

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

function AddLead() {
  const navigate = useNavigate();
  const refresh = useCrmRefresh();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    city: "",
    source: "BNI",
    service: "",
    status: "take_info" as LeadStatus,
    deal_value: "",
    notes: "",
  });

  // Hydrate default price from localStorage on client mount (SSR can't access localStorage)
  useEffect(() => {
    const saved = localStorage.getItem("crewvia_default_price");
    if (saved) setForm((f) => ({ ...f, deal_value: saved }));
  }, []);

  const [reminderAt, setReminderAt] = useState("");

  const set = (key: keyof typeof form, v: string) => setForm((f) => ({ ...f, [key]: v }));

  const save = useMutation({
    mutationFn: async () => {
      if (form.phone.replace(/\D/g, "").length < 7) throw new Error("Enter a valid phone number");
      return createLead({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        city: form.city.trim(),
        source: form.source,
        service: form.service.trim(),
        status: form.status,
        deal_value: Number(form.deal_value || 0),
        notes: form.notes.trim(),
        firstReminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
      });
    },
    onSuccess: (lead) => {
      refresh();
      toast.success("Lead added");
      if (lead) navigate({ to: "/leads/$leadId", params: { leadId: lead.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Add lead" subtitle="Capture the essentials now — you can fill in the rest later.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
      >
        <Labelled label="Name *">
          <input className={fieldClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
        </Labelled>
        <Labelled label="Phone *">
          <input
            className={fieldClass}
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="98765 43210"
          />
        </Labelled>
        <Labelled label="Company">
          <input className={fieldClass} value={form.company} onChange={(e) => set("company", e.target.value)} />
        </Labelled>
        <Labelled label="City">
          <input className={fieldClass} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Labelled>
        <Labelled label="Email">
          <input className={fieldClass} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Labelled>
        <Labelled label="Service / requirement">
          <input className={fieldClass} value={form.service} onChange={(e) => set("service", e.target.value)} />
        </Labelled>
        <Labelled label="Source">
          <select className={fieldClass} value={form.source} onChange={(e) => set("source", e.target.value)}>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Status">
          <select className={fieldClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Deal value (₹)">
          <input
            className={fieldClass}
            inputMode="numeric"
            value={form.deal_value}
            onChange={(e) => set("deal_value", e.target.value)}
            placeholder="0"
          />
        </Labelled>
        <Labelled label="First follow-up reminder">
          <input
            className={fieldClass}
            type="datetime-local"
            value={reminderAt}
            onChange={(e) => setReminderAt(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {presetDates().map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setReminderAt(toLocalInputValue(p.date))}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-secondary"
              >
                {p.label}
              </button>
            ))}
          </div>
        </Labelled>
        <div className="sm:col-span-2">
          <Labelled label="Notes">
            <textarea className={fieldClass} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Labelled>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {save.isPending ? "Saving…" : "Save lead"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
