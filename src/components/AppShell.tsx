import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, BellRing, LogOut, Plus, Users } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/add-lead", label: "Add", icon: Plus },
  { to: "/reminders", label: "Reminders", icon: BellRing },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/leads" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
              CB
            </span>
            <span className="hidden font-display text-sm font-semibold sm:block">Crewvia BNI</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground",
            )}
            activeProps={{ className: "text-accent-foreground bg-sidebar-accent" }}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
