import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentCanvasViewer } from "@/components/DocumentCanvasViewer";
import { decodePreviewPayload } from "@/lib/preview-utils";
import { ShieldCheck, MessageCircle, AlertTriangle, ArrowRight, Sparkles, Building2 } from "lucide-react";

interface PreviewSearchParams {
  p?: string | undefined;
  file?: string | undefined;
  name?: string | undefined;
  company?: string | undefined;
  type?: string | undefined;
}

export const Route = createFileRoute("/preview/$workId")({
  validateSearch: (search: Record<string, unknown>): PreviewSearchParams => {
    return {
      p: typeof search["p"] === "string" ? search["p"] : undefined,
      file: typeof search["file"] === "string" ? search["file"] : undefined,
      name: typeof search["name"] === "string" ? search["name"] : undefined,
      company: typeof search["company"] === "string" ? search["company"] : undefined,
      type: typeof search["type"] === "string" ? search["type"] : undefined,
    };
  },
  component: PublicPreviewScreen,
});

function PublicPreviewScreen() {
  const { workId } = useParams({ from: "/preview/$workId" });
  const search = Route.useSearch();
  // Normalize workId to handle any pasted spaces or dashes
  const cleanWorkId = (workId || "").trim().replace(/\s+/g, "-");

  // Fallback payload from token or query params (allows zero-config viewing even if Supabase RLS is unconfigured)
  const payloadFromToken = search.p ? decodePreviewPayload(search.p) : null;
  const directFile = payloadFromToken?.file_url || search.file || null;

  const fallbackItem = directFile
    ? {
        id: cleanWorkId,
        file_url: directFile,
        type: payloadFromToken?.type || search.type || "presentation",
        lead_name: payloadFromToken?.lead_name || search.name || "Client",
        lead_company: payloadFromToken?.lead_company || search.company || "",
      }
    : null;

  const { data: dbItem, isLoading, error } = useQuery({
    queryKey: ["public-work-preview", cleanWorkId],
    queryFn: async () => {
      if (!cleanWorkId) throw new Error("No work item specified.");

      // Try fetching via direct query
      const { data, error } = await supabase
        .from("work_items")
        .select("id, type, status, file_url, created_at, leads(id, name, company)")
        .eq("id", cleanWorkId)
        .maybeSingle();

      if (error) {
        // Fallback to RPC if configured
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
          "get_public_work_preview",
          { p_work_id: cleanWorkId }
        );
        if (rpcError) throw error;
        return rpcData;
      }

      return data;
    },
    enabled: !directFile && !!cleanWorkId,
    retry: 1,
  });

  const workItem = fallbackItem || dbItem;
  const isQueryLoading = !directFile && isLoading;

  const lead = (workItem as any)?.leads || (workItem as any)?.lead;
  const leadName = lead?.name || (workItem as any)?.lead_name || "Client";
  const companyName = lead?.company || (workItem as any)?.lead_company || "";
  const typeLabel = workItem?.type === "presentation" ? "Presentation" : "Design Draft";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-accent selection:text-white">
      {/* Top Branded Navigation Bar */}
      <header className="border-b border-neutral-800/80 bg-neutral-900/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-neutral-900 border border-neutral-800 p-1.5 flex items-center justify-center shadow-md shrink-0">
              <img src="/logo.png" alt="Crewvia Logo" className="size-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-white text-base">Crewvia BNI</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="size-3" /> Verified Review
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Official Client Presentation Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/919872399427?text=Hi%20Crewvia%20team,%20I%20am%20reviewing%20my%20presentation."
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-900/30"
            >
              <MessageCircle className="size-3.5" />
              <span>Contact Team</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col items-center">
        {isQueryLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[500px] w-full bg-neutral-900/40 rounded-2xl border border-neutral-800 p-8">
            <div className="size-10 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-neutral-300">Decrypting & loading presentation...</p>
            <p className="text-xs text-neutral-500 mt-1">Establishing secure preview sandbox</p>
          </div>
        ) : error || !workItem || !workItem.file_url ? (
          <div className="flex flex-col items-center justify-center min-h-[460px] w-full bg-neutral-900/40 rounded-2xl border border-neutral-800 p-8 text-center max-w-lg my-auto">
            <AlertTriangle className="size-12 text-amber-500 mb-3" />
            <h2 className="text-lg font-bold text-white">Preview Not Available</h2>
            <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
              This preview link has either expired, is currently in progress by our design team, or is invalid.
            </p>
            <p className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
              If you received this link on WhatsApp, please tap the full link shared by your Crewvia team.
            </p>
            <a
              href="https://wa.me/919872399427"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
            >
              <span>Contact Crewvia Support</span>
              <ArrowRight className="size-3.5" />
            </a>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-6">
            {/* Title & Metadata Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/50 p-4 sm:p-5 rounded-2xl border border-neutral-800/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                    {typeLabel} Review
                  </span>
                  <span className="size-1 rounded-full bg-neutral-600" />
                  <span className="text-xs text-neutral-400">Read-Only Mode</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{leadName}</span>
                </h1>
                {companyName && (
                  <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-1">
                    <Building2 className="size-3.5 text-neutral-500" />
                    <span>{companyName}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="text-right hidden sm:block">
                  <p className="text-[11px] text-neutral-500">Security Protection</p>
                  <p className="text-xs font-semibold text-emerald-400">Anti-Extraction Shield Active</p>
                </div>
              </div>
            </div>

            {/* Canvas-Based Protected Viewer */}
            <DocumentCanvasViewer
              fileUrl={workItem.file_url}
              leadName={leadName}
              companyName={companyName}
              title={`${leadName} — ${typeLabel}`}
              isPublicClientView={true} // Strict anti-inspect and DevTools blocker active
            />

            {/* Bottom Actions for Client */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-900/60 border border-neutral-800">
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="size-4 text-accent" />
                  <span>Ready to approve or request changes?</span>
                </h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Reply directly to your Crewvia BNI coordinator on WhatsApp.
                </p>
              </div>

              <a
                href={`https://wa.me/919872399427?text=${encodeURIComponent(`Hi Crewvia team, I have reviewed the ${typeLabel.toLowerCase()} for ${leadName}. Here is my feedback:`)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-950"
              >
                <MessageCircle className="size-4" />
                <span>Send Feedback / Approval</span>
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600">
        <p>© {new Date().getFullYear()} Crewvia Works. Confidential and proprietary client document.</p>
        <p className="mt-1 text-[11px] text-neutral-700">Protected by Crewvia Secure Document Sandboxing.</p>
      </footer>
    </div>
  );
}
