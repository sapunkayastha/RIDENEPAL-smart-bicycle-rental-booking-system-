import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getMyRoleFlags, assertStaff, assertSuperAdmin } from "@/lib/server-roles";
import { APP_ROLES, type AppRole } from "@/lib/roles";

export const amISuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isSuperAdmin } = await getMyRoleFlags(context.supabase, context.userId);
    return { isSuperAdmin };
  });

export const amIStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getMyRoleFlags(context.supabase, context.userId);
  });

export const myRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const flags = await getMyRoleFlags(context.supabase, context.userId);
    return { ...flags, userId: context.userId };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Any staff member (admin or super_admin) can view the customer/staff
    // list — only changing roles is restricted further, in setUserRole.
    await assertStaff(context.supabase, context.userId);
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
  .inputValidator((input: { userId: string; role: AppRole }) => {
    if (!input?.userId) throw new Error("userId is required");
    if (!APP_ROLES.includes(input.role)) throw new Error("Invalid role");
    return input;
  })
  .handler(async ({ data, context }) => {
    // Role management is super_admin only — an admin can never grant
    // themselves or anyone else admin or super_admin privileges.
    await assertSuperAdmin(context.supabase, context.userId);
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
