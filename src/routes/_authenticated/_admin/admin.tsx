import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listCustomers,
  setUserRole,
  myRole,
  listPendingBookings,
  verifyBookingPayment,
  listActiveBookings,
  completeBooking,
  markDocumentsVerified,
  listCancelledBookings,
  refundBooking,
  listAuditLog,
  deleteCustomer,
} from "@/lib/admin.functions";
import { cancelBooking } from "@/lib/bookings.functions";
import { roleLabel, type AppRole } from "@/lib/roles";
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Bike,
  RotateCcw,
  History,
  ChevronDown,
  Store,
  Percent,
  Radio,
  MessageSquare,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  component: AdminDashboard,
  head: () => ({
    meta: [
      { title: "Admin Console — RIDENEPAL" },
      { name: "description", content: "Manage RIDENEPAL customers, bookings, and account status." },
    ],
  }),
});

function AdminDashboard() {
  const fetchCustomers = useServerFn(listCustomers);
  const changeRole = useServerFn(setUserRole);
  const fetchMyRole = useServerFn(myRole);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const { data: viewer } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchMyRole(),
  });
  const isSuperAdmin = viewer?.isSuperAdmin ?? false;

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

  const removeCustomer = useServerFn(deleteCustomer);
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => removeCustomer({ data: { userId } }),
    onSuccess: () => {
      toast.success("Customer account deleted");
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete customer"),
  });

  const fetchPendingBookings = useServerFn(listPendingBookings);
  const verifyBooking = useServerFn(verifyBookingPayment);

  const { data: pendingBookings } = useQuery({
    queryKey: ["admin-pending-bookings"],
    queryFn: () => fetchPendingBookings(),
  });

  const verifyMutation = useMutation({
    mutationFn: (vars: { bookingId: string }) => verifyBooking({ data: vars }),
    onSuccess: () => {
      toast.success("Booking verified and activated");
      qc.invalidateQueries({ queryKey: ["admin-pending-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-log"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to verify booking"),
  });

  const fetchActiveBookings = useServerFn(listActiveBookings);
  const complete = useServerFn(completeBooking);
  const cancelBookingAdmin = useServerFn(cancelBooking);

  const { data: activeBookings } = useQuery({
    queryKey: ["admin-active-bookings"],
    queryFn: () => fetchActiveBookings(),
  });

  const completeMutation = useMutation({
    mutationFn: (vars: { bookingId: string }) => complete({ data: vars }),
    onSuccess: () => {
      toast.success("Ride marked completed");
      qc.invalidateQueries({ queryKey: ["admin-active-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-log"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to complete ride"),
  });

  const markDocs = useServerFn(markDocumentsVerified);
  const markDocsMutation = useMutation({
    mutationFn: (bookingId: string) => markDocs({ data: { bookingId } }),
    onSuccess: () => {
      toast.success("Documents marked as verified");
      qc.invalidateQueries({ queryKey: ["admin-active-bookings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const cancelAdminMutation = useMutation({
    mutationFn: (id: string) => cancelBookingAdmin({ data: { id } }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["admin-active-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-cancelled-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-log"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to cancel booking"),
  });

  const fetchCancelledBookings = useServerFn(listCancelledBookings);
  const refund = useServerFn(refundBooking);

  const { data: cancelledBookings } = useQuery({
    queryKey: ["admin-cancelled-bookings"],
    queryFn: () => fetchCancelledBookings(),
  });

  const refundMutation = useMutation({
    mutationFn: (vars: { bookingId: string; notes?: string }) => refund({ data: vars }),
    onSuccess: () => {
      toast.success("Booking marked refunded");
      qc.invalidateQueries({ queryKey: ["admin-cancelled-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-log"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to mark refunded"),
  });

  const fetchAuditLog = useServerFn(listAuditLog);
  const { data: auditLog } = useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: () => fetchAuditLog(),
  });

  const [page, setPage] = useState(1);

  const filteredRows = (data ?? []).filter((c) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [c.email, c.fullName, c.phone].some((v) => v?.toLowerCase().includes(t));
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const verifiedCount = (data ?? []).filter((c) => c.otpVerified).length;
  const staffCount = (data ?? []).filter(
    (c) => c.roles.includes("super_admin") || c.roles.includes("admin"),
  ).length;

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold">
              {isSuperAdmin ? "Super Admin Console" : "Admin Console"}
            </h1>
          </div>
          <div className="relative" ref={toolsRef}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setToolsOpen((o) => !o)}
            >
              Admin Tools
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
            {toolsOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-background shadow-lg z-50 py-1">
                {isSuperAdmin && (
                  <>
                    <Link
                      to="/vendors"
                      onClick={() => setToolsOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50"
                    >
                      <Store className="size-4 text-muted-foreground" /> Vendor Applications
                    </Link>
                    <Link
                      to="/commissions"
                      onClick={() => setToolsOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50"
                    >
                      <Percent className="size-4 text-muted-foreground" /> Commissions
                    </Link>
                    <div className="border-t my-1" />
                  </>
                )}
                <Link
                  to="/tracking"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50"
                >
                  <Radio className="size-4 text-muted-foreground" /> Live Tracking
                </Link>
                <Link
                  to="/manage-bikes"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50"
                >
                  <Bike className="size-4 text-muted-foreground" /> Manage Bikes
                </Link>
                <Link
                  to="/messages"
                  onClick={() => setToolsOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary/50"
                >
                  <MessageSquare className="size-4 text-muted-foreground" /> Support Inbox
                </Link>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          {isSuperAdmin
            ? "Manage customers, staff roles, and account verification status."
            : "Manage customers and account verification status. Role changes are restricted to Super Admins."}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
          <Card className="p-4 sm:p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
              <Users className="size-4" /> TOTAL ACCOUNTS
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2">{data?.length ?? 0}</div>
          </Card>
          <Card className="p-4 sm:p-5 border-0 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">VERIFIED (OTP)</div>
            <div className="text-2xl sm:text-3xl font-bold mt-2 text-primary">{verifiedCount}</div>
          </Card>
          <Card className="p-4 sm:p-5 border-0 shadow-sm">
            <div className="text-xs font-semibold text-muted-foreground">
              STAFF (ADMIN + SUPER ADMIN)
            </div>
            <div className="text-2xl sm:text-3xl font-bold mt-2">{staffCount}</div>
          </Card>
        </div>

        {pendingBookings && pendingBookings.length > 0 && (
          <Card className="p-4 sm:p-5 border-0 shadow-sm mb-8">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Clock className="size-4 text-primary" /> Pending Verification (
              {pendingBookings.length})
            </h2>
            <div className="space-y-3">
              {pendingBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {b.bikeName} · {b.customerName ?? b.customerEmail}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.customerEmail} · Pickup: {b.pickupLocation ?? "—"} · NPR{" "}
                      {Number(b.totalAmount).toFixed(0)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 shrink-0"
                    disabled={verifyMutation.isPending}
                    onClick={() => verifyMutation.mutate({ bookingId: b.id })}
                  >
                    {verifyMutation.isPending ? "Verifying…" : "Verify & Activate"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="mb-4 w-full sm:max-w-sm">
          <Input
            placeholder="Search by email, name or phone…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading customers…
          </p>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden space-y-3">
              {rows.map((c) => {
                const role: AppRole = c.roles.includes("super_admin")
                  ? "super_admin"
                  : c.roles.includes("admin")
                    ? "admin"
                    : "customer";
                const isSelf = viewer && c.id === viewer.userId;
                return (
                  <Card key={c.id} className="p-4 border-0 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.fullName ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.email ?? c.id.slice(0, 8)}
                        </div>
                        {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${role !== "customer" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        {roleLabel(role).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs mt-3">
                      {c.otpVerified ? (
                        <CheckCircle2 className="size-3.5 text-primary" />
                      ) : (
                        <XCircle className="size-3.5 text-muted-foreground" />
                      )}
                      {c.otpVerified ? "Verified" : "Unverified"} ·{" "}
                      {c.emailConfirmed ? "Email confirmed" : "Email pending"}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                      <div>
                        <div className="text-muted-foreground">Bookings</div>
                        <div className="font-medium">{c.bookingCount}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Spend</div>
                        <div className="font-medium">NPR {c.totalSpend.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Last sign-in</div>
                        <div className="font-medium">
                          {c.lastSignInAt ? new Date(c.lastSignInAt).toLocaleDateString() : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/customer/$userId" params={{ userId: c.id }}>
                          View
                        </Link>
                      </Button>
                      {role === "customer" && !isSelf && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Permanently delete ${c.email}? This removes their account and ALL their bookings. This cannot be undone.`,
                              )
                            ) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      )}
                      {isSuperAdmin &&
                        !isSelf &&
                        (role === "super_admin" ? (
                          <span className="text-xs text-muted-foreground">Role locked</span>
                        ) : role === "admin" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={roleMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Revoke admin access for ${c.email}? They will become a regular customer.`,
                                )
                              ) {
                                roleMutation.mutate({ userId: c.id, role: "customer" });
                              }
                            }}
                          >
                            Revoke Admin
                          </Button>
                        ) : null)}
                    </div>
                  </Card>
                );
              })}
              {rows.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No accounts found.</p>
              )}
            </div>

            {/* Desktop: table */}
            <Card className="hidden md:block border-0 shadow-sm overflow-x-auto">
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
                    const role: AppRole = c.roles.includes("super_admin")
                      ? "super_admin"
                      : c.roles.includes("admin")
                        ? "admin"
                        : "customer";
                    const isSelf = viewer && c.id === viewer.userId;
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{c.fullName ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.email ?? c.id.slice(0, 8)}
                          </div>
                          {c.phone && (
                            <div className="text-xs text-muted-foreground">{c.phone}</div>
                          )}
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
                            className={`text-[10px] font-semibold px-2 py-1 rounded-full ${role !== "customer" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                          >
                            {roleLabel(role).toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">{c.bookingCount}</td>
                        <td className="px-4 py-3">NPR {c.totalSpend.toFixed(0)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {c.lastSignInAt ? new Date(c.lastSignInAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link to="/customer/$userId" params={{ userId: c.id }}>
                                View
                              </Link>
                            </Button>
                            {role === "customer" && !isSelf && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Permanently delete ${c.email}? This removes their account and ALL their bookings. This cannot be undone.`,
                                    )
                                  ) {
                                    deleteMutation.mutate(c.id);
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            )}
                            {isSuperAdmin &&
                              (isSelf ? (
                                <span className="text-xs text-muted-foreground">This is you</span>
                              ) : role === "super_admin" ? (
                                <span className="text-xs text-muted-foreground">Locked</span>
                              ) : role === "admin" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={roleMutation.isPending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Revoke admin access for ${c.email}? They will become a regular customer.`,
                                      )
                                    ) {
                                      roleMutation.mutate({ userId: c.id, role: "customer" });
                                    }
                                  }}
                                >
                                  Revoke Admin
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Customer</span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </>
        )}

        {filteredRows.length > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4">
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages} · {filteredRows.length} accounts
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {activeBookings && activeBookings.length > 0 && (
          <Card className="p-4 sm:p-5 border-0 shadow-sm mt-8">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Bike className="size-4 text-primary" /> Active Rides ({activeBookings.length})
            </h2>
            <div className="space-y-3">
              {activeBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {b.bikeName} · {b.customerName ?? b.customerEmail}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.customerEmail} · NPR {Number(b.totalAmount).toFixed(0)} · Ends{" "}
                      {new Date(b.endDate).toLocaleDateString()}
                    </div>
                    <div className="mt-1">
                      {b.documentsVerified ? (
                        <span className="text-[10px] font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          ✓ Documents verified at pickup
                        </span>
                      ) : (
                        <button
                          className="text-[10px] font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full hover:bg-yellow-200"
                          disabled={markDocsMutation.isPending}
                          onClick={() => markDocsMutation.mutate(b.id)}
                        >
                          Mark documents verified
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={cancelAdminMutation.isPending}
                      onClick={() => {
                        if (window.confirm("Cancel this active ride?")) {
                          cancelAdminMutation.mutate(b.id);
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      disabled={completeMutation.isPending}
                      onClick={() => completeMutation.mutate({ bookingId: b.id })}
                    >
                      {completeMutation.isPending ? "Saving…" : "Mark Completed"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {cancelledBookings && cancelledBookings.length > 0 && (
          <Card className="p-4 sm:p-5 border-0 shadow-sm mt-8">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <RotateCcw className="size-4 text-primary" /> Cancelled — Awaiting Refund (
              {cancelledBookings.length})
            </h2>
            <div className="space-y-3">
              {cancelledBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {b.bikeName} · {b.customerName ?? b.customerEmail}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.customerEmail} · NPR {Number(b.totalAmount).toFixed(0)} · Cancelled{" "}
                      {b.cancelledAt ? new Date(b.cancelledAt).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={refundMutation.isPending}
                    onClick={() => {
                      const notes = window.prompt("Optional refund note:");
                      if (notes === null) return; // user clicked Cancel — abort entirely
                      if (
                        !window.confirm(
                          `Confirm refund of NPR ${Number(b.totalAmount).toFixed(0)}?`,
                        )
                      )
                        return;
                      refundMutation.mutate({ bookingId: b.id, notes: notes || undefined });
                    }}
                  >
                    Mark Refunded
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {auditLog && auditLog.length > 0 && (
          <Card className="p-4 sm:p-5 border-0 shadow-sm mt-8">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <History className="size-4 text-primary" /> Recent Activity
            </h2>
            <div className="space-y-2 text-xs">
              {auditLog.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b pb-2">
                  <span>
                    <span className="font-medium">{a.actorEmail}</span> —{" "}
                    {a.action.replace(/_/g, " ")}
                    {a.details ? `: ${a.details}` : ""}
                  </span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
