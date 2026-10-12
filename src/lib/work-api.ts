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

export async function createDesigner(username: string, password: string, name?: string) {
  const { data, error } = await (supabase as any).rpc("admin_create_designer", {
    p_username: username.trim(),
    p_password: password,
    p_name: name?.trim() || "",
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

  return data;
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
