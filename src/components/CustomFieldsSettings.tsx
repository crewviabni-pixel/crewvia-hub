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
    <div className="rounded-lg border border-border p-4 shadow-sm space-y-4">
      <div className="space-y-0.5">
        <label className="text-sm font-medium">Custom Dynamic Fields</label>
        <p className="text-xs text-muted-foreground">Add custom data fields (e.g., Property Type, Budget) to your leads.</p>
      </div>
      
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {isLoading && <Loader2 className="size-4 animate-spin" />}
        {fields?.map(field => (
          <div key={field.id} className="flex items-center justify-between bg-secondary/30 rounded border p-2">
            <div>
              <p className="text-sm font-medium">{field.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{field.field_type}</p>
            </div>
            <button
              onClick={() => {
                if (confirm(`Delete field "${field.name}"?`)) deleteMutation.mutate(field.id);
              }}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {fields?.length === 0 && <p className="text-xs text-muted-foreground italic">No custom fields created yet.</p>}
      </div>

      <div className="pt-2 border-t flex flex-col gap-2">
        <input 
          placeholder="Field Name (e.g. Budget)" 
          className={inputClass}
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <div className="flex gap-2">
          <select className={cn(selectClass, "flex-1")} value={newType} onChange={e => setNewType(e.target.value as any)}>
            <option value="text">Text Input</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Dropdown</option>
          </select>
          <button
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !newName.trim()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="size-4" />
          </button>
        </div>
        {newType === "select" && (
          <input 
            placeholder="Options (comma separated)" 
            className={inputClass}
            value={newOptions}
            onChange={e => setNewOptions(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
