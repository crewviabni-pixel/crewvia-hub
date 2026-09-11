import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Image as ImageIcon, X, Trash2, Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchLeadInformation, saveInformation, deleteInformationImage } from "@/lib/work-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money, initials } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/outbox")({
  component: OutboxScreen,
});

function OutboxScreen() {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["outbox"],
    queryFn: async () => {
      // 1. Fetch leads whose status requires info
      const { data: inboxLeads, error: inboxErr } = await supabase
        .from("leads")
        .select("*, work_items(*)")
        .in("status", ["info_taken", "advance_received"])
        .order("updated_at", { ascending: false });
      
      if (inboxErr) throw inboxErr;
      
      return inboxLeads.filter(lead => {
        // Only show if there is no active work item for this exact stage
        const expectedType = lead.status === "info_taken" ? "draft" : "presentation";
        const hasActiveWork = (lead.work_items || []).some((w: any) => w.type === expectedType);
        return !hasActiveWork;
      });
    }
  });

  const [activeLead, setActiveLead] = useState<any | null>(null);

  return (
    <AppShell title="Outbox" subtitle="Leads waiting for information to be added">
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : leads.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-xl mt-4">
          No leads currently waiting in the outbox.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                    {initials(lead.name)}
                  </div>
                  <div>
                    <h3 className="font-semibold leading-none">{lead.name}</h3>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{lead.company || lead.service || "No company"}</span>
                      {lead.phone && (
                        <>
                          <span className="size-1 rounded-full bg-muted-foreground/30"></span>
                          <span>{lead.phone}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="px-2 py-1 bg-secondary text-secondary-foreground text-[10px] font-bold rounded uppercase">
                  {lead.status.replace("_", " ")}
                </div>
              </div>
              <div className="mt-auto pt-2">
                <button
                  onClick={() => setActiveLead(lead)}
                  className="w-full inline-flex justify-center items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
                >
                  <Plus className="size-4" />
                  Add Information
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeLead && (
        <InformationModal lead={activeLead} onClose={() => setActiveLead(null)} />
      )}
    </AppShell>
  );
}

export function InformationModal({ lead, onClose, editOnly = false }: { lead: any; onClose: () => void; editOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [leadName, setLeadName] = useState(lead.name || "");
  const [infoText, setInfoText] = useState("");
  const [images, setImages] = useState<{ title: string; file: File; preview: string }[]>([]);
  const [existingImages, setExistingImages] = useState<any[]>([]);

  const { isLoading } = useQuery({
    queryKey: ["lead-info", lead.id],
    queryFn: async () => {
      const data = await fetchLeadInformation(lead.id);
      if (data.info) {
        setInfoText(data.info.info_text || "");
      }
      if (data.images) setExistingImages(data.images);
      return data;
    },
  });

  const uploadImages = async () => {
    const uploaded = [];
    for (const img of images) {
      const ext = img.file.name.split(".").pop();
      const filename = `${lead.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error, data } = await supabase.storage.from("work_files").upload(filename, img.file);
      if (error) throw error;
      
      const { data: publicUrlData } = supabase.storage.from("work_files").getPublicUrl(filename);
      uploaded.push({ title: img.title, file_url: publicUrlData.publicUrl });
    }
    return uploaded;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const uploadedImages = await uploadImages();
      await saveInformation(lead.id, leadName, infoText, uploadedImages, lead.status, editOnly);
    },
    onSuccess: () => {
      toast.success("Information saved successfully");
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
        if (editOnly) queryClient.invalidateQueries({ queryKey: ["workItems"] });
        queryClient.invalidateQueries({ queryKey: ["lead-info-images", lead.id] });
      onClose();
    },
    onError: (err: any) => {
      toast.error("Failed to save information: " + err.message);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files).map(f => ({
        title: f.name,
        file: f,
        preview: URL.createObjectURL(f)
      }));
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeNewImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const deleteExistingImage = async (id: string) => {
    if (!confirm("Delete this image?")) return;
    try {
      await deleteInformationImage(id);
      setExistingImages(prev => prev.filter(img => img.id !== id));
      toast.success("Image deleted");
    } catch (err: any) {
      toast.error("Failed to delete image: " + err.message);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <span>Information for {lead.name}</span>
            {lead.phone && <span className="text-sm font-normal text-muted-foreground">({lead.phone})</span>}
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <label className="text-sm font-medium mb-1 block">Lead Name</label>
              <input 
                type="text"
                value={leadName}
                onChange={e => setLeadName(e.target.value)}
                placeholder="Enter lead name"
                className="w-full rounded-lg border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-ring outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Information Text</label>
              <textarea 
                value={infoText}
                onChange={e => setInfoText(e.target.value)}
                placeholder="Enter all required details for the designer..."
                className="w-full h-32 rounded-lg border border-input bg-background p-3 text-sm resize-none focus:ring-2 focus:ring-ring outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Images / Files</label>
                <div>
                  <input type="file" id="file-upload" multiple className="hidden" onChange={handleFileChange} accept="image/*" />
                  <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
                    <ImageIcon className="size-4" />
                    Add Images
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {existingImages.map(img => (
                  <div key={img.id} className="relative rounded-lg border group overflow-hidden bg-muted aspect-square">
                    <img src={img.file_url} alt={img.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <p className="text-white text-xs truncate drop-shadow-md font-medium">{img.title}</p>
                      <div className="flex justify-end gap-2">
                        <a href={img.file_url} target="_blank" rel="noreferrer" className="p-1.5 bg-white/20 hover:bg-white/40 rounded-md backdrop-blur">
                          <ExternalLink className="size-3.5 text-white" />
                        </a>
                        <button type="button" onClick={() => deleteExistingImage(img.id)} className="p-1.5 bg-destructive hover:bg-destructive/80 rounded-md">
                          <Trash2 className="size-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {images.map((img, idx) => (
                  <div key={idx} className="relative rounded-lg border overflow-hidden bg-muted aspect-square">
                    <img src={img.preview} alt={img.title} className="w-full h-full object-cover opacity-70" />
                    <div className="absolute inset-0 p-2 flex flex-col justify-between">
                      <input 
                        type="text" 
                        value={img.title} 
                        onChange={e => {
                          const newImages = [...images];
                          if (newImages[idx]) newImages[idx].title = e.target.value;
                          setImages(newImages);
                        }}
                        className="text-xs bg-white/80 border-none rounded p-1 shadow-sm w-full"
                        placeholder="Image title"
                      />
                      <div className="flex justify-end">
                        <button type="button" onClick={() => removeNewImage(idx)} className="p-1.5 bg-destructive rounded-md">
                          <X className="size-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t bg-muted/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-secondary rounded-md">
            Cancel
          </button>
          <button 
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving..." : <><Save className="size-4" /> Save Information</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
