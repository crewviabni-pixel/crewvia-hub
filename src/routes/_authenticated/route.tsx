import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchUserRole } from "@/lib/work-api";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    
    // Fetch role
    const roleData = await fetchUserRole(data.user.id);
    if (roleData?.is_suspended) {
      await supabase.auth.signOut();
      throw redirect({ to: "/" });
    }
    
    return { user: data.user, appRole: roleData?.role || 'designer' };
  },
  component: () => <Outlet />,
});
