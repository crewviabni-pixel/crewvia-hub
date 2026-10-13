import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DocumentCanvasViewer } from "@/components/DocumentCanvasViewer";
import { AntiBotShield } from "@/components/AntiBotShield";
import { decodePreviewPayload } from "@/lib/preview-utils";
import { ShieldCheck, MessageCircle, AlertTriangle, ArrowRight, Sparkles, Building2, Lock, ShieldAlert } from "lucide-react";

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

const CREWVIA_TEAM_WHATSAPP_NUMBER = "917223804653";

function PublicPreviewScreen() {
  const { workId } = useParams({ from: "/preview/$workId" });
  const search = Route.useSearch();
  // Normalize workId to handle any pasted spaces or dashes
  const cleanWorkId = (workId || "").trim().replace(/\s+/g, "-");

  // Anti-indexing meta tag injection
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow, noarchive, nosnippet, noimageindex";
  }, []);

  // Fallback payload from legacy token or query params for backward compatibility
  const payloadFromToken = search.p ? decodePreviewPayload(search.p) : null;
  const directFile = payloadFromToken?.file_url || search.file || null;

  const fallbackItem = directFile
    ? {
        id: cleanWorkId,
        file_url: directFile,
        type: payloadFromToken?.type || search.type || "presentation",
        lead_name: payloadFromToken?.lead_name || search.name || "Client",
        lead_company: payloadFromToken?.lead_company || search.company || "",
        preview_enabled: true,
      }
    : null;

  const { data: dbItem, isLoading, error } = useQuery({
    queryKey: ["public-work-preview", cleanWorkId],
    queryFn: async () => {
      if (!cleanWorkId) throw new Error("No work item specified.");

      // 1. Try fetching via direct query matching either preview_token or id
      try {
        const { data: tokenData, error: tokenError } = await (supabase as any)
          .from("work_items")
          .select("id, preview_token, preview_enabled, preview_revoked_at, type, status, file_url, created_at, leads(id, name, company)")
          .or(`preview_token.eq.${cleanWorkId},id.eq.${cleanWorkId}`)
          .maybeSingle();

        if (tokenData) {
          return tokenData;
        }
        if (tokenError && !tokenError.message?.includes("column")) {
          console.warn("Direct query error:", tokenError);
        }
      } catch (err) {
        console.warn("Primary query exception:", err);
      }

      // 2. Fallback to basic query by ID
      const { data, error } = await supabase
        .from("work_items")
        .select("id, type, status, file_url, created_at, leads(id, name, company)")
        .eq("id", cleanWorkId)
        .maybeSingle();

      if (data && data.file_url) {
        return data;
      }

      // 3. Fallback to RPC if configured
      try {
        const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
          "get_public_work_preview",
          { p_work_id: cleanWorkId }
        );
        if (!rpcError && rpcData && rpcData.file_url) {
          return rpcData;
        }
      } catch (rpcErr) {
        console.warn("RPC query fallback attempt:", rpcErr);
      }

      if (error) throw error;
      return data;
    },
    enabled: !directFile && !!cleanWorkId,
    retry: 1,
  });

  const workItem = fallbackItem || dbItem;
  const isQueryLoading = !directFile && isLoading;

  const isExpired = workItem && (workItem as any).preview_enabled === false;

  const lead = (workItem as any)?.leads || (workItem as any)?.lead;
  const leadName = lead?.name || (workItem as any)?.lead_name || "Client";
  const companyName = lead?.company || (workItem as any)?.lead_company || "";
  const typeLabel = workItem?.type === "presentation" ? "Presentation" : "Design Draft";

  return (
    <AntiBotShield>
      <div className="min-h-screen w-full overflow-x-hidden bg-neutral-950 text-neutral-100 flex flex-col selection:bg-accent selection:text-white">
        {/* Top Branded Navigation Bar */}
        <header className="border-b border-neutral-800/80 bg-neutral-900/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
            {/* Mobile Left: Brand + Lead Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 sm:size-10 rounded-xl bg-neutral-900 border border-neutral-800 p-1 sm:p-1.5 flex items-center justify-center shadow-md shrink-0">
                <img src="/logo.png" alt="Crewvia Logo" className="size-full object-contain" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold tracking-tight text-white text-xs sm:text-base truncate max-w-[150px] sm:max-w-none">
                    {leadName}
                  </span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                    <ShieldCheck className="size-2.5 sm:size-3" />
                    <span>Verified</span>
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-neutral-400 truncate">
                  {companyName ? `${companyName} • ` : ""}{typeLabel} Portal
                </p>
              </div>
            </div>

            {/* Right: Direct WhatsApp Action */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`https://wa.me/${CREWVIA_TEAM_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Crewvia team, I am reviewing my ${typeLabel.toLowerCase()} (${cleanWorkId}).`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-950 active:scale-95"
              >
                <MessageCircle className="size-3.5" />
                <span className="hidden xs:inline sm:inline">WhatsApp</span>
                <span className="xs:hidden sm:hidden">Chat</span>
              </a>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-2 sm:px-4 py-2 sm:py-8 flex flex-col items-center pb-20 sm:pb-8">
          {isQueryLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[500px] w-full bg-neutral-900/40 rounded-2xl border border-neutral-800 p-8">
              <div className="size-10 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium text-neutral-300">Decrypting & loading presentation...</p>
              <p className="text-xs text-neutral-500 mt-1">Establishing secure preview sandbox</p>
            </div>
          ) : isExpired ? (
            /* Explicit Expired Link State */
            <div className="flex flex-col items-center justify-center min-h-[460px] w-full bg-neutral-900/60 rounded-2xl border border-amber-500/30 p-8 text-center max-w-lg my-auto shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
              <div className="size-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                <Lock className="size-7" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-2 uppercase tracking-wider">
                <ShieldAlert className="size-3.5" /> Link Access Expired
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Presentation Preview Expired
              </h2>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                Access to this presentation preview has been expired by the Crewvia team. This document is currently protected and deactivated.
              </p>
              <p className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
                If you need to review this presentation again, please tap below to request a fresh access link from your coordinator.
              </p>
              <a
                href={`https://wa.me/${CREWVIA_TEAM_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Crewvia team, my presentation preview link for ${leadName} has expired. Please send me a new link.`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-950"
              >
                <MessageCircle className="size-4" />
                <span>Request Fresh Link on WhatsApp</span>
              </a>
            </div>
          ) : error || !workItem || !workItem.file_url ? (
            <div className="flex flex-col items-center justify-center min-h-[460px] w-full bg-neutral-900/40 rounded-2xl border border-neutral-800 p-8 text-center max-w-lg my-auto">
              <AlertTriangle className="size-12 text-amber-500 mb-3" />
              <h2 className="text-lg font-bold text-white">Preview Not Available</h2>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                This preview link has either expired, is currently in progress by our design team, or is invalid.
              </p>
              <p className="mt-2 text-[11px] text-neutral-500 leading-relaxed">
                If you have any questions or need immediate assistance, please reach out to our team directly.
              </p>
              <a
                href={`https://wa.me/${CREWVIA_TEAM_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Crewvia team, I need assistance with preview ${cleanWorkId}.`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
              >
                <span>Contact Crewvia Support</span>
                <ArrowRight className="size-3.5" />
              </a>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-2.5 sm:gap-6">
              {/* Title & Metadata Header (Desktop only; on mobile & tablets, lead title is in the top app bar) */}
              <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-neutral-900/50 p-4 sm:p-5 rounded-2xl border border-neutral-800/80">
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
                    <p className="text-xs font-semibold text-emerald-400">Anti-Extraction & Anti-Bot Shield Active</p>
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 shadow-lg mb-6 sm:mb-0 text-center sm:text-left">
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center justify-center sm:justify-start gap-1.5">
                    <Sparkles className="size-4 text-accent shrink-0" />
                    <span>Ready to approve or request revisions?</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Share your instant feedback with your Crewvia coordinator on WhatsApp.
                  </p>
                </div>

                <a
                  href={`https://wa.me/${CREWVIA_TEAM_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Crewvia team, I have reviewed the ${typeLabel.toLowerCase()} for ${leadName}. Here is my feedback:`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white transition-all shadow-lg shadow-emerald-950/60"
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
          <p className="mt-1 text-[11px] text-neutral-700">Protected by Crewvia Secure Document Sandboxing & Anti-Scraping Defense.</p>
        </footer>
      </div>
    </AntiBotShield>
  );
}

