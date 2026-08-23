import { homePathForRoles } from "@/lib/roles";

export async function resolveAuthenticatedHomePath(): Promise<
  "/admin" | "/dashboard" | "/verify-otp" | "/auth"
> {
  const pool = (await import("@/lib/mysql/db.server")).default;
  const { getSessionCookie } = await import("@/lib/auth/cookies");
  const { verifySessionToken } = await import("@/lib/auth/session");

  const token = getSessionCookie();
  if (!token) return "/auth";
  const decoded = verifySessionToken(token);
  if (!decoded) return "/auth";

  const [userRows] = await pool.query("SELECT otp_verified FROM users WHERE id = :id", {
    id: decoded.userId,
  });
  const user = (userRows as { otp_verified: number }[])[0];
  if (!user) return "/auth";
  if (!user.otp_verified) return "/verify-otp";

  const [roleRows] = await pool.query("SELECT role FROM user_roles WHERE user_id = :id", {
    id: decoded.userId,
  });
  return homePathForRoles((roleRows as { role: string }[]).map((r) => r.role));
}
