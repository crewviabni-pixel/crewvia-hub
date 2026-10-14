import { supabase } from "@/integrations/supabase/client";
import { INITIAL_SAMPLE_DECKS, type PortfolioItem, type PortfolioSlide } from "./portfolio-sample-decks";

const LOCAL_STORAGE_KEY = "crewvia_portfolio_items_v2";

export type { PortfolioItem, PortfolioSlide };

// Load items stored locally (used for custom items or when Supabase table is syncing)
function getStoredLocalItems(): PortfolioItem[] {
  if (typeof window === "undefined") return INITIAL_SAMPLE_DECKS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_DECKS));
      return INITIAL_SAMPLE_DECKS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_SAMPLE_DECKS;
  } catch (e) {
    console.warn("Failed to load local portfolio items:", e);
    return INITIAL_SAMPLE_DECKS;
  }
}

function saveLocalItems(items: PortfolioItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Failed to save local portfolio items:", e);
  }
}

/**
 * Fetch all published presentations for public showcase page
 */
export async function fetchPublishedPortfolioItems(): Promise<PortfolioItem[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .select("*")
      .eq("published", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      // Sync local cache
      const formatted = data.map((item: any) => ({
        ...item,
        slides: Array.isArray(item.slides) ? item.slides : [],
        metrics: Array.isArray(item.metrics) ? item.metrics : [],
      }));
      return formatted;
    }
  } catch (err) {
    console.warn("Supabase query for portfolio_items failed, using fallback repository:", err);
  }

  // Graceful fallback to rich local items
  const local = getStoredLocalItems();
  return local.filter((item) => item.published);
}

/**
 * Fetch all presentations for Admin Management screen
 */
export async function fetchAllPortfolioItems(): Promise<PortfolioItem[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        ...item,
        slides: Array.isArray(item.slides) ? item.slides : [],
        metrics: Array.isArray(item.metrics) ? item.metrics : [],
      }));
    }
  } catch (err) {
    console.warn("Supabase query for portfolio_items failed, using local storage:", err);
  }

  return getStoredLocalItems();
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
    console.warn("Supabase single fetch failed, looking in local repository:", err);
  }

  const local = getStoredLocalItems();
  return local.find((item) => item.id === id) || null;
}

/**
 * Create a new presentation deck
 */
export async function createPortfolioItem(
  payload: Omit<PortfolioItem, "id" | "created_at" | "view_count">
): Promise<PortfolioItem> {
  const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `deck-${Date.now()}`;
  const newItem: PortfolioItem = {
    ...payload,
    id: newId,
    created_at: new Date().toISOString(),
    view_count: 0,
    slide_count: payload.slides?.length || 1,
  };

  // 1. Try Supabase
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
      const local = getStoredLocalItems();
      saveLocalItems([data, ...local]);
      return data;
    }
  } catch (err) {
    console.warn("Supabase create failed, persisting locally:", err);
  }

  // 2. Persist locally
  const local = getStoredLocalItems();
  const updated = [newItem, ...local];
  saveLocalItems(updated);
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

  // 1. Try Supabase
  try {
    const { data, error } = await (supabase as any)
      .from("portfolio_items")
      .update(cleanUpdates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) {
      const local = getStoredLocalItems();
      const next = local.map((item) => (item.id === id ? { ...item, ...data } : item));
      saveLocalItems(next);
      return data;
    }
  } catch (err) {
    console.warn("Supabase update failed, updating locally:", err);
  }

  // 2. Update locally
  const local = getStoredLocalItems();
  let updatedItem: PortfolioItem | null = null;
  const next = local.map((item) => {
    if (item.id === id) {
      updatedItem = { ...item, ...cleanUpdates };
      return updatedItem;
    }
    return item;
  });

  saveLocalItems(next);
  if (!updatedItem) throw new Error("Portfolio item not found");
  return updatedItem;
}

/**
 * Delete a presentation deck
 */
export async function deletePortfolioItem(id: string): Promise<void> {
  // 1. Try Supabase
  try {
    await (supabase as any).from("portfolio_items").delete().eq("id", id);
  } catch (err) {
    console.warn("Supabase delete failed, removing locally:", err);
  }

  // 2. Remove locally
  const local = getStoredLocalItems();
  const filtered = local.filter((item) => item.id !== id);
  saveLocalItems(filtered);
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
export async function incrementPortfolioViews(id: string): Promise<void> {
  try {
    await (supabase as any).rpc("increment_portfolio_views", { p_id: id });
  } catch {
    // Non-blocking fallback
  }

  const local = getStoredLocalItems();
  const next = local.map((item) => {
    if (item.id === id) {
      return { ...item, view_count: (item.view_count || 0) + 1 };
    }
    return item;
  });
  saveLocalItems(next);
}

/**
 * Reset local repository back to default sample presentations
 */
export function resetPortfolioToDefault(): PortfolioItem[] {
  saveLocalItems(INITIAL_SAMPLE_DECKS);
  return INITIAL_SAMPLE_DECKS;
}
