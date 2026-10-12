import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Shield, 
  Plus, 
  Ban, 
  CheckCircle, 
  KeyRound, 
  Copy, 
  Check, 
  Trash2, 
  Search, 
  Sparkles, 
  MessageCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  User, 
  AlertTriangle, 
  Users,
  ExternalLink,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { AppShell } from "@/components/AppShell";
import { fetchDesigners, createDesigner, resetDesignerPassword, deleteDesigner, toggleDesignerSuspension } from "@/lib/work-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/designers")({
  component: DesignersScreen,
});

function generateRandomPassword(length = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

function DesignersScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string;
    name: string;
    password: string;
  } | null>(null);

  const [resetTarget, setResetTarget] = useState<{ userId: string; username: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; username: string } | null>(null);

  const { data: designers = [], isLoading } = useQuery({
    queryKey: ["designers"],
    queryFn: fetchDesigners,
  });

  const toggleSuspensionMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      await toggleDesignerSuspension(userId, suspend);
    },
    onSuccess: (_, variables) => {
      toast.success(variables.suspend ? "Designer access suspended" : "Designer access reactivated");
      queryClient.invalidateQueries({ queryKey: ["designers"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update designer status");
    }
  });

  const filteredDesigners = designers.filter((d: any) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      d.username?.toLowerCase().includes(q) ||
      d.user_id?.toLowerCase().includes(q)
    );
  });

  const activeCount = designers.filter((d: any) => !d.is_suspended).length;
  const suspendedCount = designers.filter((d: any) => d.is_suspended).length;

  return (
    <AppShell title="Designers" subtitle="Manage designer team members and portal access">
      {/* Top Stats & Action Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Designers</p>
            <p className="text-2xl font-bold mt-1">{designers.length}</p>
          </div>
          <div className="size-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Users className="size-5" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Access</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeCount}</p>
          </div>
          <div className="size-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="size-5" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suspended</p>
            <p className="text-2xl font-bold text-destructive mt-1">{suspendedCount}</p>
          </div>
          <div className="size-10 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <Ban className="size-5" />
          </div>
        </div>
      </div>

      {/* Search and Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-all shadow-sm shrink-0"
        >
          <Plus className="size-4" />
          Add Designer
        </button>
      </div>

      {/* Designers Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Designer</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin text-accent" />
                      <span>Loading designers...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDesigners.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Users className="size-8 mx-auto text-muted-foreground/50" />
                      <p className="font-medium text-foreground">No designers found</p>
                      <p className="text-xs text-muted-foreground">
                        {search ? "No designers matched your search query." : "Click 'Add Designer' above to create your first designer account."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDesigners.map((d: any) => {
                  const displayName = d.username ? d.username.charAt(0).toUpperCase() + d.username.slice(1) : "Designer";
                  const initial = (d.username || "D").charAt(0).toUpperCase();

                  return (
                    <tr key={d.user_id} className="hover:bg-muted/30 transition-colors">
                      {/* Avatar and Display Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-accent/20 border border-accent/30 text-accent flex items-center justify-center font-bold text-xs uppercase">
                            {initial}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm leading-tight">{displayName}</p>
                            <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[180px]">{d.user_id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Login Username */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-secondary border border-border text-foreground">
                          {d.username}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {d.created_at ? format(new Date(d.created_at), "d MMM yyyy") : "—"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {d.is_suspended ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2.5 py-0.5 text-xs font-semibold">
                            <Ban className="size-3" /> Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold">
                            <CheckCircle className="size-3" /> Active
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => setResetTarget({ userId: d.user_id, username: d.username })}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                            title="Reset password for this designer"
                          >
                            <KeyRound className="size-3" />
                            <span>Reset PW</span>
                          </button>

                          {/* Suspend / Reactivate */}
                          <button
                            type="button"
                            disabled={toggleSuspensionMutation.isPending}
                            onClick={() => toggleSuspensionMutation.mutate({ userId: d.user_id, suspend: !d.is_suspended })}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              d.is_suspended
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                            }`}
                          >
                            {d.is_suspended ? (
                              <>
                                <CheckCircle className="size-3" /> Reactivate
                              </>
                            ) : (
                              <>
                                <Ban className="size-3" /> Suspend
                              </>
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ userId: d.user_id, username: d.username })}
                            className="inline-flex items-center justify-center size-7 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete designer account"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Designer Dialog */}
      <AddDesignerDialog 
        open={addModalOpen} 
        onOpenChange={setAddModalOpen} 
        onSuccess={(creds) => {
          setAddModalOpen(false);
          setCreatedCredentials(creds);
        }}
      />

      {/* Created Credentials Modal */}
      {createdCredentials && (
        <CredentialsSuccessDialog
          credentials={createdCredentials}
          onClose={() => setCreatedCredentials(null)}
        />
      )}

      {/* Reset Password Dialog */}
      {resetTarget && (
        <ResetPasswordDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <DeleteDesignerDialog
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </AppShell>
  );
}

// ------------------------------------------------------------------------------
// Add Designer Dialog
// ------------------------------------------------------------------------------
function AddDesignerDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (creds: { username: string; name: string; password: string }) => void;
}) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, "");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!cleanUsername) throw new Error("Please enter a username");
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
      return await createDesigner(cleanUsername, password, name.trim());
    },
    onSuccess: () => {
      toast.success(`Designer account "${cleanUsername}" created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["designers"] });
      onSuccess({
        username: cleanUsername,
        name: name.trim() || cleanUsername,
        password,
      });
      // Reset form
      setUsername("");
      setName("");
      setPassword("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create designer");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Plus className="size-5 text-accent" />
            Add Designer
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create a designer account directly. The designer can log in immediately at bni.crewvia.in with no email confirmation needed.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4 py-2"
        >
          {/* Full Name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Full Name (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Username */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Login Username <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. rahul"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {cleanUsername && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Designer logs in with username: <span className="font-mono font-semibold text-foreground">{cleanUsername}</span>
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Password <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={() => setPassword(generateRandomPassword(10))}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              >
                <Sparkles className="size-3" />
                Auto-Generate
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !cleanUsername || password.length < 6}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-all shadow-sm disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              <span>{createMutation.isPending ? "Creating..." : "Create Designer"}</span>
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------
// Credentials Success Dialog (Instant copy & WhatsApp share)
// ------------------------------------------------------------------------------
function CredentialsSuccessDialog({
  credentials,
  onClose,
}: {
  credentials: { username: string; name: string; password: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const portalUrl = "https://bni.crewvia.in/";

  const shareText = `*Crewvia BNI — Designer Portal Login Details*

🔗 *Portal URL:* ${portalUrl}
👤 *Username:* ${credentials.username}
🔑 *Password:* ${credentials.password}

Please log in to view assigned drafts and presentations.`;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success("Login credentials copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="size-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
            <CheckCircle className="size-5" />
          </div>
          <DialogTitle className="text-base font-bold">Designer Account Created!</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Share these credentials with the designer so they can log into the portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Card display */}
          <div className="rounded-xl border border-border bg-secondary/50 p-3.5 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <span className="text-muted-foreground font-sans">Portal Link:</span>
              <a href={portalUrl} target="_blank" rel="noreferrer" className="text-accent font-semibold hover:underline flex items-center gap-1">
                {portalUrl} <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-sans">Username:</span>
              <span className="font-bold text-foreground text-sm">{credentials.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-sans">Password:</span>
              <span className="font-bold text-foreground text-sm">{credentials.password}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Copied!" : "Copy Details"}</span>
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-xs font-semibold transition-colors shadow-sm"
            >
              <MessageCircle className="size-3.5" />
              <span>Share on WhatsApp</span>
            </a>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------
// Reset Password Dialog
// ------------------------------------------------------------------------------
function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: { userId: string; username: string };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      return await resetDesignerPassword(target.userId, newPassword);
    },
    onSuccess: () => {
      toast.success(`Password for ${target.username} has been updated!`);
      queryClient.invalidateQueries({ queryKey: ["designers"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reset password");
    },
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <KeyRound className="size-5 text-accent" />
            Reset Password for @{target.username}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Set a fresh password for this designer. They will immediately be able to sign in with this new password.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            resetMutation.mutate();
          }}
          className="space-y-4 py-2"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                New Password
              </label>
              <button
                type="button"
                onClick={() => setNewPassword(generateRandomPassword(10))}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
              >
                <Sparkles className="size-3" />
                Auto-Generate
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetMutation.isPending || newPassword.length < 6}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/90 transition-all shadow-sm disabled:opacity-50"
            >
              {resetMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
              <span>{resetMutation.isPending ? "Updating..." : "Update Password"}</span>
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------
// Delete Designer Dialog
// ------------------------------------------------------------------------------
function DeleteDesignerDialog({
  target,
  onClose,
}: {
  target: { userId: string; username: string };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await deleteDesigner(target.userId);
    },
    onSuccess: () => {
      toast.success(`Designer "${target.username}" account deleted`);
      queryClient.invalidateQueries({ queryKey: ["designers"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete designer");
    },
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <div className="size-10 rounded-full bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="size-5" />
          </div>
          <DialogTitle className="text-base font-bold">Delete Designer Account?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">@{target.username}</span>? This will permanently revoke their access to the portal.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-all shadow-sm disabled:opacity-50"
          >
            {deleteMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            <span>{deleteMutation.isPending ? "Deleting..." : "Delete Account"}</span>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
