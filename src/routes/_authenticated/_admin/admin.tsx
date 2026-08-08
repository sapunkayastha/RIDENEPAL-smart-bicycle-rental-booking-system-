import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listCustomers, setUserRole } from "@/lib/admin.functions";
import { ShieldCheck, Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Console — RIDENEPAL" },
      { name: "description", content: "Super admin console to manage RIDENEPAL customers and account status." },
      { property: "og:title", content: "Admin Console — RIDENEPAL" },
      { property: "og:description", content: "Manage RIDENEPAL customers, roles and account verification status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminDashboard() {
  const fetchCustomers = useServerFn(listCustomers);
  const changeRole = useServerFn(setUserRole);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => fetchCustomers(),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "super_admin" | "customer" }) =>
      changeRole({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update role"),
  });

  const rows = (data ?? []).filter((c) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [c.email, c.fullName, c.phone].some((v) => v?.toLowerCase().includes(t));
  });

  const verified = (data ?? []).filter((c) => c.otpVerified).length;
  const admins = (data ?? []).filter((c) => c.roles.includes("super_admin")).length;

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="text-3xl font-bold">Super Admin Console</h1>
        </div>
        <p className="text-muted-foreground mb-8">Manage customers, roles and account verification status.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold"><Users className="size-4" /> TOTAL ACCOUNTS</div>
            <div className="text-3xl font-bold mt-2">{data?.length ?? 0}</div>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">VERIFIED (OTP)</div>
            <div className="text-3xl font-bold mt-2 text-primary">{verified}</div>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">SUPER ADMINS</div>
            <div className="text-3xl font-bold mt-2">{admins}</div>
          </Card>
        </div>

        <div className="mb-4 max-w-sm">
          <Input placeholder="Search by email, name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading customers…</p>
        ) : (
          <Card className="border-0 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Bookings</th>
                  <th className="px-4 py-3">Spend</th>
                  <th className="px-4 py-3">Last sign-in</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const isAdmin = c.roles.includes("super_admin");
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.fullName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.email ?? c.id.slice(0, 8)}</div>
                        {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs">
                          {c.otpVerified ? <CheckCircle2 className="size-3.5 text-primary" /> : <XCircle className="size-3.5 text-muted-foreground" />}
                          {c.otpVerified ? "Verified" : "Unverified"}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.emailConfirmed ? "Email confirmed" : "Email pending"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {(c.roles[0] ?? "customer").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">{c.bookingCount}</td>
                      <td className="px-4 py-3">NPR {c.totalSpend.toFixed(0)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.lastSignInAt ? new Date(c.lastSignInAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={roleMutation.isPending}
                          onClick={() => roleMutation.mutate({ userId: c.id, role: isAdmin ? "customer" : "super_admin" })}
                        >
                          {isAdmin ? "Make customer" : "Make admin"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No accounts found.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </main>
    </div>
  );
}
