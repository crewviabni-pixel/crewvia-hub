import { supabase } from "@/integrations/supabase/client";
import { type PortfolioItem, type PortfolioSlide } from "./portfolio-sample-decks";
import {
  loadPortfolioItemsFromStorage,
  savePortfolioItemToStorage,
  deletePortfolioItemFromStorage,
  clearAllPortfolioStorage,
  getMemoryPortfolioItems,
  isManuallyAddedItem,
  markPortfolioIdAsDeleted,
  getDeletedPortfolioIds,
} from "./portfolio-storage";

export type { PortfolioItem, PortfolioSlide };

const REGISTRY_STORAGE_PATH = "portfolio_registry.json";

/**
 * Generate a crisp SVG slide cover if a custom cover was not uploaded
 */
export function generateFallbackCover(title: string, category: string, clientName?: string): string {
  const safeTitle = (title || "Presentation Deck").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeClient = (clientName || "Crewvia Works").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeCat = (category || "Presentations").toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#080d1a"/>
        <stop offset="50%" stop-color="#0e172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <radialGradient id="aura" cx="70%" cy="30%" r="60%">
        <stop offset="0%" stop-color="rgba(37,99,235,0.28)"/>
        <stop offset="50%" stop-color="rgba(16,185,129,0.12)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
      </radialGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <rect width="1280" height="720" fill="url(#aura)"/>
    <g transform="translate(100, 120)">
      <rect x="0" y="0" width="180" height="34" rx="17" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)"/>
      <text x="90" y="22" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#38bdf8" text-anchor="middle" letter-spacing="2">${safeCat}</text>
      <text x="0" y="150" font-family="system-ui, sans-serif" font-size="52" font-weight="800" fill="#ffffff" letter-spacing="-1">${safeTitle.slice(0, 38)}</text>
      <text x="0" y="210" font-family="system-ui, sans-serif" font-size="24" font-weight="500" fill="rgba(255,255,255,0.7)">${safeClient}</text>
    </g>
    <g transform="translate(100, 590)">
      <circle cx="20" cy="20" r="16" fill="#1e3a8a"/>
      <text x="50" y="26" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#ffffff">Crewvia</text>
      <text x="125" y="26" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#10b981">Visuals</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Deduplicate portfolio presentations:
 * Guarantees no project appears twice by id, work_item_id, or matching Title + Client name.
 */
export function deduplicatePortfolioItems(items: PortfolioItem[]): PortfolioItem[] {
  const seenIds = new Set<string>();
  const seenWorkItemIds = new Set<string>();
  const seenKeys = new Set<string>();
  const cleanList: PortfolioItem[] = [];

  for (const item of items) {
    if (!item || !item.id) continue;
    if (seenIds.has(item.id)) continue;

    // Check work_item_id duplicate
    if (item.work_item_id) {
      if (seenWorkItemIds.has(item.work_item_id)) {
        continue;
      }
    }

    // Check normalized Title + Client duplicate
    const titleNorm = (item.title || "").trim().toLowerCase();
    const clientNorm = (item.client_name || "").trim().toLowerCase();
    const compositeKey = `${titleNorm}:::${clientNorm}`;

    if (titleNorm && seenKeys.has(compositeKey)) {
      continue;
    }

    seenIds.add(item.id);
    if (item.work_item_id) seenWorkItemIds.add(item.work_item_id);
    if (titleNorm) seenKeys.add(compositeKey);

    cleanList.push(item);
  }

  return cleanList;
}

const PORTFOLIO_CHANNEL_NAME = "crewvia_portfolio_sync_channel";
let portfolioBroadcastChannel: BroadcastChannel | null = null;

if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    portfolioBroadcastChannel = new BroadcastChannel(PORTFOLIO_CHANNEL_NAME);
  } catch (e) {
    portfolioBroadcastChannel = null;
  }
}

/**
 * Real-time Cross-Tab and Cross-Window Synchronization:
 * Notifies all active tabs whenever a portfolio presentation is added, edited, or deleted.
 */
