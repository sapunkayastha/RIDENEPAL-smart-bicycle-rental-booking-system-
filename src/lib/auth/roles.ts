// src/lib/auth/roles.ts
export type AppRole = "super_admin" | "admin" | "customer";

const ADMIN_EMAILS: Record<string, AppRole> = {
  "sapunshrestha1234@gmail.com": "super_admin",
  "sapunkayastha9988@gmail.com": "admin",
};

export function assignRoleForEmail(email: string): AppRole {
  return ADMIN_EMAILS[email.toLowerCase()] ?? "customer";
}
