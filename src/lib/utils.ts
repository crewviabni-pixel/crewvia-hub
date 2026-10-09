import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function matchIntelligentSearch(haystack: string, term: string) {
  if (!term) return true;
  const t = term.toLowerCase();
  const h = (haystack || "").toLowerCase();
  const strippedT = t.replace(/\s+/g, "");
  const strippedH = h.replace(/\s+/g, "");
  return h.includes(t) || strippedH.includes(strippedT);
}
