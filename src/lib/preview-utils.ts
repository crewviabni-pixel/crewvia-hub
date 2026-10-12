/**
 * Utility functions for generating and parsing bulletproof presentation preview URLs
 */

export interface PreviewItemPayload {
  id: string;
  preview_token?: string | null;
  preview_enabled?: boolean | null;
  file_url?: string | null;
  type?: string;
  lead?: {
    name?: string | null;
    company?: string | null;
  } | null;
}

export const LIVE_PROJECT_URL = "https://bni.crewvia.in";

export function createPreviewShareUrl(
  item: PreviewItemPayload,
  options?: { preferLiveDomain?: boolean; includeLegacyPayload?: boolean }
): string {
  let origin = typeof window !== "undefined" && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : LIVE_PROJECT_URL;

  // When sending links to clients over WhatsApp, prefer the public live domain
  if (options?.preferLiveDomain) {
    origin = LIVE_PROJECT_URL;
  }

  if (!item) return origin;
  // Prefer active preview_token, fallback to clean id
  const token = (item.preview_token || item.id || "").trim().replace(/\s+/g, "-");
  
  // Clean short URL: https://bni.crewvia.in/preview/<token>
  if (!options?.includeLegacyPayload) {
    return `${origin}/preview/${token}`;
  }

  if (!item.file_url) return `${origin}/preview/${token}`;

  const payload = {
    f: item.file_url,
    n: item.lead?.name || "",
    c: item.lead?.company || "",
    t: item.type || "presentation",
  };

  try {
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    return `${origin}/preview/${token}?p=${encoded}`;
  } catch {
    return `${origin}/preview/${token}?file=${encodeURIComponent(item.file_url)}&name=${encodeURIComponent(item.lead?.name || "")}`;
  }
}

export function decodePreviewPayload(token: string): {
  file_url: string;
  lead_name: string;
  lead_company: string;
  type: string;
} | null {
  if (!token) return null;
  try {
    const jsonStr = decodeURIComponent(atob(token));
    const parsed = JSON.parse(jsonStr);
    return {
      file_url: parsed.f || "",
      lead_name: parsed.n || "Client",
      lead_company: parsed.c || "",
      type: parsed.t || "presentation",
    };
  } catch (err) {
    console.error("Failed to decode preview payload token:", err);
    return null;
  }
}
