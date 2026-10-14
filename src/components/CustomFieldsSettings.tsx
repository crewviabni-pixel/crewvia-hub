import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { fetchCustomFields } from "@/lib/crm-api";
import { cn } from "@/lib/utils";

export function CustomFieldsSettings() {
  const { activeWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: fields, isLoading } = useQuery({
    queryKey: ["customFields", activeWorkspaceId],
    queryFn: () => fetchCustomFields(activeWorkspaceId as string),
    enabled: !!activeWorkspaceId,
  });

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"text" | "number" | "date" | "select">("text");
  const [newOptions, setNewOptions] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!activeWorkspaceId || !newName.trim()) return;
      const opts = newType === "select" ? newOptions.split(",").map(o => o.trim()).filter(Boolean) : [];
      
      const { error } = await supabase.from("custom_fields").insert({
        workspace_id: activeWorkspaceId,
        name: newName.trim(),
        field_type: newType,
        options: opts,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields", activeWorkspaceId] });
      setNewName("");
      setNewOptions("");
      toast.success("Custom field added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("custom_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields", activeWorkspaceId] });
      toast.success("Field deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectClass = "rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
  const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  if (!activeWorkspaceId) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-1">
        <div className="space-y-0.5">
          <label className="text-sm font-semibold">Custom Dynamic Fields</label>
          <p className="text-xs text-muted-foreground">
            Add custom lead properties (e.g., Property Type, Budget, Event Date) for this campaign.
          </p>
        </div>
        {fields && fields.length > 0 && (
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {fields.length} {fields.length === 1 ? "field" : "fields"}
          </span>
        )}
      </div>
      
      <div className="space-y-2">
        {isLoading && (
          <div className="flex items-center gap-2 py-4 justify-center text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading custom fields...</span>
          </div>
        )}
        
        {fields && fields.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {fields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between bg-muted/40 hover:bg-muted/70 rounded-xl border border-border/80 px-3 py-2 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-semibold text-foreground truncate">{field.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-1.5 py-0.2 bg-background border border-border/60 rounded text-muted-foreground">
                      {field.field_type}
                    </span>
                    {field.field_type === "select" && Array.isArray(field.options) && field.options.length > 0 && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        ({field.options.length} options)
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete custom field "${field.name}"?`)) deleteMutation.mutate(field.id);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  title={`Delete field "${field.name}"`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          !isLoading && (
            <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center">
              <p className="text-xs text-muted-foreground">No custom fields created for this campaign yet.</p>
              <p className="text-[11px] text-muted-foreground/75 mt-0.5">Use the form below to create one.</p>
            </div>
          )
        )}
      </div>

      <div className="pt-3 border-t border-border/80 space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Create New Field
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input 
            placeholder="Field Name (e.g. Budget, City)" 
            className={cn(inputClass, "sm:col-span-6")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            className={cn(selectClass, "sm:col-span-4")}
            value={newType}
            onChange={(e) => setNewType(e.target.value as any)}
          >
            <option value="text">Text Input</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Dropdown Menu</option>
          </select>
          <button
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !newName.trim()}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {addMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            <span>Add</span>
          </button>
        </div>
        {newType === "select" && (
          <input 
            placeholder="Dropdown options (comma separated, e.g. Villa, Apartment, Plot)" 
            className={inputClass}
            value={newOptions}
            onChange={(e) => setNewOptions(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
