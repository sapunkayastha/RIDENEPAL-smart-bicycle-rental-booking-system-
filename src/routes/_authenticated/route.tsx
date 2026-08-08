import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("otp_verified")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile?.otp_verified) throw redirect({ to: "/verify-otp" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
