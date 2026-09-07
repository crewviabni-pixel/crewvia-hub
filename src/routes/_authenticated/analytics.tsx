import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/crm-ui";
import { LEAD_STATUSES, money, statusMeta } from "@/lib/crm";
import { fetchActivities, fetchLeads, fetchPayments, fetchReminders } from "@/lib/crm-api";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Crewvia BNI CRM" },
      {
        name: "description",
        content: "Live conversion, revenue, pipeline, call activity and source performance for the Crewvia BNI team.",
      },
      { property: "og:title", content: "Analytics — Crewvia BNI CRM" },
      { property: "og:description", content: "Live conversion, revenue and activity metrics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Analytics;
});

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: 0 },
];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Analytics() {
  const [days, setDays] = useState(30);

  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: fetchLeads });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: () => fetchPayments() });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: () => fetchActivities(),
  });
  const { data: reminders = [] } = useQuery({ queryKey: ["reminders"], queryFn: fetchReminders });

  const since = days ? subDays(new Date(), days) : new Date(0);

  const scopedLeads = useMemo(
    () => leads.filter((l) => new Date(l.created_at) >= since),
    [leads, since],
  );
  const scopedPayments = useMemo(
    () => payments.filter((p) => new Date(p.paid_at) >= since),
    [payments, since],
  );

  const converted = scopedLeads.filter((l) => l.status === "converted").length;
  const lost = scopedLeads.filter((l) => l.status === "lost").length;
  const pipelineValue = scopedLeads.reduce((s, l) => s + Number(l.deal_value), 0);
  const collected = scopedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = leads.reduce(
    (s, l) => s + Math.max(Number(l.deal_value) - Number(l.amount_paid), 0),
    0,
  );
  const conversionRate = scopedLeads.length ? (converted / scopedLeads.length) * 100 : 0;
  const callsInRange = activities.filter(
    (a) => a.kind === "call" && new Date(a.created_at) >= since,
  ).length;
  const avgDeal = converted
    ? scopedLeads.filter((l) => l.status === "converted").reduce((s, l) => s + Number(l.deal_value), 0) /
      converted
    : 0;

  const statusData = LEAD_STATUSES.map((s) => ({
    name: s.label,
    value: scopedLeads.filter((l) => l.status === s.value).length,
  })).filter((d) => d.value > 0);

  const sourceData = useMemo(() => {
    const map = new Map<string, { name: string; leads: number; converted: number; revenue: number }>();
    for (const l of scopedLeads) {
      const row = map.get(l.source) ?? { name: l.source, leads: 0, converted: 0, revenue: 0 };
      row.leads += 1;
      if (l.status === "converted") row.converted += 1;
      row.revenue += Number(l.amount_paid);
      map.set(l.source, row);
    }
    return [...map.values()].sort((a, b) => b.leads - a.leads);
  }, [scopedLeads]);

  const trend = useMemo(() => {
    const span = days || 30;
    return Array.from({ length: span }, (_, i) => {
      const day = subDays(new Date(), span - 1 - i);
      const key = format(day, "yyyy-MM-dd");
      return {
        day: format(day, "d MMM"),
        leads: leads.filter((l) => format(new Date(l.created_at), "yyyy-MM-dd") === key).length,
        calls: activities.filter(
          (a) => a.kind === "call" && format(new Date(a.created_at), "yyyy-MM-dd") === key,
        ).length,
        payments: payments
          .filter((p) => format(new Date(p.paid_at), "yyyy-MM-dd") === key)
          .reduce((s, p) => s + Number(p.amount), 0),
      };
    });
  }, [leads, activities, payments, days]);

  const overdue = reminders.filter(
    (r) => r.state === "pending" && new Date(r.due_at).getTime() < Date.now(),
  ).length;

  return (
    <AppShell
      title="Analytics"
      subtitle="Every number is calculated live from your leads, calls and payments."
      actions={
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border border-input bg-background px-2.5 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring"
        >
          {RANGES.map((r) => (
            <option key={r.days} value={r.days}>
              {r.label}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Leads" value={String(scopedLeads.length)} hint={`${leads.length} all time`} />
        <StatCard
          label="Converted"
          value={String(converted)}
          hint={`${conversionRate.toFixed(1)}% conversion`}
          accent
        />
        <StatCard label="Collected" value={money(collected)} hint={`${scopedPayments.length} payments`} />
        <StatCard label="Outstanding" value={money(outstanding)} hint="Across all leads" />
        <StatCard label="Pipeline value" value={money(pipelineValue)} />
        <StatCard label="Calls logged" value={String(callsInRange)} />
        <StatCard label="Avg deal size" value={money(avgDeal)} />
        <StatCard label="Overdue reminders" value={String(overdue)} hint={`${lost} leads lost`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Panel title="Leads & calls per day">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="leads" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="calls" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Revenue collected per day">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Bar dataKey="payments" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Pipeline by status">
          {statusData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Source performance">
          {sourceData.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2">Source</th>
                    <th className="py-2">Leads</th>
                    <th className="py-2">Converted</th>
                    <th className="py-2">Rate</th>
                    <th className="py-2 text-right">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceData.map((s) => (
                    <tr key={s.name} className="border-b border-border/60 last:border-0">
                      <td className="py-2 font-medium">{s.name}</td>
                      <td className="py-2">{s.leads}</td>
                      <td className="py-2">{s.converted}</td>
                      <td className="py-2">{((s.converted / s.leads) * 100).toFixed(0)}%</td>
                      <td className="py-2 text-right">{money(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Status funnel" className="mt-4">
        <div className="space-y-2">
          {LEAD_STATUSES.map((s) => {
            const count = scopedLeads.filter((l) => l.status === s.value).length;
            const pct = scopedLeads.length ? (count / scopedLeads.length) * 100 : 0;
            return (
              <div key={s.value}>
                <div className="mb-1 flex items-center justify-between text-xs font-medium">
                  <span>{statusMeta(s.value).label}</span>
                  <span className="text-muted-foreground">
                    {count} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </AppShell>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`}>
      <h2 className="mb-3 font-display text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>;
}
