import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, phone, otp_verified, created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);

    const { data: bookings } = await context.supabase
      .from("bookings")
      .select("status, total_amount")
      .eq("user_id", context.userId);

    const spend = (bookings ?? [])
      .filter((b) => b.status !== "pending" && b.status !== "cancelled")
      .reduce((s, b) => s + Number(b.total_amount), 0);

    return {
      id: context.userId,
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      otp_verified: profile?.otp_verified ?? false,
      created_at: profile?.created_at ?? null,
      email: authUser?.user?.email ?? null,
      avatar_url:
        (authUser?.user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ?? null,
      roles: (roles ?? []).map((r) => r.role),
      booking_count: (bookings ?? []).length,
      total_spend: spend,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(1, "Name is required").max(120),
        phone: z.string().trim().max(30).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: context.userId, full_name: data.full_name, phone: data.phone || null },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