export function notifyPortfolioTabsChanged(): void {
  if (typeof window === "undefined") return;
  try {
    // 1. BroadcastChannel for modern browsers (sub-millisecond instant notification)
    portfolioBroadcastChannel?.postMessage({
      type: "PORTFOLIO_SYNC",
      timestamp: Date.now(),
    });

    // 2. Storage event trigger via localStorage key update for other windows/tabs
    localStorage.setItem("crewvia_portfolio_last_updated", String(Date.now()));

    // 3. In-tab custom DOM event
    window.dispatchEvent(
      new CustomEvent("crewvia-portfolio-changed", { detail: { timestamp: Date.now() } })
    );
  } catch {}
}

/**
 * Subscribe to real-time portfolio changes across all browser tabs
 */
export function subscribeToPortfolioSync(onSync: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === "PORTFOLIO_SYNC") {
      onSync();
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === "crewvia_portfolio_last_updated" ||
      event.key?.startsWith("crewvia_portfolio_items")
    ) {
      onSync();
    }
  };

  const handleCustom = () => {
    onSync();
  };

  if (portfolioBroadcastChannel) {
    portfolioBroadcastChannel.addEventListener("message", handleBroadcast);
  }
  window.addEventListener("storage", handleStorage);
  window.addEventListener("crewvia-portfolio-changed", handleCustom);

  return () => {
    if (portfolioBroadcastChannel) {
      portfolioBroadcastChannel.removeEventListener("message", handleBroadcast);
    }
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("crewvia-portfolio-changed", handleCustom);
  };
}

/**
 * Sync manually added portfolio items to Supabase Public Storage (work_files/portfolio_registry.json)
 * Guarantees ONLY manually added items are synced so public users see exact manager items.
 * Includes a strict safety guard: NEVER overwrites with an empty array unless allowEmpty is explicitly true!
 */
export async function syncPortfolioToPublicCloud(
  items?: PortfolioItem[],
  allowEmpty: boolean = false
): Promise<boolean> {
  try {
    const listToSync = items !== undefined ? items : await loadPortfolioItemsFromStorage();

    // STRICT SAFETY GUARD: Prevent uninitialized components or initial empty render states from wiping cloud
    if ((!listToSync || listToSync.length === 0) && !allowEmpty) {
      console.warn("Safety notice: blocked unpermitted empty cloud registry overwrite");
      return false;
    }

    const validOnly = deduplicatePortfolioItems((listToSync || []).filter(isManuallyAddedItem));

    // Sanitize items so that huge data URLs don't bloat the registry JSON
    const sanitized = validOnly.map((item) => ({
      ...item,
      slides: (item.slides || []).map((s) => ({
        ...s,
        preview_url:
          s.preview_url?.startsWith("data:image/") && s.preview_url.length > 300000
            ? generateFallbackCover(s.title || item.title, item.category, item.client_name)
            : s.preview_url,
      })),
    }));

    const blob = new Blob([JSON.stringify(sanitized, null, 2)], {
      type: "application/json",
    });

    const { error } = await supabase.storage
      .from("work_files")
      .upload(REGISTRY_STORAGE_PATH, blob, {
        upsert: true,
        contentType: "application/json",
      });

    if (error) {
      console.warn("Notice: could not sync portfolio_registry to storage bucket:", error.message);
      return false;
    }

    notifyPortfolioTabsChanged();
    return true;
  } catch (e) {
    console.warn("syncPortfolioToPublicCloud encountered:", e);
    return false;
  }
}

/**
 * Fetch public portfolio registry JSON from public storage bucket
 * Guaranteed to work for unauthenticated visitors without logging in.
 * Pure read query: NEVER writes side-effects to storage to prevent resurrecting deleted items.
 */
export async function fetchPublicCloudRegistry(): Promise<PortfolioItem[]> {
  try {
    const publicUrl = `https://mawmjqeyjzktxbtsswgw.supabase.co/storage/v1/object/public/work_files/${REGISTRY_STORAGE_PATH}?v=${Date.now()}`;
    const res = await fetch(publicUrl, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.filter(isManuallyAddedItem);
      }
    }
  } catch (err) {
    // Non-blocking
  }
  return [];
}

/**
 * Fetch all published presentations for public showcase page
 * ONLY returns presentations that were manually created/published in Portfolio Manager!
 */
