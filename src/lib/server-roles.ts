/**
 * Server-side role checks. "Staff" = admin OR super_admin (day-to-day
 * business operations). "Super admin only" = role/admin management and
 * system-level actions.
 *
 * The 'admin' role queries are wrapped defensively — if the 'admin' value
 * doesn't exist yet in this database's app_role enum, that query fails and
 * is treated as "not admin" rather than throwing, so super_admin-only
 * behavior keeps working even before that migration has been applied.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

async function hasRole(supabase: SupabaseClient, userId: string, role: string): Promise<boolean> {
  try {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function getMyRoleFlags(supabase: SupabaseClient, userId: string) {
  const [isSuperAdmin, isAdmin] = await Promise.all([
    hasRole(supabase, userId, "super_admin"),
    hasRole(supabase, userId, "admin"),
  ]);
  return { isSuperAdmin, isAdmin, isStaff: isSuperAdmin || isAdmin };
}

export async function assertStaff(supabase: SupabaseClient, userId: string) {
  const { isStaff } = await getMyRoleFlags(supabase, userId);
  if (!isStaff) throw new Error("Forbidden: staff only");
}

export async function assertSuperAdmin(supabase: SupabaseClient, userId: string) {
  const { isSuperAdmin } = await getMyRoleFlags(supabase, userId);
  if (!isSuperAdmin) throw new Error("Forbidden: super_admin only");
}
