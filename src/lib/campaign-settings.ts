import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SYSTEM_PRICE_FIELD_NAME = "__campaign_default_price";
export const DEFAULT_FALLBACK_PRICE = 10000;

/**
 * Retrieves the default product deal value for a campaign from the database.
 * 1. Checks workspaces.default_price (if table column exists).
 * 2. Checks custom_fields for system default price record (guaranteed in DB).
 * 3. Falls back to localStorage or 10000.
 */
export async function getCampaignDefaultPrice(workspaceId: string | null | undefined): Promise<number> {
  if (!workspaceId) {
    const local = typeof window !== "undefined" ? localStorage.getItem("crewvia_default_price") : null;
    return local ? Number(local) || DEFAULT_FALLBACK_PRICE : DEFAULT_FALLBACK_PRICE;
  }

  // 1. Try querying workspaces.default_price
  try {
    const { data: wsData, error: wsErr } = await (supabase as any)
      .from("workspaces")
      .select("default_price")
      .eq("id", workspaceId)
      .maybeSingle();

    if (!wsErr && wsData && wsData.default_price != null) {
      const price = Number(wsData.default_price);
      if (!isNaN(price) && price > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`crewvia_default_price_${workspaceId}`, String(price));
          localStorage.setItem("crewvia_default_price", String(price));
        }
        return price;
      }
    }
  } catch {
    // Column might not exist yet, fallback seamlessly
  }

  // 2. Try querying custom_fields for system record
  try {
    const { data: cfData, error: cfErr } = await supabase
      .from("custom_fields")
      .select("options")
      .eq("workspace_id", workspaceId)
      .eq("name", SYSTEM_PRICE_FIELD_NAME)
      .maybeSingle();

    if (!cfErr && cfData && cfData.options) {
      const opts = cfData.options as any;
      const price = Number(opts?.default_price ?? opts?.price);
      if (!isNaN(price) && price > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`crewvia_default_price_${workspaceId}`, String(price));
          localStorage.setItem("crewvia_default_price", String(price));
        }
        return price;
      }
    }
  } catch {
    // Table or network issue
  }

  // 3. Fallback to localStorage
  if (typeof window !== "undefined") {
    const wsLocal = localStorage.getItem(`crewvia_default_price_${workspaceId}`);
    if (wsLocal) return Number(wsLocal) || DEFAULT_FALLBACK_PRICE;
    const globalLocal = localStorage.getItem("crewvia_default_price");
    if (globalLocal) return Number(globalLocal) || DEFAULT_FALLBACK_PRICE;
  }

  return DEFAULT_FALLBACK_PRICE;
}

/**
 * Saves the default product deal value for a campaign to the database.
 * Updates workspaces table and maintains custom_fields record for guaranteed persistence.
 */
export async function saveCampaignDefaultPrice(
  workspaceId: string,
  price: number
): Promise<{ success: boolean; price: number; savedIn: "workspaces" | "custom_fields" }> {
  if (!workspaceId) throw new Error("No campaign selected.");
  if (isNaN(price) || price < 0) throw new Error("Price must be a valid positive number.");

  let savedIn: "workspaces" | "custom_fields" = "custom_fields";
  let wsUpdated = false;

  // 1. Try updating workspaces.default_price
  try {
    const { error: wsErr } = await (supabase as any)
      .from("workspaces")
      .update({ default_price: price })
      .eq("id", workspaceId);

    if (!wsErr) {
      wsUpdated = true;
      savedIn = "workspaces";
    }
  } catch {
    wsUpdated = false;
  }

  // 2. Persist in custom_fields table (guaranteed database persistence)
  try {
    const { data: existing } = await supabase
      .from("custom_fields")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", SYSTEM_PRICE_FIELD_NAME)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("custom_fields")
        .update({
          options: { default_price: price },
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("custom_fields")
        .insert({
          workspace_id: workspaceId,
          name: SYSTEM_PRICE_FIELD_NAME,
          field_type: "number",
          options: { default_price: price },
        });
    }
  } catch (err: any) {
    if (!wsUpdated) {
      throw new Error(err.message || "Failed to save pricing configuration in database.");
    }
  }

  // 3. Keep localStorage synced
  if (typeof window !== "undefined") {
    localStorage.setItem(`crewvia_default_price_${workspaceId}`, String(price));
    localStorage.setItem("crewvia_default_price", String(price));
  }

  return { success: true, price, savedIn };
}

/**
 * React Query hook providing the reactive campaign default price and save mutation.
 */
export function useCampaignPrice(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["campaignPrice", workspaceId],
    queryFn: () => getCampaignDefaultPrice(workspaceId),
    enabled: typeof window !== "undefined",
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const mutation = useMutation({
    mutationFn: async (price: number) => {
      if (!workspaceId) throw new Error("Please select a campaign first.");
      return saveCampaignDefaultPrice(workspaceId, price);
    },
    onSuccess: (res) => {
      queryClient.setQueryData(["campaignPrice", workspaceId], res.price);
      queryClient.invalidateQueries({ queryKey: ["campaignPrice", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  return {
    price: query.data ?? DEFAULT_FALLBACK_PRICE,
    isLoading: query.isLoading,
    savePrice: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
