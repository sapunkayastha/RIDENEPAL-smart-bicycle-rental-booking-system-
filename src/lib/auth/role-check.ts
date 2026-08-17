// src/lib/auth/roles-check.ts
import pool from "@/lib/mysql/db";

async function hasRole(userId: string, role: string): Promise<boolean> {
  const [rows] = await pool.query(
    "SELECT 1 FROM user_roles WHERE user_id = :userId AND role = :role LIMIT 1",
    { userId, role },
  );
  return (rows as unknown[]).length > 0;
}

export async function getMyRoleFlags(userId: string) {
  const [isSuperAdmin, isAdmin] = await Promise.all([
    hasRole(userId, "super_admin"),
    hasRole(userId, "admin"),
  ]);
  return { isSuperAdmin, isAdmin, isStaff: isSuperAdmin || isAdmin };
}

export async function assertStaff(userId: string) {
  const { isStaff } = await getMyRoleFlags(userId);
  if (!isStaff) throw new Error("Forbidden: staff only");
}

export async function assertSuperAdmin(userId: string) {
  const { isSuperAdmin } = await getMyRoleFlags(userId);
  if (!isSuperAdmin) throw new Error("Forbidden: super_admin only");
}
