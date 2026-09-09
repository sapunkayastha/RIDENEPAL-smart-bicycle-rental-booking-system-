import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getVendorFullDetails } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/_admin/vendor-detail/$vendorId")({
  component: VendorDetail,
  head: () => ({ meta: [{ title: "Vendor Details — RIDENEPAL" }] }),
});

type Bike = {
  id: string;
  name: string;
  type: string;
  price_per_day: number;
  quantity: number;
  available: number;
  currently_rented: number;
};

type Booking = {
  id: string;
  status: string;
  total_amount: number;
  platform_commission: number;
  vendor_payout: number;
  created_at: string;
  bike_name: string;
};

function VendorDetail() {
  const { vendorId } = Route.useParams();
  const fetchDetails = useServerFn(getVendorFullDetails);
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-full-details", vendorId],
    queryFn: () => fetchDetails({ data: { vendorId } }),
  });

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <Link
          to="/commissions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to commissions
        </Link>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {data && (
          <>
            <Card className="p-5 border-0 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold">{data.profile.business_name}</h1>
                  <p className="text-sm text-muted-foreground">
                    {data.profile.full_name} · {data.profile.email}
                    {data.profile.phone ? ` · ${data.profile.phone}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${
                    data.profile.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : data.profile.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {data.profile.status.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">PAN number</div>
                  <div>{data.profile.pan_number}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">VAT number</div>
                  <div>{data.profile.vat_number || "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Business address</div>
                  <div>{data.profile.business_address || "—"}</div>
                </div>
              </div>
              {data.profile.id_document && (
                <div className="mt-4">
                  <div className="text-xs text-muted-foreground mb-2">ID on file</div>
                  <a href={data.profile.id_document} target="_blank" rel="noreferrer">
                    <img
                      src={data.profile.id_document}
                      alt="Vendor ID"
                      className="w-40 h-28 rounded-md object-cover border"
                    />
                  </a>
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-5 border-0 shadow-sm">
                <div className="text-xs text-muted-foreground">Total earned (this vendor)</div>
                <div className="text-2xl font-bold text-primary mt-1">
                  NPR {Number(data.earnings.total_earned).toFixed(0)}
                </div>
              </Card>
              <Card className="p-5 border-0 shadow-sm">
                <div className="text-xs text-muted-foreground">Paid bookings</div>
                <div className="text-2xl font-bold mt-1">{data.earnings.paid_bookings}</div>
              </Card>
            </div>

            <Card className="p-5 border-0 shadow-sm">
              <h2 className="font-semibold text-sm mb-3">Inventory</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(data.bikes as Bike[]).map((b) => (
                  <div key={b.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{b.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{b.type}</div>
                    <div className="text-sm font-bold text-primary mt-1">
                      NPR {Number(b.price_per_day).toFixed(0)}/day
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {b.quantity} in stock
                      {b.currently_rented > 0 ? ` · ${b.currently_rented} rented out` : ""}
                    </div>
                  </div>
                ))}
                {data.bikes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bikes listed.</p>
                )}
              </div>
            </Card>

            <Card className="p-5 border-0 shadow-sm">
              <h2 className="font-semibold text-sm mb-3">Booking history</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-4">Bike</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Total</th>
                      <th className="py-2 pr-4 text-right">Platform fee</th>
                      <th className="py-2 pr-4 text-right">Vendor payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.bookings as Booking[]).map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{b.bike_name}</td>
                        <td className="py-2 pr-4 capitalize text-muted-foreground">{b.status}</td>
                        <td className="py-2 pr-4 text-right">
                          NPR {Number(b.total_amount).toFixed(0)}
                        </td>
                        <td className="py-2 pr-4 text-right text-muted-foreground">
                          {b.platform_commission != null
                            ? `NPR ${Number(b.platform_commission).toFixed(0)}`
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold text-primary">
                          {b.vendor_payout != null
                            ? `NPR ${Number(b.vendor_payout).toFixed(0)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.bookings.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">No bookings yet.</p>
                )}
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
