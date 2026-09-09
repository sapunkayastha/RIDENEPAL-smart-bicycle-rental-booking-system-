import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Users,
  Building2,
  Calendar,
  Tag,
  CheckCircle2,
  Store,
  MapPin,
  Loader2,
  XCircle,
} from "lucide-react";
import { submitBulkRentRequest, listMyBulkRentRequests } from "@/lib/bulk-rent.functions";
import { listVendorStorefronts } from "@/lib/vendor.functions";
import { useAuth } from "@/hooks/use-auth";
import { myRole } from "@/lib/auth.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import bike1 from "@/assets/bike-1.jpg";

export const Route = createFileRoute("/bulk-rent")({
  component: BulkRent,
  head: () => ({ meta: [{ title: "Bulk Bicycle Rental — RIDENEPAL" }] }),
});

const tiers = [
  { qty: "5–10 bikes", off: "10% off", note: "Small groups & families" },
  { qty: "11–25 bikes", off: "18% off", note: "Schools & clubs" },
  { qty: "26+ bikes", off: "25% off", note: "Corporate events & expos" },
];

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  quoted: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "Awaiting vendor review",
  quoted: "Quote received",
  paid: "Confirmed & paid",
  rejected: "Declined",
};

function BulkRent() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submitRequest = useServerFn(submitBulkRentRequest);
  const { user } = useAuth();
  const fetchMyRole = useServerFn(myRole);
  const { data: roleData } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchMyRole(),
    enabled: !!user,
    retry: false,
    throwOnError: false,
  });
  const isStaff = roleData?.isStaff ?? false;

  const fetchVendors = useServerFn(listVendorStorefronts);
  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendor-storefronts"],
    queryFn: () => fetchVendors(),
  });

  const fetchMyRequests = useServerFn(listMyBulkRentRequests);
  const { data: myRequests } = useQuery({
    queryKey: ["my-bulk-rent-requests"],
    queryFn: () => fetchMyRequests(),
    enabled: !!user && !isStaff,
  });

  const [form, setForm] = useState({
    vendor_id: "",
    organization: "",
    contact_email: "",
    bike_count: "",
    event_date: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    const count = Number(form.bike_count);
    if (!form.vendor_id) return setError("Please choose which vendor you'd like to rent from");
    if (!form.organization.trim()) return setError("Organization is required");
    if (!form.contact_email.trim()) return setError("Contact email is required");
    if (!count || count < 1) return setError("Enter a valid number of bikes");

    setSubmitting(true);
    try {
      await submitRequest({
        data: {
          vendor_id: form.vendor_id,
          organization: form.organization,
          contact_email: form.contact_email,
          bike_count: count,
          event_date: form.event_date || null,
          notes: form.notes || null,
        },
      });
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["my-bulk-rent-requests"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setSubmitted(false);
    setForm({
      vendor_id: "",
      organization: "",
      contact_email: "",
      bike_count: "",
      event_date: "",
      notes: "",
    });
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-12">
          <div>
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
              <Users className="size-3" /> GROUP & ENTERPRISE
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-4">
              Bulk Bicycle Rental
            </h1>
            <p className="text-muted-foreground mt-3">
              Renting for a school trip, corporate retreat, or a community ride? Pick a vendor, tell
              them what you need, and they'll send you a quote directly.
            </p>
          </div>
          <div className="aspect- 4/3 rounded-xl overflow-hidden">
            <img src={bike1} alt="Group rental" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {tiers.map((t) => (
            <Card key={t.qty} className="p-6 border-0 shadow-sm">
              <Tag className="size-5 text-primary mb-3" />
              <div className="font-semibold">{t.qty}</div>
              <div className="text-2xl font-bold text-primary mt-1">{t.off}</div>
              <p className="text-xs text-muted-foreground mt-2">{t.note}</p>
            </Card>
          ))}
        </div>

        <Card className="p-8 border-0 shadow-sm mb-10">
          {!user ? (
            <div className="text-center py-8">
              <Building2 className="size-10 text-muted-foreground mx-auto mb-3" />
              <h2 className="text-xl font-bold">Sign in to request a bulk quote</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Create a free account or sign in to submit a bulk rental request — this lets the
                vendor follow up with you directly.
              </p>
              <Button
                className="bg-primary hover:bg-primary/90"
                onClick={() => navigate({ to: "/auth" })}
              >
                Sign In / Create Account
              </Button>
            </div>
          ) : submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="size-10 text-primary mx-auto mb-3" />
              <h2 className="text-xl font-bold">Request sent to the vendor!</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                They'll review it and send you a quote — check "My Bulk Requests" below for updates,
                or watch your notifications.
              </p>
              <Button variant="outline" onClick={startAnother}>
                Submit another request
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                <Building2 className="size-5 text-primary" /> Request a Bulk Quote
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Choose a vendor and tell them about your event — only they'll see this request.
              </p>

              <div className="mb-5">
                <label className="text-xs text-muted-foreground">Which vendor?</label>
                {vendorsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <Loader2 className="size-4 animate-spin" /> Loading vendors…
                  </div>
                ) : (vendors?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    No vendors are available for bulk requests right now.
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    {vendors?.map((v) => (
                      <button
                        key={v.vendorId}
                        type="button"
                        onClick={() => setForm({ ...form, vendor_id: v.vendorId })}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          form.vendor_id === v.vendorId
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          <Store className="size-3.5 text-primary" /> {v.businessName}
                        </div>
                        {v.location && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin className="size-3" /> {v.location}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {v.bikeCount} bike{v.bikeCount === 1 ? "" : "s"} listed
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Organization</label>
                  <Input
                    className="mt-1"
                    placeholder="RIDENEPAL Trekking Club"
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Contact Email</label>
                  <Input
                    type="email"
                    className="mt-1"
                    placeholder="lead@org.com"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Number of bikes</label>
                  <Input
                    type="number"
                    className="mt-1"
                    placeholder="20"
                    value={form.bike_count}
                    onChange={(e) => setForm({ ...form, bike_count: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Event date</label>
                  <div className="flex items-center gap-2 mt-1 border rounded-md px-3 py-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <Input
                      type="date"
                      className="border-0 shadow-none p-0 h-auto"
                      value={form.event_date}
                      onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <Textarea
                    className="mt-1"
                    placeholder="Trail, helmet sizes, delivery location..."
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              {isStaff && (
                <p className="text-xs text-muted-foreground bg-secondary/70 rounded-md px-3 py-2 mt-3">
                  Admin and Super Admin accounts can't submit bulk rental requests. Use the Admin
                  Console to manage incoming requests instead.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  className="bg-primary hover:bg-primary/90"
                  disabled={submitting || isStaff}
                  onClick={submit}
                >
                  {submitting ? "Submitting…" : "Submit Bulk Request"}
                </Button>
                <Button asChild variant="outline">
                  <Link
                    to="/fleet"
                    search={{ pickup: undefined, date: undefined, days: undefined }}
                  >
                    Browse Fleet
                  </Link>
                </Button>
              </div>
              <ul className="mt-6 grid md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                {[
                  "On-site delivery & pickup",
                  "Helmet & repair kit included",
                  "Dedicated event coordinator",
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <CheckCircle2 className="size-3 text-primary mt-0.5" /> {x}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        {user && !isStaff && (myRequests?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">My Bulk Requests</h2>
            <div className="space-y-4">
              {myRequests?.map((r) => (
                <Card key={r.id} className="p-5 border-0 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-semibold text-sm">{r.organization}</div>
                      {r.vendor_business_name && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Store className="size-3" /> {r.vendor_business_name}
                          {r.vendor_location ? ` · ${r.vendor_location}` : ""}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[r.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {statusLabels[r.status] ?? r.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.bike_count} bikes
                    {r.event_date ? ` · Event: ${new Date(r.event_date).toLocaleDateString()}` : ""}
                  </div>

                  {r.status === "quoted" && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-md p-3 text-sm">
                      <div className="font-semibold text-blue-900">
                        Quote: NPR {Number(r.price_per_bike).toFixed(0)}/bike · Total NPR{" "}
                        {Number(r.total_amount).toFixed(0)}
                      </div>
                      {r.pickup_location && (
                        <div className="text-xs text-blue-800 mt-1 flex items-center gap-1">
                          <MapPin className="size-3" /> Pickup: {r.pickup_location}
                        </div>
                      )}
                      {r.vendor_notes && (
                        <div className="text-xs text-blue-800 mt-1">"{r.vendor_notes}"</div>
                      )}
                      <p className="text-xs text-blue-700 mt-2">
                        Arrange payment directly with the vendor — they'll confirm your booking once
                        received.
                      </p>
                    </div>
                  )}

                  {r.status === "paid" && (
                    <div className="mt-3 flex items-center gap-1 text-sm text-green-700 font-medium">
                      <CheckCircle2 className="size-4" /> Payment confirmed — total NPR{" "}
                      {Number(r.total_amount).toFixed(0)}
                    </div>
                  )}

                  {r.status === "rejected" && (
                    <div className="mt-3 flex items-start gap-1 text-sm text-destructive">
                      <XCircle className="size-4 shrink-0 mt-0.5" />
                      {r.rejection_reason ?? "This vendor couldn't fulfil the request."}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
