// src/lib/auth.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { randomUUID, randomInt } from "node:crypto";
import { z } from "zod";
import pool from "@/lib/mysql/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSessionToken, verifySessionToken } from "@/lib/auth/session";
import { setSessionCookie, clearSessionCookie, getSessionCookie } from "@/lib/auth/cookies";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { assignRoleForEmail } from "@/lib/auth/roles";
import { getGoogleAuthUrl, getGoogleUserFromCode } from "@/lib/auth/google";

type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  full_name: string | null;
  otp_verified: number;
};

const SESSION_DAYS = 7;
const OTP_TTL_MINUTES = 10;

async function createSession(userId: string) {
  const sessionId = randomUUID();
  await pool.execute(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (:id, :userId, DATE_ADD(NOW(), INTERVAL :days DAY))",
    { id: sessionId, userId, days: SESSION_DAYS },
  );
  const token = signSessionToken(sessionId, userId);
  setSessionCookie(token);
}

async function assignRoleRow(userId: string, email: string) {
  const role = assignRoleForEmail(email);
  await pool.execute("INSERT IGNORE INTO user_roles (user_id, role) VALUES (:userId, :role)", {
    userId,
    role,
  });
}

export const signUpWithPassword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        fullName: z.string().max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const [existing] = await pool.query("SELECT id FROM users WHERE email = :email", { email });
    if ((existing as unknown[]).length > 0)
      throw new Error("An account with this email already exists");

    const userId = randomUUID();
    const passwordHash = await hashPassword(data.password);
    await pool.execute(
      `INSERT INTO users (id, email, password_hash, full_name, otp_verified, email_confirmed)
       VALUES (:id, :email, :passwordHash, :fullName, TRUE, TRUE)`,
      { id: userId, email, passwordHash, fullName: data.fullName ?? null },
    );
    await assignRoleRow(userId, email);
    await createSession(userId);
    return { ok: true };
  });

export const signInWithPassword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email(), password: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const [rows] = await pool.query("SELECT id, password_hash FROM users WHERE email = :email", {
      email,
    });
    const user = (rows as UserRow[])[0];
    if (!user || !user.password_hash) throw new Error("Invalid email or password");
    const valid = await verifyPassword(data.password, user.password_hash);
    if (!valid) throw new Error("Invalid email or password");

    await pool.execute("UPDATE users SET last_sign_in_at = NOW() WHERE id = :id", { id: user.id });
    await createSession(user.id);
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const token = getSessionCookie();
  if (token) {
    const decoded = verifySessionToken(token);
    if (decoded) {
      await pool.execute("DELETE FROM sessions WHERE id = :id", { id: decoded.sessionId });
    }
  }
  clearSessionCookie();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const [rows] = await pool.query(
      "SELECT id, email, full_name, otp_verified FROM users WHERE id = :id",
      { id: context.userId },
    );
    const user = (rows as UserRow[])[0];
    if (!user) throw new Error("User not found");
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      otpVerified: Boolean(user.otp_verified),
    };
  });

export const googleAuthUrl = createServerFn({ method: "GET" }).handler(async () => {
  return { url: getGoogleAuthUrl() };
});

export const completeGoogleSignIn = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ code: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const gUser = await getGoogleUserFromCode(data.code);
    const email = gUser.email.toLowerCase().trim();

    const [rows] = await pool.query(
      "SELECT id, google_id, otp_verified FROM users WHERE email = :email OR google_id = :googleId",
      { email, googleId: gUser.googleId },
    );
    let user = (rows as UserRow[])[0];

    if (!user) {
      const userId = randomUUID();
      await pool.execute(
        `INSERT INTO users (id, email, google_id, full_name, otp_verified, email_confirmed)
         VALUES (:id, :email, :googleId, :fullName, FALSE, TRUE)`,
        { id: userId, email, googleId: gUser.googleId, fullName: gUser.fullName },
      );
      await assignRoleRow(userId, email);
      user = { id: userId, otp_verified: 0 } as UserRow;
    } else if (!user.google_id) {
      await pool.execute("UPDATE users SET google_id = :googleId WHERE id = :id", {
        googleId: gUser.googleId,
        id: user.id,
      });
    }

    await pool.execute("UPDATE users SET last_sign_in_at = NOW() WHERE id = :id", { id: user.id });
    await createSession(user.id);

    if (!user.otp_verified) {
      const code = String(randomInt(100000, 999999));
      await pool.execute(
        "INSERT INTO otp_codes (user_id, code, expires_at) VALUES (:userId, :code, DATE_ADD(NOW(), INTERVAL :mins MINUTE))",
        { userId: user.id, code, mins: OTP_TTL_MINUTES },
      );
      console.log(`\n🔐 [DEV OTP] Code for ${email}: ${code}\n`);
    }

    return { ok: true, otpVerified: Boolean(user.otp_verified) };
  });

export const sendOtp = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const [rows] = await pool.query("SELECT email FROM users WHERE id = :id", {
      id: context.userId,
    });
    const user = (rows as UserRow[])[0];
    if (!user) throw new Error("User not found");

    const code = String(randomInt(100000, 999999));
    await pool.execute(
      "INSERT INTO otp_codes (user_id, code, expires_at) VALUES (:userId, :code, DATE_ADD(NOW(), INTERVAL :mins MINUTE))",
      { userId: context.userId, code, mins: OTP_TTL_MINUTES },
    );
    console.log(`\n🔐 [DEV OTP] Code for ${user.email}: ${code}\n`);
    return { ok: true };
  });

export const verifyOtpCode = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ code: z.string().length(6) }).parse(input))
  .handler(async ({ data, context }) => {
    const [rows] = await pool.query(
      `SELECT id FROM otp_codes
       WHERE user_id = :userId AND code = :code AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      { userId: context.userId, code: data.code },
    );
    if ((rows as unknown[]).length === 0) throw new Error("Invalid or expired code");

    await pool.execute("UPDATE users SET otp_verified = TRUE WHERE id = :id", {
      id: context.userId,
    });
    await pool.execute("DELETE FROM otp_codes WHERE user_id = :userId", { userId: context.userId });
    return { ok: true };
  });
