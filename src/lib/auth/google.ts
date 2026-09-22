// src/lib/auth/google.ts
import { OAuth2Client } from "google-auth-library";

function getRedirectUri(): string {
  const origin = (process.env.APP_ORIGIN || "http://localhost:8080").replace(/\/$/, "");
  return `${origin}/auth-callback`;
}

export function getGoogleClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(),
  );
}

export function getGoogleAuthUrl(): string {
  const client = getGoogleClient();
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
}

export async function getGoogleUserFromCode(code: string) {
  const client = getGoogleClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub)
    throw new Error("Google sign-in failed: missing profile data");

  return {
    googleId: payload.sub,
    email: payload.email,
    fullName: payload.name ?? null,
  };
}