export async function fetchPublishedPortfolioItems(): Promise<PortfolioItem[]> {
  const deletedIds = getDeletedPortfolioIds();

  // 1. Try Supabase cloud table if exists and populated
  try {
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .select("*")
      .or("published.eq.true,published.is.null")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const formatted: PortfolioItem[] = data.map((item: any) => ({
        ...item,
        slides: Array.isArray(item.slides) ? item.slides : [],
        metrics: Array.isArray(item.metrics) ? item.metrics : [],
      }));
      const clean = formatted.filter((i) => isManuallyAddedItem(i) && !deletedIds.has(i.id));
      const deduplicated = deduplicatePortfolioItems(clean);
      for (const item of deduplicated) {
        savePortfolioItemToStorage(item).catch(() => {});
      }
      return deduplicated;
    }
  } catch (err) {
    // Non-blocking fallback
  }

  // 2. Try Public Cloud Storage Registry (accessible to ANY normal visitor across devices)
  const cloudRegistry = (await fetchPublicCloudRegistry()).filter(
    (i) => isManuallyAddedItem(i) && !deletedIds.has(i.id)
  );

  // 3. Load from local storage engine (for admin device immediate preview)
  const localItems = (await loadPortfolioItemsFromStorage()).filter(
    (i) => isManuallyAddedItem(i) && !deletedIds.has(i.id)
  );
  const publishedLocal = localItems.filter((item) => item.published !== false);

  // Merge items cleanly: Only items manually added/managed by the admin!
  const mergedMap = new Map<string, PortfolioItem>();

  // Layer 1: Cloud registry (items added in Portfolio Manager)
  for (const reg of cloudRegistry) {
    if (reg.published !== false && !deletedIds.has(reg.id)) {
      mergedMap.set(reg.id, reg);
      savePortfolioItemToStorage(reg).catch(() => {});
    }
  }

  // Layer 2: Local storage (immediate local additions/edits)
  for (const local of publishedLocal) {
    if (!deletedIds.has(local.id)) {
      mergedMap.set(local.id, local);
    }
  }

  const result = deduplicatePortfolioItems(Array.from(mergedMap.values()));
  result.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  return result;
}

/**
 * Fetch all presentations for Admin Management screen
 * ONLY returns presentations manually created/managed by admin!
 */
export async function fetchAllPortfolioItems(): Promise<PortfolioItem[]> {
  const deletedIds = getDeletedPortfolioIds();

  // 1. Try Supabase cloud table if exists
  try {
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const formatted: PortfolioItem[] = data.map((item: any) => ({
        ...item,
        slides: Array.isArray(item.slides) ? item.slides : [],
        metrics: Array.isArray(item.metrics) ? item.metrics : [],
      }));
      const clean = formatted.filter((i) => isManuallyAddedItem(i) && !deletedIds.has(i.id));
      const deduplicated = deduplicatePortfolioItems(clean);
      for (const item of deduplicated) {
        savePortfolioItemToStorage(item).catch(() => {});
      }
      return deduplicated;
    }
  } catch (err) {
    // Non-blocking fallback
  }

  // 2. Public Cloud Storage Registry
  const cloudRegistry = (await fetchPublicCloudRegistry()).filter(
    (i) => isManuallyAddedItem(i) && !deletedIds.has(i.id)
  );

  // 3. Local storage engine
  const localItems = (await loadPortfolioItemsFromStorage()).filter(
    (i) => isManuallyAddedItem(i) && !deletedIds.has(i.id)
  );

  const mergedMap = new Map<string, PortfolioItem>();
  for (const reg of cloudRegistry) {
    if (!deletedIds.has(reg.id)) {
      mergedMap.set(reg.id, reg);
      savePortfolioItemToStorage(reg).catch(() => {});
    }
  }
  for (const local of localItems) {
    if (!deletedIds.has(local.id)) {
      mergedMap.set(local.id, local);
    }
  }

  const result = deduplicatePortfolioItems(Array.from(mergedMap.values()));
  result.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  return result;
}

/**
 * Fetch single portfolio presentation by ID
 */
export async function fetchPortfolioItemById(id: string): Promise<PortfolioItem | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return {
        ...data,
        slides: Array.isArray(data.slides) ? data.slides : [],
        metrics: Array.isArray(data.metrics) ? data.metrics : [],
      };
    }
  } catch (err) {
    // Non-blocking fallback
  }

  const items = await fetchAllPortfolioItems();
  return items.find((item) => item.id === id) || null;
}

