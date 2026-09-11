import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Upload, ExternalLink, ImageIcon, Download, History } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchWorkItems, updateWorkStatus, fetchLeadInformation } from "@/lib/work-api";
import { WorkStatus, WorkType } from "@/lib/crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InformationModal } from "./outbox";
import { Edit2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/work")({
  component: WorkPage,
});

function WorkPage() {
  const [activeTab, setActiveTab] = useState<WorkType>("draft");
  const [showHistory, setShowHistory] = useState(false);

  return (
    <AppShell 
      title={showHistory ? "Work History" : "Work Board"} 
      subtitle={showHistory ? "Previously completed items" : "Manage Drafts and Presentations"}
      actions={
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors ${showHistory ? 'bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
        >
          <History className="size-4 mr-2" />
          {showHistory ? "Back to Board" : "History"}
        </button>
      }
    >
      <div className="mb-6 flex rounded-lg bg-secondary p-1">
        <button
          onClick={() => setActiveTab("draft")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "draft" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Drafts
        </button>
        <button
          onClick={() => setActiveTab("presentation")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "presentation" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Presentations
        </button>
      </div>

      <WorkBoard type={activeTab} showHistory={showHistory} />
    </AppShell>
  );
}

function WorkBoard({ type, showHistory }: { type: WorkType, showHistory: boolean }) {
  const context = useRouteContext({ strict: false }) as any;
  const appRole = context?.appRole || 'designer';

  const { data: items, isLoading } = useQuery({
    queryKey: ["workItems", type, appRole],
    queryFn: () => fetchWorkItems(type),
  });

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto size-6 animate-spin" /></div>;
  }

  const pending = items?.filter(i => i.status === "pending") || [];
  const inProgress = items?.filter(i => i.status === "in_progress") || [];
  
  const completed = items?.filter(i => {
    if (i.status !== "completed") return false;
    if (type === "draft") return i.lead.status !== "draft_sent" && i.lead.status !== "approved" && i.lead.status !== "advance_received" && i.lead.status !== "presentation_sent" && i.lead.status !== "fully_paid" && i.lead.status !== "lost";
    if (type === "presentation") return i.lead.status !== "presentation_sent" && i.lead.status !== "fully_paid" && i.lead.status !== "lost";
    return true;
  }) || [];

  const history = items?.filter(i => {
    if (i.status !== "completed") return false;
    if (type === "draft") return ["draft_sent", "approved", "advance_received", "presentation_sent", "fully_paid", "lost"].includes(i.lead.status);
    if (type === "presentation") return ["presentation_sent", "fully_paid", "lost"].includes(i.lead.status);
    return false;
  }) || [];

  if (showHistory) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        <Column title="History" items={history} appRole={appRole} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Column title="Pending" items={pending} appRole={appRole} />
      <Column title="In Progress" items={inProgress} appRole={appRole} />
      <Column title="Completed" items={completed} appRole={appRole} />
    </div>
  );
}

function Column({ title, items, appRole }: { title: string, items: any[], appRole: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {items.map(item => (
          <WorkCard key={item.id} item={item} appRole={appRole} />
        ))}
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No items
          </div>
        )}
      </div>
    </div>
  );
}

