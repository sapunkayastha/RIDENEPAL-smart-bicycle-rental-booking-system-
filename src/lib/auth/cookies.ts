// src/lib/auth/cookies.ts
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const COOKIE_NAME = "ridenepal_session";

export function getSessionCookie(): string | undefined {
  return getCookie(COOKIE_NAME);
}

export function setSessionCookie(token: string) {
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearSessionCookie() {
  deleteCookie(COOKIE_NAME);
}
