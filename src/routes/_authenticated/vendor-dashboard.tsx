import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  getMyVendorProfile,
  updateMyVendorProfile,
  listMyVendorBikes,
  createVendorBike,
  updateVendorBike,
  applyAsVendorSelf,
  getMyVendorEarnings,
  getMyVendorDailyCashFlow,
  getMyVendorDashboardSummary,
} from "@/lib/vendor.functions";
import {
  listVendorBulkRequests,
  quoteBulkRentRequest,
  rejectBulkRentRequest,
  markBulkRentPaid,
} from "@/lib/bulk-rent.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendor-dashboard")({
  component: VendorDashboard,
  head: () => ({ meta: [{ title: "Vendor Dashboard — RIDENEPAL" }] }),
});

type Bike = {
  id: string;
  name: string;
  type: string;
  price_per_day: number;
  available: number;
  quantity: number;
  currently_rented: number;
  image_url?: string | null;
};

// Same proven in-browser compression used for bike photos and vendor
// registration — stores as a base64 data URL, no separate file storage.
function resizeImageToDataUrl(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function ApplyAsVendorForm() {
  const qc = useQueryClient();
  const apply = useServerFn(applyAsVendorSelf);
  const [form, setForm] = useState({ businessName: "", panNumber: "", vatNumber: "" });
  const [idDocument, setIdDocument] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!idDocument) throw new Error("Please upload a photo of your ID or PAN card");
      return apply({
        data: {
          businessName: form.businessName,
          panNumber: form.panNumber,
          vatNumber: form.vatNumber || undefined,
          idDocument,
        },
      });
    },
    onSuccess: () => {
      toast.success("Vendor application submitted!");
      qc.invalidateQueries({ queryKey: ["my-vendor-profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit application"),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setIdDocument(await resizeImageToDataUrl(file));
    } catch {
      toast.error("Could not process that image, try a different file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="p-6 border-0 shadow-sm space-y-4 max-w-md">
      <div>
        <h2 className="font-semibold">Apply to become a vendor</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Uses your current account — no need to sign up again.
        </p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Business name</label>
        <Input
          value={form.businessName}
          onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">PAN number</label>
        <Input
          value={form.panNumber}
          onChange={(e) => setForm((f) => ({ ...f, panNumber: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">VAT number (optional)</label>
        <Input
          value={form.vatNumber}
          onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Upload photo of your PAN/ID card</label>
        <div className="flex items-start gap-4 mt-1">
          {idDocument && (
            <img
              src={idDocument}
              alt="ID preview"
              className="w-24 h-16 rounded-md object-cover border shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
            />
            {uploading && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Processing image…
              </p>
            )}
          </div>
        </div>
      </div>
      <Button
        className="w-full bg-primary hover:bg-primary/90"
        disabled={mutation.isPending || uploading}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Submitting…" : "Submit Application"}
      </Button>
    </Card>
  );
}

function VendorDashboard() {
  const fetchProfile = useServerFn(getMyVendorProfile);
  const fetchBikes = useServerFn(listMyVendorBikes);
  const fetchEarnings = useServerFn(getMyVendorEarnings);
  const addBike = useServerFn(createVendorBike);
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-vendor-profile"],
    queryFn: () => fetchProfile(),
  });
  const { data: bikes } = useQuery({
    queryKey: ["my-vendor-bikes"],
    queryFn: () => fetchBikes() as Promise<Bike[]>,
    enabled: profile?.status === "approved",
  });
  const { data: earnings } = useQuery({
    queryKey: ["my-vendor-earnings"],
    queryFn: () =>
      fetchEarnings() as Promise<{
        totals: { total_earned: number; paid_bookings: number };
        bookings: {
          id: string;
          bike_name: string;
          total_amount: number;
          platform_commission: number;
          vendor_payout: number;
          status: string;
          created_at: string;
          source: "booking" | "bulk";
        }[];
      }>,
    enabled: profile?.status === "approved",
  });

  const fetchSummary = useServerFn(getMyVendorDashboardSummary);
  const { data: dashSummary } = useQuery({
    queryKey: ["my-vendor-dashboard-summary"],
    queryFn: () =>
      fetchSummary() as Promise<{
        today: number;
        this_week: number;
        this_month: number;
        this_year: number;
      }>,
    enabled: profile?.status === "approved",
  });

  const fetchCashFlow = useServerFn(getMyVendorDailyCashFlow);
  const { data: cashFlow } = useQuery({
    queryKey: ["my-vendor-cash-flow"],
    queryFn: () =>
      fetchCashFlow() as Promise<{ day: string; booking_count: number; earned: number }[]>,
    enabled: profile?.status === "approved",
  });

  const fetchBulkRequests = useServerFn(listVendorBulkRequests);
  const { data: bulkRequests } = useQuery({
    queryKey: ["my-vendor-bulk-requests"],
    queryFn: () =>
      fetchBulkRequests() as Promise<
        {
          id: string;
          organization: string;
          contact_email: string;
          bike_count: number;
          event_date: string | null;
          notes: string | null;
          status: string;
          customer_name: string | null;
        }[]
      >,
    enabled: profile?.status === "approved",
  });
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({ price: "", pickup: "", notes: "" });
  const sendQuote = useServerFn(quoteBulkRentRequest);
  const quoteMutation = useMutation({
    mutationFn: (requestId: string) =>
      sendQuote({
        data: {
          requestId,
          pricePerBike: Number(quoteForm.price),
          pickupLocation: quoteForm.pickup || undefined,
          vendorNotes: quoteForm.notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Quote sent");
      setQuotingId(null);
      setQuoteForm({ price: "", pickup: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["my-vendor-bulk-requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to send quote"),
  });

  const reject = useServerFn(rejectBulkRentRequest);
  const rejectMutation = useMutation({
    mutationFn: (vars: { requestId: string; reason: string }) => reject({ data: vars }),
    onSuccess: () => {
      toast.success("Request declined");
      qc.invalidateQueries({ queryKey: ["my-vendor-bulk-requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to decline"),
  });

  const confirmPaid = useServerFn(markBulkRentPaid);
  const markPaidMutation = useMutation({
    mutationFn: (requestId: string) => confirmPaid({ data: { requestId } }),
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["my-vendor-bulk-requests"] });
      qc.invalidateQueries({ queryKey: ["my-vendor-earnings"] });
      qc.invalidateQueries({ queryKey: ["my-vendor-cash-flow"] });
      qc.invalidateQueries({ queryKey: ["my-vendor-dashboard-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    businessName: "",
    panNumber: "",
    vatNumber: "",
    businessAddress: "",
  });
  const saveProfile = useServerFn(updateMyVendorProfile);
  const profileMutation = useMutation({
    mutationFn: () => saveProfile({ data: profileForm }),
    onSuccess: () => {
      toast.success("Profile updated");
      setEditingProfile(false);
      qc.invalidateQueries({ queryKey: ["my-vendor-profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update profile"),
  });

  function startEditingProfile() {
    if (!profile) return;
    setProfileForm({
      businessName: profile.business_name ?? "",
      panNumber: profile.pan_number ?? "",
      vatNumber: profile.vat_number ?? "",
      businessAddress: profile.business_address ?? "",
    });
    setEditingProfile(true);
  }

  const [form, setForm] = useState({
    name: "",
    type: "manual",
    price: "",
    description: "",
    quantity: "1",
  });
  const [bikeImage, setBikeImage] = useState<string | null>(null);
  const [bikeImageUploading, setBikeImageUploading] = useState(false);

  async function handleBikeImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBikeImageUploading(true);
    try {
      setBikeImage(await resizeImageToDataUrl(file));
    } catch {
      toast.error("Could not process that image, try a different file");
    } finally {
      setBikeImageUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      addBike({
        data: {
          name: form.name,
          type: form.type as "manual" | "hybrid" | "electric",
          price_per_day: Number(form.price),
          description: form.description || null,
          image_url: bikeImage,
          available: true,
          quantity: Math.max(0, Number(form.quantity) || 0),
        },
      }),
    onSuccess: () => {
      toast.success("Bike added");
      setForm({ name: "", type: "manual", price: "", description: "", quantity: "1" });
      setBikeImage(null);
      qc.invalidateQueries({ queryKey: ["my-vendor-bikes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add bike"),
  });

  const editStock = useServerFn(updateVendorBike);
  const stockMutation = useMutation({
    mutationFn: (bike: Bike) =>
      editStock({
        data: {
          id: bike.id,
          name: bike.name,
          type: bike.type as "manual" | "hybrid" | "electric",
          price_per_day: Number(bike.price_per_day),
          available: Boolean(bike.available),
          quantity: bike.quantity,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-vendor-bikes"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update stock"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/20">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 py-16 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-secondary/20">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold mb-6">Vendor Dashboard</h1>
          <ApplyAsVendorForm />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold">Vendor Dashboard</h1>

        <Card className="p-5 border-0 shadow-sm">
          {editingProfile ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Business name</label>
                <Input
                  value={profileForm.businessName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, businessName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">PAN number</label>
                <Input
                  value={profileForm.panNumber}
                  onChange={(e) => setProfileForm((f) => ({ ...f, panNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">VAT number (optional)</label>
                <Input
                  value={profileForm.vatNumber}
                  onChange={(e) => setProfileForm((f) => ({ ...f, vatNumber: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Business address / location</label>
                <Input
                  value={profileForm.businessAddress}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, businessAddress: e.target.value }))
                  }
                  placeholder="Where customers pick up from"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                  disabled={profileMutation.isPending || !profileForm.businessName}
                  onClick={() => profileMutation.mutate()}
                >
                  {profileMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm">
                  <span className="font-semibold">{profile.business_name}</span> · PAN{" "}
                  {profile.pan_number}
                  {profile.vat_number && <> · VAT {profile.vat_number}</>}
                  {profile.business_address && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {profile.business_address}
                    </div>
                  )}
                </div>
                {profile.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={startEditingProfile}>
                    Edit Profile
                  </Button>
                )}
              </div>
              <div className="mt-2">
                {profile.status === "pending" && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                    PENDING REVIEW
                  </span>
                )}
                {profile.status === "approved" && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">
                    APPROVED
                  </span>
                )}
                {profile.status === "rejected" && (
                  <>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800">
                      REJECTED
                    </span>
                    {profile.rejection_reason && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Reason: {profile.rejection_reason}
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </Card>

        {profile.status === "approved" && (
          <>
            <div>
              <h2 className="font-semibold text-sm mb-3">Income Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-4 border-0 shadow-sm">
                  <div className="text-xs text-muted-foreground">Today</div>
                  <div className="text-lg font-bold text-primary mt-1">
                    NPR {Number(dashSummary?.today ?? 0).toFixed(0)}
                  </div>
                </Card>
                <Card className="p-4 border-0 shadow-sm">
                  <div className="text-xs text-muted-foreground">This Week</div>
                  <div className="text-lg font-bold text-primary mt-1">
                    NPR {Number(dashSummary?.this_week ?? 0).toFixed(0)}
                  </div>
                </Card>
                <Card className="p-4 border-0 shadow-sm">
                  <div className="text-xs text-muted-foreground">This Month</div>
                  <div className="text-lg font-bold text-primary mt-1">
                    NPR {Number(dashSummary?.this_month ?? 0).toFixed(0)}
                  </div>
                </Card>
                <Card className="p-4 border-0 shadow-sm">
                  <div className="text-xs text-muted-foreground">This Year</div>
                  <div className="text-lg font-bold text-primary mt-1">
                    NPR {Number(dashSummary?.this_year ?? 0).toFixed(0)}
                  </div>
                </Card>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-5 border-0 shadow-sm">
                <div className="text-xs text-muted-foreground">Total earned (all time)</div>
                <div className="text-2xl font-bold text-primary mt-1">
                  NPR {Number(earnings?.totals.total_earned ?? 0).toFixed(0)}
                </div>
              </Card>
              <Card className="p-5 border-0 shadow-sm">
                <div className="text-xs text-muted-foreground">Paid bookings</div>
                <div className="text-2xl font-bold mt-1">{earnings?.totals.paid_bookings ?? 0}</div>
              </Card>
            </div>

            <Card className="p-5 border-0 shadow-sm">
              <h2 className="font-semibold text-sm mb-3">Recent bookings & bulk requests</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-4">Bike / Request</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                      <th className="py-2 pr-4 text-right">Platform fee</th>
                      <th className="py-2 pr-4 text-right">You earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings?.bookings.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{b.bike_name}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              b.source === "bulk"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-primary/15 text-primary"
                            }`}
                          >
                            {b.source === "bulk" ? "BULK" : "BOOKING"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 capitalize text-muted-foreground">{b.status}</td>
                        <td className="py-2 pr-4 text-right">
                          NPR {Number(b.total_amount).toFixed(0)}
                        </td>
                        <td className="py-2 pr-4 text-right text-muted-foreground">
                          NPR {Number(b.platform_commission).toFixed(0)}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold text-primary">
                          NPR {Number(b.vendor_payout).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {earnings?.bookings.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">No bookings yet.</p>
                )}
              </div>
            </Card>

            <Card className="p-5 border-0 shadow-sm">
              <h2 className="font-semibold text-sm mb-3">Daily Cash Flow</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4 text-right">Bookings</th>
                      <th className="py-2 pr-4 text-right">Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow?.map((d) => (
                      <tr key={d.day} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          {new Date(d.day).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-2 pr-4 text-right">{d.booking_count}</td>
                        <td className="py-2 pr-4 text-right font-semibold text-primary">
                          NPR {Number(d.earned).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cashFlow?.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">No earnings yet.</p>
                )}
              </div>
            </Card>

            <Card className="p-5 border-0 shadow-sm">
              <h2 className="font-semibold text-sm mb-3">Bulk Rent Requests</h2>
              <div className="space-y-3">
                {bulkRequests?.map((r) => (
                  <Card key={r.id} className="p-4 border shadow-none">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{r.organization}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.customer_name} · {r.contact_email}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {r.bike_count} bikes
                          {r.event_date
                            ? ` · Event: ${new Date(r.event_date).toLocaleDateString()}`
                            : ""}
                        </div>
                        {r.notes && (
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            "{r.notes}"
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${
                          r.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : r.status === "quoted"
                              ? "bg-blue-100 text-blue-800"
                              : r.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.status.toUpperCase()}
                      </span>
                    </div>

                    {r.status === "pending" &&
                      (quotingId === r.id ? (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <Input
                            type="number"
                            placeholder="Price per bike (NPR)"
                            value={quoteForm.price}
                            onChange={(e) => setQuoteForm((f) => ({ ...f, price: e.target.value }))}
                          />
                          <Input
                            placeholder="Pickup location (optional)"
                            value={quoteForm.pickup}
                            onChange={(e) =>
                              setQuoteForm((f) => ({ ...f, pickup: e.target.value }))
                            }
                          />
                          <textarea
                            className="w-full border rounded-md p-2 text-sm"
                            placeholder="Note to customer (optional)"
                            value={quoteForm.notes}
                            onChange={(e) => setQuoteForm((f) => ({ ...f, notes: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90"
                              disabled={quoteMutation.isPending || !quoteForm.price}
                              onClick={() => quoteMutation.mutate(r.id)}
                            >
                              Send Quote
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setQuotingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            className="bg-primary hover:bg-primary/90"
                            onClick={() => setQuotingId(r.id)}
                          >
                            Send Quote
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={rejectMutation.isPending}
                            onClick={() => {
                              const reason = window.prompt("Reason for declining:");
                              if (reason && reason.trim()) {
                                rejectMutation.mutate({ requestId: r.id, reason: reason.trim() });
                              }
                            }}
                          >
                            Decline
                          </Button>
                        </div>
                      ))}

                    {r.status === "quoted" && (
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90"
                          disabled={markPaidMutation.isPending}
                          onClick={() => markPaidMutation.mutate(r.id)}
                        >
                          Mark as Paid
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
                {bulkRequests?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bulk requests yet.</p>
                )}
              </div>
            </Card>

            <Card className="p-5 border-0 shadow-sm space-y-3">
              <h2 className="font-semibold text-sm">Add a bike</h2>
              <Input
                placeholder="Bike name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <select
                className="w-full border rounded-md h-9 px-2 text-sm"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="manual">Manual</option>
                <option value="hybrid">Hybrid</option>
                <option value="electric">Electric</option>
              </select>
              <Input
                type="number"
                placeholder="Price per day (NPR)"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
              <div>
                <label className="text-xs text-muted-foreground">
                  How many of this bike do you have?
                </label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  placeholder="e.g. 3"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </div>
              <textarea
                className="w-full border rounded-md p-2 text-sm"
                placeholder="Short description (optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div>
                <label className="text-xs text-muted-foreground">Bike photo</label>
                <div className="flex items-center gap-3 mt-1">
                  {bikeImage && (
                    <img
                      src={bikeImage}
                      alt="Bike preview"
                      className="w-16 h-16 rounded-md object-cover border shrink-0"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBikeImageChange}
                    disabled={bikeImageUploading}
                    className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
                  />
                </div>
                {bikeImageUploading && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> Processing…
                  </p>
                )}
              </div>
              <Button
                className="bg-primary hover:bg-primary/90"
                disabled={mutation.isPending || !form.name || !form.price || bikeImageUploading}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Adding…" : "Add Bike"}
              </Button>
            </Card>

            <div>
              <h2 className="font-semibold text-sm mb-3">My Bikes</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bikes?.map((b) => (
                  <Card key={b.id} className="p-4 border-0 shadow-sm flex gap-3">
                    {b.image_url && (
                      <img
                        src={b.image_url}
                        alt={b.name}
                        className="w-16 h-16 rounded-md object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{b.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{b.type}</div>
                      <div className="text-sm font-bold text-primary mt-1">
                        NPR {Number(b.price_per_day).toFixed(0)}/day
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-xs text-muted-foreground">In stock:</label>
                        <Input
                          type="number"
                          min={0}
                          className="w-16 h-7 text-xs px-2"
                          value={b.quantity}
                          onChange={(e) => {
                            const q = Math.max(0, Number(e.target.value) || 0);
                            stockMutation.mutate({ ...b, quantity: q });
                          }}
                        />
                        {b.quantity <= 0 && (
                          <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            OUT OF STOCK
                          </span>
                        )}
                      </div>
                      {b.currently_rented > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {b.currently_rented} currently rented out
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
                {bikes?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bikes listed yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