function WorkCard({ item, appRole }: { item: any, appRole: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const { data: leadInfo } = useQuery({
    queryKey: ["lead-info-images", item.lead_id],
    queryFn: () => fetchLeadInformation(item.lead_id),
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ status, file }: { status: WorkStatus, file?: File }) => {
      let fileUrl = undefined;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const filePath = `${item.lead_id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("work_files")
          .upload(filePath, file);
        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from("work_files")
          .getPublicUrl(filePath);
        fileUrl = publicUrlData.publicUrl;
      }
      return updateWorkStatus(item.id, status, fileUrl);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workItems"] });
      setOpen(false);
      toast.success("Work item updated");
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const statusColors = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    completed: "bg-green-500/10 text-green-600 border-green-500/20",
  };

  return (
    <>
    <Dialog open={open && !isEditing} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-accent">
          <div className="flex w-full items-start justify-between gap-2">
            <span className="font-medium leading-tight">{item.lead.name || "Unknown Lead"}</span>
          </div>
          {appRole === 'admin' && item.lead.phone && (
             <div className="text-xs font-medium text-accent">
               {item.lead.phone}
             </div>
          )}
          <p className="text-xs text-muted-foreground line-clamp-2">{item.lead.info_text || "No information provided."}</p>
          <div className="mt-2 flex w-full items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span>{format(new Date(item.created_at), "MMM d, h:mm a")}</span>
            <span className={`rounded px-1.5 py-0.5 border ${statusColors[item.status as keyof typeof statusColors]}`}>
              {item.status.replace("_", " ").toUpperCase()}
            </span>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Work Details</DialogTitle>
        </DialogHeader>
        {appRole === 'admin' && (
          <button 
            onClick={() => setIsEditing(true)} 
            className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <Edit2 className="h-4 w-4" />
            <span className="sr-only">Edit</span>
          </button>
        )}
        <div className="space-y-6 pt-2">
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lead Name</h4>
            <p className="font-medium">{item.lead.name || "Unknown Lead"}</p>
          </div>
          
          {appRole === 'admin' && item.lead.phone && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contact Number</h4>
              <p className="font-medium">{item.lead.phone}</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Information</h4>
            <div className="rounded-md bg-secondary p-4 text-sm whitespace-pre-wrap">
              {item.lead.info_text || "No information."}
            </div>
          </div>
          
          {leadInfo?.images && leadInfo.images.length > 0 && (
            <div>
               <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Reference Images</h4>
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                 {leadInfo.images.map((img: any) => (
                   <div key={img.id} className="relative rounded-lg border group overflow-hidden bg-muted aspect-square block">
                     <img src={img.file_url} alt={img.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                       <p className="text-white text-xs truncate drop-shadow-md font-medium w-full text-center">
                         {img.title}
                       </p>
                       <div className="flex justify-end gap-2">
                         <a href={img.file_url} target="_blank" rel="noreferrer" className="p-1.5 bg-white/20 hover:bg-white/40 rounded-md backdrop-blur">
                           <ExternalLink className="size-3.5 text-white" />
                         </a>
                         <a href={`${img.file_url}?download=`} download className="p-1.5 bg-white/20 hover:bg-white/40 rounded-md backdrop-blur">
                           <Download className="size-3.5 text-white" />
                         </a>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
          
          {item.status !== "completed" && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Update Status</h4>
              <div className="flex gap-2">
                {item.status === "pending" && (
                  <button
                    onClick={() => updateMutation.mutate({ status: "in_progress" })}
                    disabled={updateMutation.isPending}
                    className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"
                  >
                    {updateMutation.isPending ? "Updating..." : "Start Work"}
                  </button>
                )}
                {item.status === "in_progress" && (
                  <div className="w-full space-y-3">
                    <label className="block text-sm font-medium">Upload Final File (PDF/PNG)</label>
                    <input 
                      type="file" 
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploading(true);
                          updateMutation.mutate({ status: "completed", file }, {
                            onSettled: () => setUploading(false)
                          });
                        }
                      }}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-foreground hover:file:bg-accent/90"
                    />
                    {uploading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="size-3 animate-spin"/> Uploading and completing...</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {item.status === "completed" && item.file_url && (
            <div className="pt-4 border-t border-border">
              <a 
                href={`${item.file_url}?download=${encodeURIComponent(item.lead.name)}-${item.type}.${item.file_url.split('.').pop()}`}
                download
                className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
              >
                <Download className="size-4" />
                Download Uploaded File
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {isEditing && (
      <InformationModal lead={item.lead} onClose={() => setIsEditing(false)} editOnly={true} />
    )}
    </>
  );
}
