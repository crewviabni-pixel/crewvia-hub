import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { type Lead } from "@/lib/crm";
import { supabase } from "@/integrations/supabase/client";
import { generateAiSummary } from "@/lib/ai-summary.server";

interface AiSummaryDialogProps {
  lead: Lead | null;
  onClose: () => void;
}

// ── Cache helpers ──────────────────────────────────────────────
// We store { fingerprint, summary, generatedAt } per lead in localStorage.
// The fingerprint is built from activity count + latest activity timestamp,
// so any new call/note/status-change/payment automatically invalidates it.

const CACHE_PREFIX = "ai_summary_";

interface CachedSummary {
  fingerprint: string;
  summary: string;
  generatedAt: string;
}

function getCached(leadId: string): CachedSummary | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + leadId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCached(leadId: string, fingerprint: string, summary: string) {
  const entry: CachedSummary = {
    fingerprint,
    summary,
    generatedAt: new Date().toISOString(),
  };
  localStorage.setItem(CACHE_PREFIX + leadId, JSON.stringify(entry));
}

function buildFingerprint(activities: any[]): string {
  if (!activities || activities.length === 0) return "empty";
  const latest = activities[0]?.created_at || "";
  return `${activities.length}::${latest}`;
}

// ── Markdown → HTML ────────────────────────────────────────────
function mdToHtml(md: string): string {
  // Remove <think>...</think> blocks (Qwen thinking tokens)
  let html = md.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Bullet lists
  html = html.replace(/^[-•] (.*)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, "<ul>$1</ul>");
  // Line breaks (but not inside lists)
  html = html.replace(/\n/g, "<br/>");
  // Clean up double br after ul
  html = html.replace(/<\/ul><br\/>/g, "</ul>");
  return html;
}

// ── Component ──────────────────────────────────────────────────

export function AiSummaryDialog({ lead, onClose }: AiSummaryDialogProps) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [cachedAt, setCachedAt] = useState<string>("");

  async function generate(forceRefresh = false) {
    if (!lead) return;

    setLoading(true);
    setSummary("");
    setCachedAt("");

    try {
      // 1. Fetch all activities for this lead
      const { data: activities, error } = await supabase
        .from("activities")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const fp = buildFingerprint(activities || []);

      // 2. Check cache unless force-refreshing
      if (!forceRefresh) {
        const cached = getCached(lead.id);
        if (cached && cached.fingerprint === fp) {
          setSummary(cached.summary);
          setCachedAt(cached.generatedAt);
          setLoading(false);
          return;
        }
      }

      // 3. Build history text
      let historyText = "No previous history found.";
      if (activities && activities.length > 0) {
        historyText = activities
          .map((a) => {
            const date = format(new Date(a.created_at), "MMM d, yyyy h:mm a");
            let details = "";
            if (a.kind === "call") details = `Outcome: ${a.call_outcome || "unknown"}`;
            else if (a.kind === "note") details = `Note: ${a.note || ""}`;
            else if (a.kind === "message") details = `Template: ${a.template_type || "general"}`;
            else if (a.kind === "status_change") details = `Status changed to: ${a.new_status || "unknown"}`;
            else if (a.kind === "payment") details = `Payment received`;
            else details = a.kind;
            return `[${date}] ${a.kind.toUpperCase()} - ${details}`;
          })
          .join("\n");
      }

      const prompt = `Summarize this CRM lead's history into brief, bulleted key points for a quick pre-call context.
Be extremely concise. Use bold (**keyword**) for important outcomes, objections, or money amounts. No generic filler.

Lead Info:
- Name: ${lead.name || "Unknown"}
- Phone: ${lead.phone}
- Company: ${lead.company || "Unknown"}
- Current Status: ${lead.status || "Unknown"}

Activity Logs (newest first):
${historyText}`;

      // 4. Call AI via server function (runs server-side, no CORS)
      const result = await generateAiSummary({
        data: {
          model: "qwen/qwen3-max:free",
          messages: [
            {
              role: "system",
              content:
                "You are a professional CRM assistant. Provide a rapid, highly-personalized context summary based strictly on the provided logs. Use bullet points. Be concise — max 6 bullets. Bold important keywords. Do not add any thinking tags or preamble.",
            },
            { role: "user", content: prompt },
          ],
        },
      });

      const content = result.content;

      // 5. Cache the result
      setCached(lead.id, fp, content);
      setSummary(content);
      setCachedAt(new Date().toISOString());
    } catch (err: any) {
      console.error("AI Summary Error:", err);
      toast.error(err.message || "Could not generate summary");
      setSummary("Failed to generate summary. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (lead) {
      generate(false);
    } else {
      setSummary("");
      setCachedAt("");
    }
  }, [lead]);

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <Sparkles className="size-5" />
              AI Context Summary
            </DialogTitle>
            {!loading && summary && (
              <button
                onClick={() => generate(true)}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                title="Regenerate summary"
              >
                <RefreshCw className="size-3" /> Refresh
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="mt-2 min-h-[150px] rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 text-sm leading-relaxed text-indigo-950">
          {loading ? (
            <div className="flex h-[120px] flex-col items-center justify-center gap-3 text-indigo-400">
              <Loader2 className="size-8 animate-spin" />
              <p className="animate-pulse">Analyzing lead history...</p>
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none prose-indigo [&_ul]:my-1 [&_li]:my-0.5"
              dangerouslySetInnerHTML={{ __html: mdToHtml(summary) }}
            />
          )}
        </div>

        {cachedAt && !loading && (
          <p className="text-[10px] text-muted-foreground text-right">
            Generated {format(new Date(cachedAt), "MMM d, h:mm a")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
