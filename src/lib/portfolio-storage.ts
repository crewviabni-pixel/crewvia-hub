import type { PortfolioItem } from "./portfolio-sample-decks";

const DB_NAME = "crewvia_portfolio_db";
const STORE_NAME = "portfolio_items";
const DB_VERSION = 3; // Incremented for clean migration
const LOCAL_STORAGE_KEY = "crewvia_portfolio_items_v5";
const DELETED_IDS_KEY = "crewvia_portfolio_deleted_ids_v5";
const WIPE_ONCE_KEY = "crewvia_portfolio_clean_slate_v5";

// Known old project IDs that must be wiped permanently
export const KNOWN_OLD_PROJECT_IDS = new Set([
  "c4811b8f-daf9-4c76-b627-1ebc83cffa7b",
  "fe6980db-054b-46ca-a473-995c1e2c446e",
  "970e434a-5e29-4b2f-9f4e-6cca0a5b7907",
]);

let dbInstance: IDBDatabase | null = null;
let memoryCache: PortfolioItem[] = [];
let isLoaded = false;

/**
 * Tombstone tracking: Record IDs of deleted presentations so they can NEVER be resurrected by old cloud files or stale caches
 */
export function getDeletedPortfolioIds(): Set<string> {
  if (typeof window === "undefined") return new Set(KNOWN_OLD_PROJECT_IDS);
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const set = new Set<string>([...KNOWN_OLD_PROJECT_IDS, ...(Array.isArray(parsed) ? parsed : [])]);
      return set;
    }
  } catch {}
  return new Set(KNOWN_OLD_PROJECT_IDS);
}

export function markPortfolioIdAsDeleted(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const set = getDeletedPortfolioIds();
    set.add(id);
    localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

/**
 * Filter out any dummy items, auto-generated fallbacks, or deleted IDs.
 * ZERO fallbacks or dummy projects allowed.
 */
export function isValidManualPortfolioItem(item: PortfolioItem): boolean {
  if (!item || !item.id) return false;
  if (KNOWN_OLD_PROJECT_IDS.has(item.id)) return false;

  const deleted = getDeletedPortfolioIds();
  if (deleted.has(item.id)) return false;

  // Reject any auto-generated fallback SVG covers or dummy templates
  if (
    item.cover_image_url?.startsWith("data:image/svg+xml") &&
    item.description?.includes("Full high-resolution review available in client lightroom")
  ) {
    return false;
  }

  const title = (item.title || "").toLowerCase();
  const client = (item.client_name || "").toLowerCase();
  if (title.includes("radha krishna") || client.includes("radha krishna")) {
    return false;
  }

  return true;
}

// Export alias for compatibility
export const isManuallyAddedItem = isValidManualPortfolioItem;

// Initialize or get IndexedDB database instance
function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      store.createIndex("display_order", "display_order", { unique: false });
      store.createIndex("created_at", "created_at", { unique: false });
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * One-time clean wipe on load to remove all old projects and ensure a completely clean slate
 */
function ensureCleanSlateOnce(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(WIPE_ONCE_KEY) !== "true") {
      // Clear old storage keys
      localStorage.removeItem("crewvia_portfolio_items_real_v3");
      localStorage.removeItem("crewvia_portfolio_items_v4");
      localStorage.removeItem("crewvia_portfolio_clean_slate_v4");
      localStorage.removeItem("crewvia_portfolio_deleted_ids_v4");
      localStorage.removeItem(LOCAL_STORAGE_KEY);

      // Seed tombstone with old project IDs
      const tombstones = new Set(KNOWN_OLD_PROJECT_IDS);
      localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(tombstones)));

      localStorage.setItem(WIPE_ONCE_KEY, "true");
      memoryCache = [];
      isLoaded = true;

      // Clear IndexedDB object store
      openDB().then((db) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          tx.objectStore(STORE_NAME).clear();
        } catch {}
      }).catch(() => {});
    }
  } catch {}
}

/**
 * Load all portfolio items from IndexedDB (with localStorage and memory fallback)
 * ZERO dummy fallbacks. Only returns real, non-deleted presentations.
 */
