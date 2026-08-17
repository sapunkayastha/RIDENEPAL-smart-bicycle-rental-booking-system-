// src/lib/auth/auth-middleware.ts
import { createMiddleware } from "@tanstack/react-start";
import pool from "@/lib/mysql/db";
import { verifySessionToken } from "@/lib/auth/session";
import { getSessionCookie } from "@/lib/auth/cookies";

export const requireMysqlAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getSessionCookie();
  if (!token) throw new Error("Unauthorized: No session");

  const decoded = verifySessionToken(token);
  if (!decoded) throw new Error("Unauthorized: Invalid session");

  // Confirm session still exists (not logged out / expired server-side)
  const [rows] = await pool.query(
    "SELECT id FROM sessions WHERE id = :id AND user_id = :userId AND expires_at > NOW()",
    { id: decoded.sessionId, userId: decoded.userId },
  );
  if ((rows as unknown[]).length === 0) {
    throw new Error("Unauthorized: Session expired");
  }

  return next({
    context: {
      db: pool,
      userId: decoded.userId,
    },
  });
});
