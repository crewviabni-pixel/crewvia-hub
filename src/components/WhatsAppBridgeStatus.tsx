import { useState } from "react";
import { Zap, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWhatsAppBridge } from "@/lib/whatsapp-bridge";
import { toast } from "sonner";

export function WhatsAppBridgeStatus() {
  const { isInstalled } = useWhatsAppBridge();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const extensionPath = "extensions/crewvia-whatsapp-bridge";

  const handleCopyPath = () => {
    navigator.clipboard.writeText(extensionPath);
    setCopied(true);
    toast.success("Path copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex h-8.5 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all border whitespace-nowrap shrink-0 ${
          isInstalled
            ? "border-emerald-300/80 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
            : "border-amber-300/80 bg-amber-50/70 text-amber-800 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
        }`}
        title={isInstalled ? "WhatsApp Bridge Active — Click for info" : "WhatsApp Bridge Offline — Click for Setup"}
      >
        <span
          className={`size-2 rounded-full shrink-0 ${
            isInstalled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
          }`}
        />
        <Zap className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">
          {isInstalled ? "Bridge Ready" : "Bridge Setup"}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Zap className="size-5 text-emerald-600" /> Crewvia WhatsApp Bridge Extension
            </DialogTitle>
            <DialogDescription>
              Direct, 1-click automated WhatsApp message sender without backend servers or paid API fees.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status card */}
            <div
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isInstalled
                  ? "bg-emerald-50/50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-200"
                  : "bg-amber-50/50 border-amber-200 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isInstalled ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="size-5 text-amber-600" />
                )}
                <div>
                  <p className="text-xs font-bold">
                    {isInstalled ? "Extension Active & Connected" : "Extension Not Detected"}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {isInstalled
                      ? "1-Click auto-sending is active on https://bni.crewvia.in and local development."
                      : "Load the extension in Chrome to enable 1-Click WhatsApp auto-sending on https://bni.crewvia.in."}
                  </p>
                </div>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-foreground">How to install in Google Chrome (60 seconds):</p>
              <ol className="list-decimal pl-4 space-y-1.5 text-muted-foreground">
                <li>
                  Open Chrome and go to <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">chrome://extensions</code>
                </li>
                <li>Toggle on <b>Developer mode</b> in the top-right corner.</li>
                <li>Click <b>Load unpacked</b> in the top-left corner.</li>
                <li>
                  Select the extension folder from this project:
                  <div className="mt-1 flex items-center gap-1.5">
                    <code className="bg-muted p-1.5 rounded flex-1 text-[11px] font-mono text-foreground select-all break-all">
                      {extensionPath}
                    </code>
                    <button
                      onClick={handleCopyPath}
                      className="p-1.5 border rounded hover:bg-muted"
                      title="Copy path"
                    >
                      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                </li>
                <li>Ensure WhatsApp Web (<a href="https://web.whatsapp.com" target="_blank" rel="noreferrer" className="text-primary underline">web.whatsapp.com</a>) is open and logged in.</li>
              </ol>
            </div>

            <div className="rounded-lg bg-secondary/50 p-3 text-[11px] text-muted-foreground border border-border">
              <span className="font-semibold text-foreground">Anti-Ban Protection Built-In:</span> Messages sent via the bridge include random human pauses (4s–7s) to protect your WhatsApp account from rate limiting.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
