// src/lib/auth/role-check.ts
async function hasRole(userId: string, role: string): Promise<boolean> {
  const pool = (await import("@/lib/mysql/db.server")).default;
  const [rows] = await pool.query(
    "SELECT 1 FROM user_roles WHERE user_id = :userId AND role = :role LIMIT 1",
    { userId, role },
  );
  return (rows as unknown[]).length > 0;
}

export async function getMyRoleFlags(userId: string) {
  const [isSuperAdmin, isAdmin, isVendor] = await Promise.all([
    hasRole(userId, "super_admin"),
    hasRole(userId, "admin"),
    hasRole(userId, "vendor"),
  ]);
  return { isSuperAdmin, isAdmin, isVendor, isStaff: isSuperAdmin || isAdmin };
}

export async function assertStaff(userId: string) {
  const { isStaff } = await getMyRoleFlags(userId);
  if (!isStaff) throw new Error("Forbidden: staff only");
}

export async function assertSuperAdmin(userId: string) {
  const { isSuperAdmin } = await getMyRoleFlags(userId);
  if (!isSuperAdmin) throw new Error("Forbidden: super_admin only");
}

export async function assertApprovedVendor(userId: string) {
  const { isVendor } = await getMyRoleFlags(userId);
  if (!isVendor) throw new Error("Forbidden: vendor only");
  const pool = (await import("@/lib/mysql/db.server")).default;
  const [rows] = await pool.query("SELECT status FROM vendor_profiles WHERE user_id = :userId", {
    userId,
  });
  const profile = (rows as { status: string }[])[0];
  if (!profile || profile.status !== "approved") {
    throw new Error("Your vendor account is not yet approved");
  }
}