/**
 * Create a new presentation deck with guaranteed local persistence & Supabase cloud sync
 */
export async function createPortfolioItem(
  payload: Omit<PortfolioItem, "id" | "created_at" | "view_count">
): Promise<PortfolioItem> {
  const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `deck-${Date.now()}`;

  // Ensure cover_image_url is valid and not pointing to a raw .pdf URL
  let coverUrl = payload.cover_image_url?.trim() || "";
  if (!coverUrl || coverUrl.toLowerCase().endsWith(".pdf")) {
    if (
      payload.slides &&
      payload.slides.length > 0 &&
      payload.slides[0].preview_url &&
      !payload.slides[0].preview_url.toLowerCase().endsWith(".pdf")
    ) {
      coverUrl = payload.slides[0].preview_url;
    } else {
      coverUrl = generateFallbackCover(payload.title, payload.category, payload.client_name);
    }
  }

  const newItem: PortfolioItem = {
    ...payload,
    id: newId,
    cover_image_url: coverUrl,
    created_at: new Date().toISOString(),
    view_count: 0,
    slide_count: payload.slides?.length || 1,
  };

  // 1. Immediately persist to IndexedDB & in-memory cache
  await savePortfolioItemToStorage(newItem);

  // 2. Fetch both cloud registry and local items to ensure we NEVER overwrite previously saved decks from other tabs
  const cloudItems = await fetchPublicCloudRegistry();
  const localItems = await loadPortfolioItemsFromStorage();
  const combined = deduplicatePortfolioItems([...cloudItems, ...localItems, newItem]);

  // 3. Sync clean merged list to public cloud storage
  await syncPortfolioToPublicCloud(combined);

  // 4. Also attempt Supabase table insert
  try {
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .insert({
        id: newItem.id,
        title: newItem.title,
        client_name: newItem.client_name,
        category: newItem.category,
        tagline: newItem.tagline,
        description: newItem.description,
        cover_image_url: newItem.cover_image_url,
        slides: newItem.slides,
        pdf_url: newItem.pdf_url,
        metrics: newItem.metrics,
        slide_count: newItem.slide_count,
        featured: newItem.featured,
        published: newItem.published,
        display_order: newItem.display_order,
        work_item_id: newItem.work_item_id || null,
      })
      .select()
      .single();

    if (!error && data) {
      await savePortfolioItemToStorage(data);
      notifyPortfolioTabsChanged();
      return data;
    }
  } catch (err) {
    console.warn("Supabase create notice:", err);
  }

  notifyPortfolioTabsChanged();
  return newItem;
}

/**
 * Update an existing presentation deck
 */
export async function updatePortfolioItem(
  id: string,
  updates: Partial<PortfolioItem>
): Promise<PortfolioItem> {
  const cleanUpdates = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // 1. Update in local storage engine
  const existing = await fetchPortfolioItemById(id);
  const updatedItem: PortfolioItem = {
    ...(existing || ({} as any)),
    ...cleanUpdates,
    id,
  };

  await savePortfolioItemToStorage(updatedItem);

  // 2. Merge with cloud registry and sync
  const cloudItems = await fetchPublicCloudRegistry();
  const localItems = await loadPortfolioItemsFromStorage();
  const combined = deduplicatePortfolioItems(
    [...cloudItems, ...localItems].map((item) => (item.id === id ? updatedItem : item))
  );

  await syncPortfolioToPublicCloud(combined);

  // 3. Also attempt Supabase update
  try {
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .update(cleanUpdates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      await savePortfolioItemToStorage(data);
      notifyPortfolioTabsChanged();
      return data;
    }
  } catch (err) {
    console.warn("Supabase update notice:", err);
  }

  notifyPortfolioTabsChanged();
  return updatedItem;
}

/**
 * Delete a presentation deck permanently.
 * Synchronously marks tombstone, removes from local storage, awaits public cloud registry update,
 * and removes from Supabase table if present.
 */
