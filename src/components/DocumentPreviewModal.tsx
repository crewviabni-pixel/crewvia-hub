import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentCanvasViewer } from "@/components/DocumentCanvasViewer";
import { createPreviewShareUrl } from "@/lib/preview-utils";
import { Link as LinkIcon, Check, Copy, MessageCircle, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItem: {
    id: string;
    type: string;
    file_url?: string | null;
    lead?: {
      name?: string | null;
      phone?: string | null;
      company?: string | null;
    } | null;
  } | null;
  onOpenWhatsApp?: (workItem: any) => void;
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  workItem,
  onOpenWhatsApp,
}: DocumentPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  if (!workItem || !workItem.file_url) return null;

  const leadName = workItem.lead?.name || "Client";
  const typeLabel = workItem.type === "presentation" ? "Presentation" : "Draft";
  const shareUrl = createPreviewShareUrl(workItem, { preferLiveDomain: true });

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Client preview link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-background/95 backdrop-blur-xl border border-border">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/80">
          <div>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span>{leadName} — {typeLabel} Preview</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent uppercase">
                {typeLabel}
              </span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live in-app preview without downloading file to disk.
            </p>
          </div>

          <div className="flex items-center gap-2 pr-6">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-all shadow-sm"
              title="Copy Client Preview Link to share"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Copied Link" : "Copy Client Link"}</span>
            </button>

            {onOpenWhatsApp && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  onOpenWhatsApp(workItem);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm"
                title="Send Preview via WhatsApp"
              >
                <MessageCircle className="size-3.5" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="pt-3">
          <DocumentCanvasViewer
            fileUrl={workItem.file_url}
            leadName={leadName}
            companyName={workItem.lead?.company || undefined}
            title={`${leadName} — ${typeLabel}`}
            isPublicClientView={false} // Internal team view (no DevTools blocking for admins)
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
