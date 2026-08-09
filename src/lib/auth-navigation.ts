import { supabase } from "@/integrations/supabase/client";
import { homePathForRoles } from "@/lib/roles";

export async function resolveAuthenticatedHomePath(): Promise<"/admin" | "/dashboard" | "/verify-otp" | "/auth"> {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return "/auth";

  const { data: profile } = await supabase
    .from("profiles")
    .select("otp_verified")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!profile?.otp_verified) return "/verify-otp";

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  return homePathForRoles((roles ?? []).map((row) => row.role));
}
