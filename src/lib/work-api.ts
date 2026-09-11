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
export async function fetchWorkItems(type: WorkType) {
  const { data, error } = await supabase
    .from("work_items")
    .select("*, designer_leads_view!inner(*), leads(name, phone)")
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map((row: any) => ({
    ...row,
    lead: {
      ...row.designer_leads_view,
      name: row.leads?.name,
      phone: row.leads?.phone
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

export async function fetchAllCompletedWorkItems() {
  const { data, error } = await supabase
    .from("work_items")
    .select("*, designer_leads_view!inner(*)")
    .eq("status", "completed");
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
