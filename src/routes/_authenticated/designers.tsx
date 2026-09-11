import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Shield, Plus, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchDesigners } from "@/lib/work-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/designers")({
  component: DesignersScreen,
});

function DesignersScreen() {
  const queryClient = useQueryClient();
  const { data: designers = [], isLoading } = useQuery({
    queryKey: ["designers"],
    queryFn: fetchDesigners,
  });

  const toggleSuspension = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string, suspend: boolean }) => {
      const { error } = await supabase.from("user_roles").update({ is_suspended: suspend }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["designers"] });
    }
  });

  return (
    <AppShell title="Designers" subtitle="Manage designer access">
      <div className="mb-6 flex justify-end">
        <AddDesignerDialog />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : designers.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No designers found.</td></tr>
            ) : (
              designers.map(d => (
                <tr key={d.user_id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{d.user_id}</td>
                  <td className="px-4 py-3">
                    {d.is_suspended ? (
                      <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"><Ban className="size-3"/> Suspended</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"><CheckCircle className="size-3"/> Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => toggleSuspension.mutate({ userId: d.user_id, suspend: !d.is_suspended })}
                      className="text-xs font-medium hover:underline text-accent"
                    >
                      {d.is_suspended ? "Reactivate" : "Suspend"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function AddDesignerDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create designer bypass:
      // Capture current session
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.auth.signUp({
        email: `${username.toLowerCase()}@crewviabni.com`,
        password,
      });
      if (error) throw error;
      
      // Wait a moment for trigger
      await new Promise(r => setTimeout(r, 1000));
      
      // Database trigger automatically inserts into user_roles
      // based on the signup email. No need to insert manually.

      // 4. Restore Admin Session
      if (session) {
        await supabase.auth.setSession(session);
      }
    },
    onSuccess: () => {
      toast.success("Designer created");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["designers"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90">
          <Plus className="size-4" /> Add Designer
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Designer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full rounded-md border p-2 text-sm" placeholder="e.g. john" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-md border p-2 text-sm" placeholder="Min 6 characters" />
          </div>
          <button 
            disabled={createMutation.isPending || !username || password.length < 6}
            onClick={() => createMutation.mutate()}
            className="w-full rounded-md bg-primary py-2 text-primary-foreground font-medium text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Designer"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
