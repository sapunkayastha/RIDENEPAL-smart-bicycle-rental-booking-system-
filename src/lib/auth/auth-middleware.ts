import { createMiddleware } from "@tanstack/react-start";
import { verifySessionToken } from "@/lib/auth/session";
import { getSessionCookie } from "@/lib/auth/cookies";

export const requireMysqlAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getSessionCookie();
  if (!token) throw new Error("Unauthorized: No session");

  const decoded = verifySessionToken(token);
  if (!decoded) throw new Error("Unauthorized: Invalid session");

  const pool = (await import("@/lib/mysql/db.server")).default;

  const [rows] = await pool.query(
    "SELECT id FROM sessions WHERE id = :id AND user_id = :userId AND expires_at > NOW()",
    { id: decoded.sessionId, userId: decoded.userId },
  );
  if ((rows as unknown[]).length === 0) {
    throw new Error("Unauthorized: Session expired");
  }

  return next({
    context: {
      userId: decoded.userId,
    },
  });
});
