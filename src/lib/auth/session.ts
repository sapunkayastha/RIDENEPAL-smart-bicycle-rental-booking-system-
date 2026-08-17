// src/lib/auth/session.ts
//
// Signed session tokens (replaces Supabase's JWT session handling).
// The token itself just carries { userId }, and is verified against
// a matching row in the `sessions` table (so we can revoke on logout).

import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me";
const TOKEN_TTL = "7d";

export function signSessionToken(sessionId: string, userId: string): string {
  return jwt.sign({ sessionId, userId }, SECRET, { expiresIn: TOKEN_TTL });
}

export function verifySessionToken(token: string): { sessionId: string; userId: string } | null {
  try {
    const decoded = jwt.verify(token, SECRET) as { sessionId: string; userId: string };
    return decoded;
  } catch {
    return null;
  }
}
