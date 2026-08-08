import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const markOtpVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: context.userId, otp_verified: true }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role);
    return {
      roles,
      isSuperAdmin: roles.includes("super_admin"),
      isCustomer: roles.includes("customer"),
    };
  });