export async function loadPortfolioItemsFromStorage(): Promise<PortfolioItem[]> {
  ensureCleanSlateOnce();

  if (typeof window === "undefined") {
    return memoryCache.filter(isValidManualPortfolioItem);
  }

  const deletedIds = getDeletedPortfolioIds();

  // 1. Try reading from IndexedDB
  try {
    const db = await openDB();
    const items = await new Promise<PortfolioItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (items && items.length > 0) {
      const valid = items.filter((i) => isValidManualPortfolioItem(i) && !deletedIds.has(i.id));

      // Clean up deleted items from IndexedDB
      if (valid.length < items.length) {
        try {
          const writeTx = db.transaction(STORE_NAME, "readwrite");
          const store = writeTx.objectStore(STORE_NAME);
          for (const item of items) {
            if (!isValidManualPortfolioItem(item) || deletedIds.has(item.id)) {
              store.delete(item.id);
            }
          }
        } catch {}
      }

      valid.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      memoryCache = valid;
      isLoaded = true;

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(valid));
      } catch {}

      return valid;
    }
  } catch (err) {
    console.warn("IndexedDB read encountered error, attempting localStorage fallback:", err);
  }

  // 2. Fallback to localStorage if IndexedDB had no records yet
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter((i) => isValidManualPortfolioItem(i) && !deletedIds.has(i.id));
        memoryCache = valid;
        isLoaded = true;

        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(valid));
        } catch {}

        return valid;
      }
    }
  } catch (e) {
    console.warn("localStorage fallback parse error:", e);
  }

  isLoaded = true;
  return memoryCache.filter((i) => isValidManualPortfolioItem(i) && !deletedIds.has(i.id));
}

/**
 * Persist a single portfolio item to IndexedDB, memory cache, and localStorage
 */
export async function savePortfolioItemToStorage(item: PortfolioItem): Promise<PortfolioItem> {
  if (!isValidManualPortfolioItem(item)) {
    return item;
  }

  // 1. Update in-memory cache synchronously (0ms UI latency)
  const existingIdx = memoryCache.findIndex((i) => i.id === item.id);
  if (existingIdx >= 0) {
    memoryCache[existingIdx] = item;
  } else {
    memoryCache = [item, ...memoryCache];
  }

  // 2. Persist to IndexedDB
  if (typeof window !== "undefined") {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (dbErr) {
      console.warn("Could not save to IndexedDB:", dbErr);
    }

    // 3. Backup to localStorage
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(memoryCache.filter(isValidManualPortfolioItem))
      );
    } catch {
      try {
        const lightweight = memoryCache.filter(isValidManualPortfolioItem).map((i) => ({
          ...i,
          slides: (i.slides || []).map((s) => ({
            ...s,
            preview_url:
              s.preview_url?.startsWith("data:image/") && s.preview_url.length > 50000
                ? ""
                : s.preview_url,
          })),
        }));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightweight));
      } catch {}
    }
  }

  return item;
}

/**
 * Permanently remove an item from IndexedDB, memory cache, and localStorage
 * Marks the ID in tombstone so it can never be revived.
 */
export async function deletePortfolioItemFromStorage(id: string): Promise<void> {
  markPortfolioIdAsDeleted(id);
  memoryCache = memoryCache.filter((i) => i.id !== id);

  if (typeof window !== "undefined") {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (dbErr) {
      console.warn("Could not delete from IndexedDB:", dbErr);
    }

    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(memoryCache.filter(isValidManualPortfolioItem))
      );
    } catch {}
  }
}

/**
 * Completely wipe all portfolio items from IndexedDB, localStorage, and memory cache
 */
export async function clearAllPortfolioStorage(): Promise<void> {
  memoryCache = [];
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem("crewvia_portfolio_items_v4");
      localStorage.removeItem("crewvia_portfolio_items_real_v3");
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
    } catch (err) {
      console.warn("clearAllPortfolioStorage error:", err);
    }
  }
}

/**
 * Synchronous access to current in-memory items
 */
export function getMemoryPortfolioItems(): PortfolioItem[] {
  const deleted = getDeletedPortfolioIds();
  return memoryCache.filter((i) => isValidManualPortfolioItem(i) && !deleted.has(i.id));
}