export async function deletePortfolioItem(id: string): Promise<void> {
  // 1. Mark in tombstone and remove from local IndexedDB + localStorage + memory cache
  await deletePortfolioItemFromStorage(id);

  // 2. Load clean remaining items from local and cloud
  const localRemaining = await loadPortfolioItemsFromStorage();
  const cloudItems = (await fetchPublicCloudRegistry()).filter((i) => i.id !== id);
  const combinedRemaining = deduplicatePortfolioItems([...cloudItems, ...localRemaining]).filter(
    (i) => i.id !== id
  );

  // 3. AWAIT public cloud storage update so the deleted item is gone from cloud BEFORE returning
  await syncPortfolioToPublicCloud(combinedRemaining, combinedRemaining.length === 0);

  // 4. Also attempt Supabase delete if table exists
  try {
    await (supabase as any).from("portfolio_items").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase delete notice:", err);
  }

  notifyPortfolioTabsChanged();
}

/**
 * Toggle Published status
 */
export async function togglePortfolioPublish(id: string, published: boolean): Promise<void> {
  await updatePortfolioItem(id, { published });
}

/**
 * Toggle Featured status
 */
export async function togglePortfolioFeatured(id: string, featured: boolean): Promise<void> {
  await updatePortfolioItem(id, { featured });
}

/**
 * Increment view count
 */
export async function incrementPortfolioViews(id: string): Promise<number> {
  try {
    await (supabase as any).rpc("increment_portfolio_views", { p_id: id });
  } catch {
    // Non-blocking fallback
  }

  const existing = await fetchPortfolioItemById(id);
  const nextCount = (existing?.view_count || 0) + 1;
  if (existing) {
    const updated = {
      ...existing,
      view_count: nextCount,
    };
    await savePortfolioItemToStorage(updated);
    const all = await loadPortfolioItemsFromStorage();
    syncPortfolioToPublicCloud(all).catch(() => {});
    notifyPortfolioTabsChanged();
  }
  return nextCount;
}

const LIKED_DECKS_STORAGE_KEY = "crewvia_portfolio_liked_decks_v1";

/**
 * Get IDs of decks liked by this client
 */
export function getClientLikedDeckIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LIKED_DECKS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

/**
 * Save client's liked deck state locally
 */
export function saveClientLikedDeckId(id: string, liked: boolean): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const set = getClientLikedDeckIds();
    if (liked) {
      set.add(id);
    } else {
      set.delete(id);
    }
    localStorage.setItem(LIKED_DECKS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * Toggle or increment like count on a presentation deck
 */
export async function togglePortfolioLike(id: string, liked: boolean): Promise<number> {
  saveClientLikedDeckId(id, liked);
  const delta = liked ? 1 : -1;

  try {
    await (supabase as any).rpc("increment_portfolio_likes", {
      p_id: id,
      p_delta: delta,
    });
  } catch {
    // Non-blocking fallback
  }

  const existing = await fetchPortfolioItemById(id);
  const currentCount = Math.max(0, (existing?.like_count || 0) + delta);
  if (existing) {
    const updated = {
      ...existing,
      like_count: currentCount,
    };
    await savePortfolioItemToStorage(updated);
    const all = await loadPortfolioItemsFromStorage();
    syncPortfolioToPublicCloud(all).catch(() => {});
    notifyPortfolioTabsChanged();
  }
  return currentCount;
}

/**
 * Format numbers compactly (e.g. 128, 1.2k, 2.5m)
 */
export function formatCompactNumber(num: number = 0): string {
  if (!num || num < 0) return "0";
  if (num < 1000) return String(num);
  if (num < 1000000) {
    const k = (num / 1000).toFixed(1);
    return k.endsWith(".0") ? `${Math.round(num / 1000)}k` : `${k}k`;
  }
  const m = (num / 1000000).toFixed(1);
  return m.endsWith(".0") ? `${Math.round(num / 1000000)}m` : `${m}m`;
}


/**
 * Completely wipe ALL portfolio items across local storage, cloud storage registry,
 * and database tables. Leaves a clean 0-project state with zero dummy fallbacks.
 */
export async function clearAllPortfolioData(): Promise<void> {
  const items = await loadPortfolioItemsFromStorage();
  for (const item of items) {
    await deletePortfolioItemFromStorage(item.id);
  }
  await clearAllPortfolioStorage();
  await syncPortfolioToPublicCloud([], true); // Explicitly allow empty here

  try {
    for (const item of items) {
      await (supabase as any).from("portfolio_items").delete().eq("id", item.id);
    }
  } catch {}

  notifyPortfolioTabsChanged();
}

export const clearAllPortfolioItems = clearAllPortfolioData;
