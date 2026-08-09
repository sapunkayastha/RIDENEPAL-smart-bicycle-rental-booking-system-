import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/roles";
import { homePathForRoles, primaryRole } from "@/lib/roles";

async function userHasRole(context: { supabase: any; userId: string }, role: AppRole) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: role,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  if (!(await userHasRole(context, "super_admin"))) {
    throw new Error("Forbidden: super_admin only");
  }
}

async function assertStaff(context: { supabase: any; userId: string }) {
  const [isSuperAdmin, isAdmin] = await Promise.all([
    userHasRole(context, "super_admin"),
    userHasRole(context, "admin"),
  ]);
  if (!isSuperAdmin && !isAdmin) throw new Error("Forbidden: staff only");
}

export const amISuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { isSuperAdmin: await userHasRole(context, "super_admin") };
  });

export const amIStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [isSuperAdmin, isAdmin] = await Promise.all([
      userHasRole(context, "super_admin"),
      userHasRole(context, "admin"),
    ]);
    return {
      isSuperAdmin,
      isAdmin,
      isStaff: isSuperAdmin || isAdmin,
    };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
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
      const userRoles = (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
      return {
        id: p.id,
        fullName: p.full_name,
        phone: p.phone,
        otpVerified: p.otp_verified,
        createdAt: p.created_at,
        email: au?.email ?? null,
        lastSignInAt: au?.last_sign_in_at ?? null,
        emailConfirmed: Boolean(au?.email_confirmed_at),
        roles: userRoles,
        primaryRole: primaryRole(userRoles),
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
    if (input.role !== "super_admin" && input.role !== "admin" && input.role !== "customer") {
      throw new Error("Invalid role");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot change your own role");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role);
    const primary = primaryRole(roles);
    return {
      roles,
      primaryRole: primary,
      isSuperAdmin: roles.includes("super_admin"),
      isAdmin: roles.includes("admin"),
      isStaff: roles.includes("super_admin") || roles.includes("admin"),
      isCustomer: roles.includes("customer"),
      homePath: homePathForRoles(roles),
    };
  });
