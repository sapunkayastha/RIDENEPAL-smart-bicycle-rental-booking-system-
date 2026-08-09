export const APP_ROLES = ["super_admin", "admin", "customer"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function primaryRole(roles: string[]): AppRole {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  return "customer";
}

export function isStaffRole(roles: string[]): boolean {
  return roles.includes("super_admin") || roles.includes("admin");
}

export function homePathForRoles(roles: string[]): "/admin" | "/dashboard" {
  return isStaffRole(roles) ? "/admin" : "/dashboard";
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    default:
      return "Customer";
  }
}
