import { supabase } from "@/integrations/supabase/client";
import type { UserRole, LeadInformation, LeadInformationImage, WorkItem, DesignerLead, AppRole, WorkStatus, WorkType } from "./crm";

// RBAC
export async function fetchUserRole(userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (error) throw error;
  // If not found, they might be the default admin logging in for the first time
  if (!data) {
    // Attempt to upsert admin
    const { data: newData, error: insertError } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: 'admin', username: 'admin' })
      .select()
      .single();
    if (insertError) throw insertError;
    return newData;
  }
  return data;
}

export async function fetchDesigners() {
  const { data, error } = await supabase
    .from("user_roles")
    .select("*")
    .eq("role", "designer")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createDesigner(
  username: string, 
  password: string, 
  name?: string,
  workspaceIds: string[] = []
) {
  const { data, error } = await (supabase as any).rpc("admin_create_designer", {
    p_username: username.trim(),
    p_password: password,
    p_name: name?.trim() || "",
    p_workspace_ids: workspaceIds,
  });

  if (error) {
    if (
      error.code === "PGRST202" ||
      error.message?.includes("schema cache") ||
      error.message?.includes("admin_create_designer")
    ) {
      const customErr = new Error("SQL_SETUP_REQUIRED");
      (customErr as any).code = "SQL_SETUP_REQUIRED";
      throw customErr;
    }
    throw new Error(error.message || "Failed to create designer");
  }

  // Fallback: If RPC ran without workspace parameter or designer_workspaces table exists
  if (workspaceIds.length > 0 && data?.user_id) {
    try {
      await assignDesignerWorkspaces(data.user_id, workspaceIds);
    } catch (e) {
      console.warn("Direct assignment fallback notice:", e);
    }
  }

  return data;
}

export async function fetchDesignerWorkspaces(userId: string): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from("designer_workspaces")
    .select("workspace_id")
    .eq("user_id", userId);
  
  if (error) {
    console.warn("fetchDesignerWorkspaces error:", error.message);
    return [];
  }
  return (data || []).map((r: any) => r.workspace_id);
}

export async function fetchAllDesignerWorkspacesMapping(): Promise<Record<string, string[]>> {
  const { data, error } = await (supabase as any)
    .from("designer_workspaces")
    .select("user_id, workspace_id");
  
  if (error) {
    console.warn("fetchAllDesignerWorkspacesMapping error:", error.message);
    return {};
  }
  const mapping: Record<string, string[]> = {};
  (data || []).forEach((row: any) => {
    if (!mapping[row.user_id]) mapping[row.user_id] = [];
    mapping[row.user_id].push(row.workspace_id);
  });
  return mapping;
}

export async function assignDesignerWorkspaces(userId: string, workspaceIds: string[]): Promise<void> {
  // Try RPC first
  const { error: rpcErr } = await (supabase as any).rpc("admin_assign_designer_workspaces", {
    p_user_id: userId,
    p_workspace_ids: workspaceIds,
  });

  if (!rpcErr) return;

  // If RPC is missing or schema cache error, try direct table operation as fallback
  const { error: deleteErr } = await (supabase as any).from("designer_workspaces").delete().eq("user_id", userId);
  if (deleteErr) {
    if (
      deleteErr.code === "PGRST205" ||
      deleteErr.message?.includes("schema cache") ||
      deleteErr.message?.includes("designer_workspaces") ||
      rpcErr.code === "PGRST202" ||
      rpcErr.message?.includes("schema cache")
    ) {
      const customErr = new Error("SQL_SETUP_REQUIRED");
      (customErr as any).code = "SQL_SETUP_REQUIRED";
      throw customErr;
    }
    throw new Error(deleteErr.message || "Failed to assign campaigns");
  }

  if (workspaceIds.length > 0) {
    const rows = workspaceIds.map((wsId) => ({ user_id: userId, workspace_id: wsId }));
    const { error: insertErr } = await (supabase as any).from("designer_workspaces").insert(rows);
    if (insertErr) {
      if (
        insertErr.code === "PGRST205" ||
        insertErr.message?.includes("schema cache") ||
        insertErr.message?.includes("designer_workspaces")
      ) {
        const customErr = new Error("SQL_SETUP_REQUIRED");
        (customErr as any).code = "SQL_SETUP_REQUIRED";
        throw customErr;
      }
      throw new Error(insertErr.message || "Failed to assign campaigns");
    }
  }
}

export async function resetDesignerPassword(userId: string, newPassword: string) {
  const { data, error } = await (supabase as any).rpc("admin_reset_designer_password", {
    p_user_id: userId,
    p_new_password: newPassword,
  });

  if (error) {
    throw new Error(error.message || "Failed to reset designer password");
  }

  return data;
}

export async function deleteDesigner(userId: string) {
  const { data, error } = await (supabase as any).rpc("admin_delete_designer", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message || "Failed to delete designer");
  }

  return data;
}

