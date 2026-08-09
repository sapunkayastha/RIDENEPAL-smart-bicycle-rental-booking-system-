import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { amISuperAdmin, amIStaff, listCustomers, setUserRole } from "@/lib/admin.functions";
import type { AppRole } from "@/lib/roles";
import { roleLabel } from "@/lib/roles";
import { ShieldCheck, Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Console — RIDENEPAL" },
      { name: "description", content: "Staff console to manage RIDENEPAL customers, admins, and account status." },
      { property: "og:title", content: "Admin Console — RIDENEPAL" },
      { property: "og:description", content: "Manage RIDENEPAL customers, roles and account verification status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function roleBadgeClass(role: AppRole) {
  if (role === "super_admin") return "bg-primary/15 text-primary";
  if (role === "admin") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function AdminDashboard() {
  const fetchCustomers = useServerFn(listCustomers);
  const changeRole = useServerFn(setUserRole);
  const checkStaff = useServerFn(amIStaff);
  const checkSuperAdmin = useServerFn(amISuperAdmin);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: staffAccess } = useQuery({
    queryKey: ["staff-access"],
    queryFn: () => checkStaff(),
  });

  const { data: superAdminAccess } = useQuery({
    queryKey: ["super-admin-access"],
    queryFn: () => checkSuperAdmin(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => fetchCustomers(),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole }) => changeRole({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update role"),
  });

  const rows = (data ?? []).filter((c) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [c.email, c.fullName, c.phone, c.primaryRole].some((v) => v?.toLowerCase().includes(t));
  });

  const verified = (data ?? []).filter((c) => c.otpVerified).length;
  const superAdmins = (data ?? []).filter((c) => c.primaryRole === "super_admin").length;
  const admins = (data ?? []).filter((c) => c.primaryRole === "admin").length;
  const customers = (data ?? []).filter((c) => c.primaryRole === "customer").length;
  const canManageRoles = Boolean(superAdminAccess?.isSuperAdmin);
  const consoleTitle = staffAccess?.isSuperAdmin ? "Super Admin Console" : "Admin Console";

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="text-3xl font-bold">{consoleTitle}</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          {canManageRoles
            ? "Manage customers, assign admin roles, and review verification status."
            : "Review customer accounts, bookings, and verification status."}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <Users className="size-4" /> TOTAL ACCOUNTS
            </div>
            <div className="text-3xl font-bold mt-2">{data?.length ?? 0}</div>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">VERIFIED (OTP)</div>
            <div className="text-3xl font-bold mt-2 text-primary">{verified}</div>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">STAFF</div>
            <div className="text-3xl font-bold mt-2">{superAdmins + admins}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {superAdmins} super · {admins} admin · {customers} customers
            </div>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">YOUR ACCESS</div>
            <div className="text-sm font-semibold mt-2">
              {staffAccess?.isSuperAdmin ? "Super Admin" : staffAccess?.isAdmin ? "Admin" : "Staff"}
            </div>
          </Card>
        </div>

        <div className="mb-4 max-w-sm">
          <Input placeholder="Search by email, name, phone, or role…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading accounts…
          </p>
        ) : (
          <Card className="border-0 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Bookings</th>
                  <th className="px-4 py-3">Spend</th>
                  <th className="px-4 py-3">Last sign-in</th>
                  {canManageRoles && <th className="px-4 py-3 text-right">Change role</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.fullName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.email ?? c.id.slice(0, 8)}</div>
                      {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs">
                        {c.otpVerified ? (
                          <CheckCircle2 className="size-3.5 text-primary" />
                        ) : (
                          <XCircle className="size-3.5 text-muted-foreground" />
                        )}
                        {c.otpVerified ? "Verified" : "Unverified"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.emailConfirmed ? "Email confirmed" : "Email pending"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full ${roleBadgeClass(c.primaryRole)}`}
                      >
                        {roleLabel(c.primaryRole).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.bookingCount}</td>
                    <td className="px-4 py-3">NPR {c.totalSpend.toFixed(0)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.lastSignInAt ? new Date(c.lastSignInAt).toLocaleDateString() : "—"}
                    </td>
                    {canManageRoles && (
                      <td className="px-4 py-3 text-right min-w-[180px]">
                        <Select
                          value={c.primaryRole}
                          disabled={roleMutation.isPending}
                          onValueChange={(role) => roleMutation.mutate({ userId: c.id, role: role as AppRole })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={canManageRoles ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                      No accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {canManageRoles && (
          <Card className="mt-8 p-5 border-0 shadow-sm bg-muted/30">
            <h2 className="font-semibold mb-2">How the three roles work</h2>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>
                <strong className="text-foreground">Customer</strong> — books bikes, tracks rides, uses rewards.
              </li>
              <li>
                <strong className="text-foreground">Admin</strong> — opens this console to view accounts and activity.
              </li>
              <li>
                <strong className="text-foreground">Super Admin</strong> — full console access plus changing user roles.
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Create separate sign-in accounts in Supabase Auth, then assign each account the role you want here.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
