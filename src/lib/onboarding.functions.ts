import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { homePathForRoles } from "@/lib/roles";

export const completeCustomerOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName?: string; phone?: string }) => ({
    fullName: input?.fullName?.trim().slice(0, 100) || null,
    phone: input?.phone?.trim().slice(0, 30) || null,
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: context.userId,
          ...(data.fullName ? { full_name: data.fullName } : {}),
          ...(data.phone ? { phone: data.phone } : {}),
        },
        { onConflict: "id" },
      );
    if (profileError) throw new Error(profileError.message);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw new Error(rolesError.message);

    const existing = (roles ?? []).map((r) => r.role);
    if (existing.length === 0) {
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: context.userId, role: "customer" });
      if (insertError) throw new Error(insertError.message);
      existing.push("customer");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("otp_verified")
      .eq("id", context.userId)
      .maybeSingle();

    const otpVerified = Boolean(profile?.otp_verified);

    return {
      roles: existing,
      otpVerified,
      next: otpVerified ? homePathForRoles(existing) : "/verify-otp",
    };
  });
