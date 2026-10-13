import { useState } from "react";
import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {  BarChart3, BellRing, LogOut, MessageCircle, Plus, Settings, Users, Inbox, Briefcase, Shield , FileText } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { requestNotificationPermission } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CustomFieldsSettings } from "./CustomFieldsSettings";
import { WhatsAppBridgeStatus } from "./WhatsAppBridgeStatus";
import { createLead } from "@/lib/crm-api";
import { toast } from "sonner";

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
  const context = useRouteContext({ strict: false }) as any;
  const appRole = context?.appRole || 'designer';

  const { workspaces, activeWorkspaceId, setActiveWorkspaceId, refreshWorkspaces } = useWorkspace();
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const { data: inboxCount = 0 } = useQuery({
    queryKey: ["inboxCount", activeWorkspaceId],
    queryFn: async () => {
      if (!activeWorkspaceId) return 0;
      const { data } = await supabase
        .from("leads")
        .select(`*, work_items(*)`)
        .eq("workspace_id", activeWorkspaceId)
        .in("status", ["info_taken", "advance_received"]);
      
      if (!data) return 0;
      
      return data.filter(lead => {
        const expectedType = lead.status === "info_taken" ? "draft" : "presentation";
        const hasWork = (lead.work_items || []).some((w: any) => w.type === expectedType);
        return !hasWork;
      }).length;
    },
    enabled: appRole === 'admin' && !!activeWorkspaceId,
    refetchInterval: 30000
  });

  const handleWorkspaceChange = (val: string) => {
    if (val === "new") {
      setIsCreatingWorkspace(true);
    } else {
      setActiveWorkspaceId(val);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    const { data } = await supabase.from("workspaces").insert({ name: newWorkspaceName.trim() }).select().single();
    if (data) {
      await refreshWorkspaces();
      setActiveWorkspaceId(data.id);
      setIsCreatingWorkspace(false);
      setNewWorkspaceName("");
    }
  };

  let navItems = [];
  if (appRole === 'admin') {
    navItems = [
      { to: "/leads", label: "Leads", icon: Users },
      { to: "/reminders", label: "Reminders", icon: BellRing },
      { to: "/work", label: "Work", icon: Briefcase },
      { to: "/templates", label: "Templates", icon: MessageCircle },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/designers", label: "Designers", icon: Shield },
    ];
  } else {
    navItems = [
      { to: "/work", label: "Work", icon: Briefcase },
    ];
  }

  const mobileNavItems = appRole === 'admin' ? [
    { to: "/leads", label: "Leads", icon: Users },
    { to: "/add-lead", label: "Add", icon: Plus },
    { to: "/reminders", label: "Reminders", icon: BellRing },
    { to: "/work", label: "Work", icon: Briefcase },
    { to: "/templates", label: "Templates", icon: MessageCircle },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/designers", label: "Designers", icon: Shield },
  ] : [
    { to: "/work", label: "Work", icon: Briefcase },
  ];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left: Brand & Campaign Switcher */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to={(appRole === 'admin' ? "/leads" : "/work") as any} className="flex items-center gap-2.5 group">
              <div className="grid size-9 place-items-center rounded-xl bg-primary/10 border border-primary/20 shadow-xs group-hover:scale-105 transition-transform">
                <img src="/logo.png" alt="Crewvia Logo" className="size-5 object-contain" />
              </div>
              <span className="font-display font-bold text-sm tracking-tight hidden xl:inline">Crewvia</span>
            </Link>

            <div className="h-5 w-px bg-border/80 hidden sm:block shrink-0" />

            <div className="hidden sm:block min-w-[130px] max-w-[190px]">
              <Select value={activeWorkspaceId || ""} onValueChange={handleWorkspaceChange}>
                <SelectTrigger className="h-8.5 rounded-lg border border-border/80 bg-background/60 hover:bg-secondary/60 px-2.5 font-display font-medium text-xs shadow-none focus:ring-1 focus:ring-ring transition-colors">
                  <SelectValue placeholder={workspaces.length === 0 ? "No Campaigns" : "Select Campaign"} />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="text-xs">{ws.name}</SelectItem>
                  ))}
                  {appRole === 'admin' && (
                    <SelectItem value="new" className="text-primary font-medium border-t mt-1 pt-1 rounded-none text-xs">
                      + Create Campaign
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Center: Main Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-secondary/40 p-1 rounded-xl border border-border/50">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-background/60 whitespace-nowrap"
                activeProps={{ className: "bg-background text-foreground font-semibold shadow-xs" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: Actions & Tools */}
          <div className="flex items-center gap-2 shrink-0">
            {actions ? (
              <div className="shrink-0">{actions}</div>
            ) : appRole === 'admin' ? (
              <Link
                to="/add-lead"
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 text-xs font-semibold text-white shadow-xs whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="size-3.5" />
                <span>New Lead</span>
              </Link>
            ) : null}

            <div className="h-5 w-px bg-border/80 mx-0.5 hidden sm:block shrink-0" />

            {/* WhatsApp Bridge Status Badge (Admin Only) */}
            {appRole === 'admin' && <WhatsAppBridgeStatus />}

            {/* Outbox / Inbox */}
            {appRole === 'admin' && (
              <Link
                to="/outbox"
                title={`Outbox ${inboxCount > 0 ? `(${inboxCount} pending)` : ''}`}
                className="relative inline-flex size-8.5 items-center justify-center rounded-lg border border-border/80 bg-background/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
              >
                <Inbox className="size-4" />
                {inboxCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-xs">
                    {inboxCount}
                  </span>
                )}
              </Link>
            )}

            {/* Settings Dialog */}
            <SettingsDialog appRole={appRole} />

            {/* Sign Out */}
            <button
              onClick={signOut}
              title="Sign out of Crewvia Hub"
              className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive whitespace-nowrap shrink-0 transition-colors"
            >
              <LogOut className="size-3.5" />
              <span className="hidden xl:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-border bg-card md:hidden">
        {mobileNavItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-w-[72px] flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground",
            )}
            activeProps={{ className: "text-accent-foreground bg-sidebar-accent" }}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>
      <Dialog open={isCreatingWorkspace} onOpenChange={setIsCreatingWorkspace}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Create Campaign/Workspace</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign Name</label>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Pastel Arabia"
              />
            </div>
            <button
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim()}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create Workspace
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsDialog({ appRole = "admin" }: { appRole?: string }) {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [pushEnabled, setPushEnabled] = useState(
    typeof window !== "undefined" && Notification.permission === "granted"
  );
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!activeWorkspaceId) {
      toast.error("Please select a workspace first");
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          toast.error("File is empty");
          return;
        }

        // Fetch existing leads for deduplication
        const { data: existingLeads } = await supabase
          .from("leads")
          .select("phone")
          .eq("workspace_id", activeWorkspaceId);
          
        const normalizePhone = (p: string) => {
          if (!p) return "";
          const digits = p.replace(/\D/g, '');
          return digits.length >= 10 ? digits.slice(-10) : digits;
        };

        const existingPhones = new Set(
          (existingLeads || []).map(l => normalizePhone(l.phone))
        );

        const lines = text.split('\n');
        const headers = (lines[0] || '').split(',').map(h => h.replace(/^"|"$/g, '').trim());
        
        let successCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;

        const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        for (let i = 1; i < lines.length; i++) {
          const line = (lines[i] || '').trim();
          if (!line) continue;
          
          const values = line.split(csvRegex).map(val => val.replace(/^"|"$/g, '').trim());
          const row: any = {};
          headers.forEach((header, index) => {
            if (header) {
              row[header] = values[index] || "";
            }
          });

          const rawPhone = row.UserNumber || row.Phone || row.phone || row.phoneNumber || row["User Number"] || "";
          const phoneForCheck = normalizePhone(rawPhone);
          const name = row.Name || row.name || "Unknown";

          if (!phoneForCheck) {
            invalidCount++;
            continue;
          }

          if (existingPhones.has(phoneForCheck)) {
            duplicateCount++;
            continue;
          }

          try {
            await createLead({
              name,
              phone: rawPhone,
              source: row.Source || row.source || "IMPORTED",
              status: "take_info", // Initial status
              deal_value: Number(defaultPrice) || 10000,
              workspace_id: activeWorkspaceId
            });
            existingPhones.add(phoneForCheck); // Add to avoid duplicates within the CSV itself
            successCount++;
          } catch (err) {
            console.error("Error creating lead", err);
            errorCount++;
          }
        }
        
        let msg = `Imported ${successCount} leads.`;
        if (duplicateCount > 0) msg += ` ${duplicateCount} duplicates rejected.`;
        if (invalidCount > 0) msg += ` ${invalidCount} invalid rows rejected.`;
        if (errorCount > 0) msg += ` ${errorCount} failed.`;
        toast.success(msg);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        queryClient.invalidateQueries({ queryKey: ["inboxCount"] });
      } catch (err) {
        console.error("Error parsing CSV", err);
        toast.error("Failed to parse CSV file");
      } finally {
        setIsImporting(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
      setIsImporting(false);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          title={appRole === 'designer' ? "Notification Preferences" : "Settings & Lead Import"}
          className="inline-flex size-8.5 items-center justify-center rounded-lg border border-border/80 bg-background/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
        >
          <Settings className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            {appRole === 'designer' ? "Preferences" : "Settings"}
          </DialogTitle>
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
          
          {appRole === 'admin' && (
            <>
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

              <div className="rounded-lg border border-border p-4 shadow-sm space-y-3">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Import Leads</label>
                  <p className="text-xs text-muted-foreground">Upload a CSV file to add leads to the current workspace. Requires columns: Name, UserNumber.</p>
                </div>
                <div>
                  <label
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors",
                      isImporting ? "opacity-50 cursor-not-allowed" : ""
                    )}
                  >
                    {isImporting ? "Importing..." : "Upload CSV"}
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isImporting}
                    />
                  </label>
                </div>
              </div>
              
              <CustomFieldsSettings />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
