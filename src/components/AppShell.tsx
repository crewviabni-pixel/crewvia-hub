import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, BellRing, LogOut, MessageCircle, Plus, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { requestNotificationPermission } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const NAV = [
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/add-lead", label: "Add", icon: Plus },
  { to: "/reminders", label: "Reminders", icon: BellRing },
  { to: "/templates", label: "Templates", icon: MessageCircle },
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
            <div className="grid size-8 place-items-center">
              <img src="/logo.png" alt="Crewvia Logo" className="size-full object-contain" />
            </div>
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
            <SettingsDialog />
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

function SettingsDialog() {
  const [pushEnabled, setPushEnabled] = useState(
    typeof window !== "undefined" && Notification.permission === "granted"
  );
  const [loading, setLoading] = useState(false);
  const [defaultPrice, setDefaultPrice] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("crewvia_default_price") || "10000";
    }
    return "10000";
  });

  const togglePush = async (enabled: boolean) => {
    if (!enabled) {
      setPushEnabled(false);
      return;
    }
    setLoading(true);
    const token = await requestNotificationPermission();
    if (token) {
      setPushEnabled(true);
    } else {
      setPushEnabled(false);
    }
    setLoading(false);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDefaultPrice(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("crewvia_default_price", val);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center justify-center rounded-md border border-border bg-card px-2.5 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Settings className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Settings</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4 shadow-sm">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Push Notifications</label>
              <p className="text-xs text-muted-foreground">Receive background reminder alerts</p>
            </div>
            <Switch
              checked={pushEnabled}
              onCheckedChange={togglePush}
              disabled={loading}
            />
          </div>
          
          <div className="rounded-lg border border-border p-4 shadow-sm space-y-3">
            <div className="space-y-0.5">
              <label className="text-sm font-medium">Default Product Price</label>
              <p className="text-xs text-muted-foreground">Used as the default Deal Value for new leads</p>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <input
                type="number"
                value={defaultPrice}
                onChange={handlePriceChange}
                className="w-full rounded-md border border-input bg-background py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="10000"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
