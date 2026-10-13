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
  userRole: "admin" | "designer" | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<"admin" | "designer" | null>(null);

  const refreshWorkspaces = async () => {
    setIsLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    let role: "admin" | "designer" = "designer";
    if (user) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role, is_suspended")
        .eq("user_id", user.id)
        .maybeSingle();
      if (roleRow?.role === "admin") role = "admin";
    }
    setUserRole(role);

    let accessibleWorkspaces: Workspace[] = [];

    if (role === "admin") {
      // Admin gets all workspaces
      const { data } = await supabase.from("workspaces").select("*").order("created_at");
      accessibleWorkspaces = data || [];
    } else if (user) {
      // Designer: query assigned workspaces from designer_workspaces
      const { data: assignments } = await (supabase as any)
        .from("designer_workspaces")
        .select("workspace_id")
        .eq("user_id", user.id);

      const assignedWsIds = (assignments || []).map((a: any) => a.workspace_id).filter(Boolean);

      if (assignedWsIds.length > 0) {
        const { data: wsData } = await supabase
          .from("workspaces")
          .select("*")
          .in("id", assignedWsIds)
          .order("created_at");
        accessibleWorkspaces = wsData || [];
      } else {
        // Fallback (RLS or default)
        const { data: rlsData } = await supabase.from("workspaces").select("*").order("created_at");
        accessibleWorkspaces = rlsData || [];
      }
    }

    setWorkspaces(accessibleWorkspaces);

    if (accessibleWorkspaces.length > 0) {
      const savedId = localStorage.getItem("crewvia_active_workspace");
      if (savedId && accessibleWorkspaces.some((w) => w.id === savedId)) {
        setActiveWorkspaceIdState(savedId);
      } else {
        const firstId = accessibleWorkspaces[0].id;
        setActiveWorkspaceIdState(firstId);
        localStorage.setItem("crewvia_active_workspace", firstId);
      }
    } else {
      setActiveWorkspaceIdState(null);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    refreshWorkspaces();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      refreshWorkspaces();
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem("crewvia_active_workspace", id);
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        activeWorkspace,
        setActiveWorkspaceId,
        isLoading,
        refreshWorkspaces,
        userRole,
      }}
    >
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
