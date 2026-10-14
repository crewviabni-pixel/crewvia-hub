import { useState, useEffect } from "react";
import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BellRing,
  LogOut,
  MessageCircle,
  Plus,
  Settings,
  Users,
  Inbox,
  Briefcase,
  Shield,
  FileText,
  Sliders,
  Coins,
  Tags,
  FileUp,
  Save,
  Check,
  CheckCircle2,
  Database,
  Sparkles,
  UploadCloud,
  Loader2,
} from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { requestNotificationPermission } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { CustomFieldsSettings } from "./CustomFieldsSettings";
import { WhatsAppBridgeStatus } from "./WhatsAppBridgeStatus";
import { createLead } from "@/lib/crm-api";
import { useCampaignPrice } from "@/lib/campaign-settings";
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
      { to: "/portfolio-manager", label: "Portfolio", icon: Sparkles },
    ];
  } else {
    navItems = [
      { to: "/work", label: "Work", icon: Briefcase },
      { to: "/portfolio-manager", label: "Portfolio", icon: Sparkles },
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
    { to: "/portfolio-manager", label: "Portfolio", icon: Sparkles },
  ] : [
    { to: "/work", label: "Work", icon: Briefcase },
    { to: "/portfolio-manager", label: "Portfolio", icon: Sparkles },
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
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [pushEnabled, setPushEnabled] = useState(
    typeof window !== "undefined" && Notification.permission === "granted"
  );
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Database-backed Campaign Price
  const { price: dbCampaignPrice, isLoading: isPriceLoading, savePrice } = useCampaignPrice(activeWorkspaceId);
  const [priceInput, setPriceInput] = useState<string>("");
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [isSavedAcknowledgment, setIsSavedAcknowledgment] = useState(false);

  // Sync priceInput with database price whenever campaign or database value changes
  useEffect(() => {
    if (dbCampaignPrice != null) {
      setPriceInput(String(dbCampaignPrice));
    }
  }, [dbCampaignPrice, activeWorkspaceId]);

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

  const handleSavePrice = async () => {
    const val = Number(priceInput);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid positive price amount.");
      return;
    }
    if (!activeWorkspaceId) {
      toast.error("Please select an active campaign first.");
      return;
    }
    setIsSavingPrice(true);
    try {
      await savePrice(val);
      setIsSavedAcknowledgment(true);
      toast.success(
        `Default price for "${activeWorkspace?.name || 'this campaign'}" saved to database as ₹${val.toLocaleString('en-IN')}`
      );
      setTimeout(() => setIsSavedAcknowledgment(false), 3500);
    } catch (err: any) {
      toast.error(err.message || "Failed to save price in database");
    } finally {
      setIsSavingPrice(false);
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

        const targetDealValue = Number(priceInput) || dbCampaignPrice || 10000;

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
              deal_value: targetDealValue,
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

  const hasPriceChanged = Number(priceInput) !== dbCampaignPrice;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          title={appRole === 'designer' ? "Notification Preferences" : "Settings & Campaign Configuration"}
          className="inline-flex size-8.5 items-center justify-center rounded-lg border border-border/80 bg-background/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0 cursor-pointer"
        >
          <Settings className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl w-[95vw] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm shrink-0">
              <Sliders className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="font-display text-base sm:text-lg font-bold">
                  {appRole === 'designer' ? "Preferences" : "Settings & Configuration"}
                </DialogTitle>
                {activeWorkspace && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    <Sparkles className="size-3" />
                    <span>{activeWorkspace.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {appRole === 'designer'
                  ? "Manage push reminder alerts and preferences"
                  : `Database pricing, custom lead fields, and imports for "${activeWorkspace?.name || 'this campaign'}"`}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        {appRole === 'designer' ? (
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20 shadow-sm">
              <div className="space-y-0.5">
                <label className="text-sm font-semibold">Push Notifications</label>
                <p className="text-xs text-muted-foreground">Receive background reminder alerts when due</p>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={togglePush}
                disabled={loading}
              />
            </div>
          </div>
        ) : (
          <Tabs defaultValue="pricing" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Tabs Bar */}
            <div className="px-6 pt-3 pb-2 border-b border-border/60 bg-muted/10 shrink-0">
              <TabsList className="grid grid-cols-3 w-full sm:w-[420px] h-9.5 p-1 bg-muted/60">
                <TabsTrigger value="pricing" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Coins className="size-3.5" />
                  <span>Pricing & Config</span>
                </TabsTrigger>
                <TabsTrigger value="fields" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Tags className="size-3.5" />
                  <span>Custom Fields</span>
                </TabsTrigger>
                <TabsTrigger value="import" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <FileUp className="size-3.5" />
                  <span>Import Leads</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Scrollable Tab Content Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: Pricing & General */}
              <TabsContent value="pricing" className="mt-0 space-y-5">
                {/* Database Price Configuration Card */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 max-w-lg">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-foreground">
                          Campaign Default Deal Value
                        </label>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                          <Database className="size-3" />
                          <span>Database Saved</span>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Saved in the database per campaign. Automatically initializes the Deal Value for every newly captured lead and imported CSV contact in <strong>{activeWorkspace?.name || 'this campaign'}</strong>.
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground font-medium mr-1">Presets:</span>
                      {[5000, 10000, 15000, 25000, 50000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPriceInput(String(preset))}
                          className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all border cursor-pointer ${
                            Number(priceInput) === preset
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80"
                          }`}
                        >
                          ₹{(preset / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Input and Action Button Row */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <div className="relative flex-1 max-w-sm">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm select-none">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="w-full rounded-xl border border-input bg-background py-2.5 pl-8 pr-3 text-base font-bold font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                        placeholder="10000"
                      />
                    </div>

                    {/* Prominent Save / Acknowledgment Button */}
                    <button
                      type="button"
                      onClick={handleSavePrice}
                      disabled={isSavingPrice || (!hasPriceChanged && !isSavedAcknowledgment)}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                        isSavedAcknowledgment
                          ? "bg-emerald-600 text-white border border-emerald-500 shadow-emerald-950/20"
                          : hasPriceChanged
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 active:scale-98"
                          : "bg-muted text-muted-foreground border border-border/80 opacity-70 cursor-not-allowed"
                      }`}
                    >
                      {isSavingPrice ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Saving to Database...</span>
                        </>
                      ) : isSavedAcknowledgment ? (
                        <>
                          <Check className="size-4" />
                          <span>Saved in Database!</span>
                        </>
                      ) : (
                        <>
                          <Save className="size-4" />
                          <span>{hasPriceChanged ? "Save Price Configuration" : "Saved in Database"}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Realtime Status / Confirmation Footer */}
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>
                        Current active database value for <strong>{activeWorkspace?.name || 'campaign'}</strong>:{" "}
                        <strong className="text-foreground font-mono">
                          {isPriceLoading ? "Loading..." : `₹${Number(dbCampaignPrice).toLocaleString('en-IN')}`}
                        </strong>
                      </span>
                    </div>
                    {hasPriceChanged && (
                      <span className="text-amber-500 font-medium">
                        ● Unsaved change: click Save to commit to database
                      </span>
                    )}
                  </div>
                </div>

                {/* Push Notifications Card */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-semibold">Push Notifications</label>
                      <p className="text-xs text-muted-foreground">Receive browser background reminder alerts when tasks are due</p>
                    </div>
                    <Switch
                      checked={pushEnabled}
                      onCheckedChange={togglePush}
                      disabled={loading}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: Custom Lead Fields */}
              <TabsContent value="fields" className="mt-0 space-y-4">
                <CustomFieldsSettings />
              </TabsContent>

              {/* TAB 3: Import Leads */}
              <TabsContent value="import" className="mt-0 space-y-4">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-foreground">Import Leads via CSV</label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Upload a CSV spreadsheet to bulk-add leads to <strong>{activeWorkspace?.name || 'this campaign'}</strong>.
                      Imported leads will automatically receive the campaign default deal value (<strong>₹{Number(priceInput || dbCampaignPrice).toLocaleString('en-IN')}</strong>).
                    </p>
                  </div>

                  {/* Requirements Box */}
                  <div className="rounded-xl bg-muted/40 border border-border/80 p-3.5 space-y-2 text-xs">
                    <p className="font-semibold text-foreground text-xs">CSV Column Requirements:</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground text-[11px]">
                      <li className="flex items-center gap-1.5">
                        <Check className="size-3 text-emerald-500 shrink-0" />
                        <span><strong>Name</strong>: Lead contact name</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="size-3 text-emerald-500 shrink-0" />
                        <span><strong>UserNumber / Phone</strong>: 10-digit number</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">•</span>
                        <span><strong>Source</strong> (optional): Lead source name</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/60">•</span>
                        <span><strong>Deduplication</strong>: Automatic duplicate phone rejection</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <label
                      className={cn(
                        "flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/60 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer text-center",
                        isImporting ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                      )}
                    >
                      <UploadCloud className="size-8 text-muted-foreground mb-2" />
                      <span className="text-xs font-semibold text-foreground">
                        {isImporting ? "Processing and importing leads..." : "Click to select CSV file"}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        Supports UTF-8 CSV exports with header row
                      </span>
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
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            <span>
              Active Campaign: <strong className="text-foreground">{activeWorkspace?.name || 'Default'}</strong>
            </span>
          </div>
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="rounded-xl px-4 text-xs font-semibold cursor-pointer">
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
