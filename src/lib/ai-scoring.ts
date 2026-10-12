import { type Lead } from "./crm";
import { differenceInDays, differenceInHours } from "date-fns";

export interface AIScoreResult {
  score: number; // 0-100
  color: string; // Tailwind color class for badge
  nextBestAction: string;
}

export function calculateLeadScore(lead: Lead): AIScoreResult {
  let score = 50; // Base score
  let nextBestAction = "Reach out to establish contact.";

  // 1. Status Factor
  switch (lead.status) {
    case "take_info": score += 5; nextBestAction = "Call to gather missing requirements."; break;
    case "info_taken": score += 10; nextBestAction = "Prepare and send initial draft."; break;
    case "draft_sent": score += 20; nextBestAction = "Follow up on the draft. Ask for feedback."; break;
    case "approved": score += 30; nextBestAction = "Draft is approved! Send the formal presentation and request advance."; break;
    case "advance_received": score += 35; nextBestAction = "Advance received. Begin heavy lifting on the project."; break;
    case "presentation_sent": score += 40; nextBestAction = "Presentation sent. Call to close the deal!"; break;
    case "converted": score = 100; nextBestAction = "Deal won! Ensure high quality delivery."; break;
    case "lost": score = 0; nextBestAction = "Deal lost. Analyze reasons for future improvements."; break;
  }

  // 2. Engagement / Responsiveness Factor
  if (lead.status !== "converted" && lead.status !== "lost") {
    if (lead.last_contacted_at) {
      const daysSinceContact = differenceInDays(new Date(), new Date(lead.last_contacted_at));
      if (daysSinceContact === 0) {
        score += 10; // High engagement
      } else if (daysSinceContact > 7) {
        score -= 15; // Going cold
        nextBestAction = "Lead is going cold. Send a re-engagement message immediately.";
      } else if (daysSinceContact > 3) {
        score -= 5;
        nextBestAction = "It's been a few days. Send a gentle follow-up.";
      }
    } else {
      score -= 10; // Never contacted
      nextBestAction = "No contact history. Call them today!";
    }

    if (lead.call_count > 5 && lead.status === "take_info") {
      score -= 20; // Wasting time
      nextBestAction = "High effort, low progression. Consider dropping or sending a final ultimatum email.";
    }
  }

  // 3. Deal Value Factor
  const value = Number(lead.deal_value) || 0;
  if (value > 50000) score += 15;
  else if (value > 20000) score += 5;
  else if (value > 0 && value < 5000) score -= 5;

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine color
  let color = "bg-amber-100 text-amber-800 border-amber-300"; // Warm/Average
  if (score >= 80) color = "bg-emerald-100 text-emerald-800 border-emerald-300"; // Hot
  else if (score < 40) color = "bg-rose-100 text-rose-800 border-rose-300"; // Cold

  if (lead.status === "lost") color = "bg-slate-100 text-slate-800 border-slate-300";

  return { score, color, nextBestAction };
}
