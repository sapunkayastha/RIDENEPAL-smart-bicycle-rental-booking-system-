import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super_admin only");
}

export const amISuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    return { isSuperAdmin: Boolean(data) };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, { data: bookings }, users] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone, otp_verified, created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("bookings").select("user_id, status, total_amount"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);

    const authUsers = users.data?.users ?? [];

    return (profiles ?? []).map((p) => {
      const au = authUsers.find((u) => u.id === p.id);
      const mine = (bookings ?? []).filter((b) => b.user_id === p.id);
      return {
        id: p.id,
        fullName: p.full_name,
        phone: p.phone,
        otpVerified: p.otp_verified,
        createdAt: p.created_at,
        email: au?.email ?? null,
        lastSignInAt: au?.last_sign_in_at ?? null,
        emailConfirmed: Boolean(au?.email_confirmed_at),
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
        bookingCount: mine.length,
        totalSpend: mine
          .filter((b) => b.status !== "pending" && b.status !== "cancelled")
          .reduce((s, b) => s + Number(b.total_amount), 0),
      };
    });
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "super_admin" | "customer" }) => {
    if (!input?.userId) throw new Error("userId is required");
    if (input.role !== "super_admin" && input.role !== "customer") throw new Error("Invalid role");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot change your own role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
