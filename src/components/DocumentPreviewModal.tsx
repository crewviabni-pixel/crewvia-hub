import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentCanvasViewer } from "@/components/DocumentCanvasViewer";
import { createPreviewShareUrl } from "@/lib/preview-utils";
import { expireWorkPreview, regenerateWorkPreview } from "@/lib/work-api";
import { Link as LinkIcon, Check, Copy, MessageCircle, RefreshCw, Ban, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItem: {
    id: string;
    type: string;
    preview_token?: string | null;
    preview_enabled?: boolean | null;
    file_url?: string | null;
    lead?: {
      name?: string | null;
      phone?: string | null;
      company?: string | null;
    } | null;
  } | null;
  canManageLinks?: boolean;
  onOpenWhatsApp?: (workItem: any) => void;
  onWorkItemUpdated?: (updated: any) => void;
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  workItem,
  canManageLinks = true,
  onOpenWhatsApp,
  onWorkItemUpdated,
}: DocumentPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [currentWorkItem, setCurrentWorkItem] = useState<any>(workItem);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync state when workItem changes
  React.useEffect(() => {
    setCurrentWorkItem(workItem);
  }, [workItem]);

  if (!currentWorkItem || !currentWorkItem.file_url) return null;

  const leadName = currentWorkItem.lead?.name || "Client";
  const typeLabel = currentWorkItem.type === "presentation" ? "Presentation" : "Draft";
  const isExpired = currentWorkItem.preview_enabled === false;
  const shareUrl = createPreviewShareUrl(currentWorkItem, { preferLiveDomain: true });

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Client preview link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExpireLink = async () => {
    try {
      setIsProcessing(true);
      const updated = await expireWorkPreview(currentWorkItem.id);
      setCurrentWorkItem((prev: any) => ({ ...prev, preview_enabled: false }));
      onWorkItemUpdated?.({ ...currentWorkItem, preview_enabled: false });
      toast.warning("Preview link expired! Clients can no longer view this document.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to expire preview link");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerateLink = async () => {
    try {
      setIsProcessing(true);
      const updated = await regenerateWorkPreview(currentWorkItem.id);
      const updatedItem = {
        ...currentWorkItem,
        preview_token: updated.preview_token,
        preview_enabled: true,
      };
      setCurrentWorkItem(updatedItem);
      onWorkItemUpdated?.(updatedItem);

      // Auto-copy the new generated URL
      const newUrl = createPreviewShareUrl(updatedItem, { preferLiveDomain: true });
      navigator.clipboard.writeText(newUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      toast.success("New preview link generated & copied! Previous link has been invalidated.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to regenerate preview link");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-background/95 backdrop-blur-xl border border-border">
        <DialogHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>{leadName} — {typeLabel} Preview</span>
              </DialogTitle>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent uppercase">
                {typeLabel}
              </span>
              {canManageLinks && (
                isExpired ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-500 border border-red-500/30">
                    <ShieldAlert className="size-3" /> Link Expired
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="size-3" /> Link Active
                  </span>
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live in-app preview without downloading file to disk.
            </p>
          </div>

          {canManageLinks && (
            <div className="flex items-center gap-2 flex-wrap pr-6">
              {/* Expire / Revoke Link */}
              {!isExpired ? (
                <button
                  type="button"
                  onClick={handleExpireLink}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 pointer-events-auto cursor-pointer"
                  title="Immediately expire this preview link so client cannot view it"
                >
                  {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <Ban className="size-3" />}
                  <span>Expire Link</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRegenerateLink}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-all shadow-sm disabled:opacity-50 pointer-events-auto cursor-pointer"
                  title="Generate a brand new link and reactivate access"
                >
                  {isProcessing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                  <span>Regenerate Link</span>
                </button>
              )}

              {/* Regenerate fresh token button even if active */}
              {!isExpired && (
                <button
                  type="button"
                  onClick={handleRegenerateLink}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border bg-secondary/80 hover:bg-secondary text-foreground transition-all disabled:opacity-50 pointer-events-auto cursor-pointer"
                  title="Invalidate old link and create a fresh new URL"
                >
                  <RefreshCw className="size-3" />
                  <span className="hidden sm:inline">Regenerate</span>
                </button>
              )}

              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-all shadow-sm pointer-events-auto cursor-pointer"
                title="Copy Client Preview Link to share"
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                <span>{copied ? "Copied" : "Copy Link"}</span>
              </button>

              {onOpenWhatsApp && (
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onOpenWhatsApp(currentWorkItem);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm pointer-events-auto cursor-pointer"
                  title="Send Preview via WhatsApp"
                >
                  <MessageCircle className="size-3.5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="pt-3">
          <DocumentCanvasViewer
            fileUrl={currentWorkItem.file_url}
            leadName={leadName}
            companyName={currentWorkItem.lead?.company || undefined}
            title={`${leadName} — ${typeLabel}`}
            isPublicClientView={false} // Internal team view (no DevTools blocking for admins)
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