export async function toggleDesignerSuspension(userId: string, isSuspended: boolean) {
  const { data, error } = await supabase
    .from("user_roles")
    .update({ is_suspended: isSuspended })
    .eq("user_id", userId);

  if (error) throw error;
  return data;
}


// Work Information
export async function saveInformation(
  leadId: string, 
  leadName: string,
  infoText: string, 
  images: { title: string, file_url: string }[],
  leadStatus: string,
  editOnly: boolean = false
) {
  // 1. Update Lead Name
  if (leadName.trim()) {
    const { error: leadErr } = await supabase
      .from("leads")
      .update({ name: leadName.trim() })
      .eq("id", leadId);
    if (leadErr) throw leadErr;
  }

  // 2. Save Information
  const { error: infoErr } = await supabase
    .from("lead_information")
    .upsert({ lead_id: leadId, info_text: infoText });
  if (infoErr) throw infoErr;

  // 3. Insert new images
  if (images.length > 0) {
    const { error: imgErr } = await supabase
      .from("lead_information_images")
      .insert(images.map(img => ({ lead_id: leadId, ...img })));
    if (imgErr) throw imgErr;
  }

  // 4. Create Work Item based on status
  if (editOnly) return;
  const workType = leadStatus === "info_taken" ? "draft" : "presentation";
  
  // Check if work item already exists
  const { data: existingWork } = await supabase
    .from("work_items")
    .select("id")
    .eq("lead_id", leadId)
    .eq("type", workType)
    .maybeSingle();

  if (!existingWork) {
    const { error: workErr } = await supabase
      .from("work_items")
      .insert({ lead_id: leadId, type: workType as any, status: "pending" });
    if (workErr) throw workErr;
  }
}

export async function fetchLeadInformation(leadId: string) {
  const { data: info, error: infoErr } = await supabase
    .from("lead_information")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (infoErr) throw infoErr;

  const { data: images, error: imgErr } = await supabase
    .from("lead_information_images")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (imgErr) throw imgErr;

  return { info, images };
}

export async function deleteInformationImage(id: string) {
  const { error } = await supabase
    .from("lead_information_images")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Work Items
export async function fetchWorkItems(type: WorkType, workspaceId?: string) {
  let q = supabase
    .from("work_items")
    .select("*, designer_leads_view!inner(*), leads!inner(name, phone, workspace_id)")
    .eq("type", type)
    .order("created_at", { ascending: false });
  if (workspaceId) q = q.eq("leads.workspace_id", workspaceId);
  const { data, error } = await q;

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Batch fetch lead_information so card previews have actual info_text
  const leadIds = Array.from(new Set(data.map((r: any) => r.lead_id).filter(Boolean)));
  let infoMap: Record<string, string> = {};
  if (leadIds.length > 0) {
    const { data: infos } = await supabase
      .from("lead_information")
      .select("lead_id, info_text")
      .in("lead_id", leadIds);
    if (infos) {
      infos.forEach((inf: any) => {
        if (inf.lead_id && inf.info_text) {
          infoMap[inf.lead_id] = inf.info_text;
        }
      });
    }
  }

  return data.map((row: any) => ({
    ...row,
    lead: {
      ...row.designer_leads_view,
      id: row.lead_id || row.designer_leads_view?.id,
      name: row.leads?.name,
      phone: row.leads?.phone,
      info_text: infoMap[row.lead_id] || row.designer_leads_view?.notes || ""
    }
  }));
}

export async function fetchCompletedWorkItemsForLead(leadId: string) {
  const { data, error } = await supabase
    .from("work_items")
    .select("*")
    .eq("lead_id", leadId)
    .eq("status", "completed");
  if (error) throw error;
  return data;
}

export async function updateWorkStatus(id: string, status: WorkStatus, fileUrl?: string) {
  const update: any = { status, updated_at: new Date().toISOString() };
  if (fileUrl !== undefined) update.file_url = fileUrl;

  const { data, error } = await supabase
    .from("work_items")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAllCompletedWorkItems(workspaceId?: string) {
  let q = supabase
    .from("work_items")
    .select("*, designer_leads_view!inner(*), leads!inner(workspace_id)")
    .eq("status", "completed");
  if (workspaceId) q = q.eq("leads.workspace_id", workspaceId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((row: any) => ({
    ...row,
    lead: row.designer_leads_view
  }));
}

export async function fetchAllWorkItemsForLead(leadId: string) {
  const { data, error } = await supabase
    .from("work_items")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Expire an active client preview link immediately so clients can no longer view it.
 */
export async function expireWorkPreview(id: string) {
  const { data, error } = await (supabase as any)
    .from("work_items")
    .update({
      preview_enabled: false,
      preview_revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Regenerate a client preview link with a new unique token, invalidating any previous link.
 */
export async function regenerateWorkPreview(id: string) {
  const newToken = crypto.randomUUID();
  const { data, error } = await (supabase as any)
    .from("work_items")
    .update({
      preview_token: newToken,
      preview_enabled: true,
      preview_revoked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
