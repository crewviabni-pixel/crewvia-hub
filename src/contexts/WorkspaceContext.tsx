import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Workspace } from "@/lib/crm";

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  isLoading: boolean;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshWorkspaces = async () => {
    const { data } = await supabase.from("workspaces").select("*").order("created_at");
    if (data) {
      setWorkspaces(data);
        if (data.length > 0 && data[0]) {
          const firstId = data[0].id;
          const savedId = localStorage.getItem("crewvia_active_workspace");
          if (savedId && data.some((w) => w.id === savedId)) {
            setActiveWorkspaceIdState(savedId);
          } else {
            setActiveWorkspaceIdState(firstId);
            localStorage.setItem("crewvia_active_workspace", firstId);
          }
      } else {
        setActiveWorkspaceIdState(null);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    refreshWorkspaces();
  }, []);

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem("crewvia_active_workspace", id);
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspaceId, activeWorkspace, setActiveWorkspaceId, isLoading, refreshWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
