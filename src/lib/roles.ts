export const APP_ROLES = ["super_admin", "admin", "vendor", "customer"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function primaryRole(roles: string[]): AppRole {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("vendor")) return "vendor";
  return "customer";
}

export function isStaffRole(roles: string[]): boolean {
  return roles.includes("super_admin") || roles.includes("admin");
}

export function homePathForRoles(roles: string[]): "/admin" | "/vendor-dashboard" | "/dashboard" {
  if (isStaffRole(roles)) return "/admin";
  if (roles.includes("vendor")) return "/vendor-dashboard";
  return "/dashboard";
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "vendor":
      return "Vendor";
    default:
      return "Customer";
  }
}
