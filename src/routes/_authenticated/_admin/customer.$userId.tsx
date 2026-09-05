import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getCustomerDetails } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/_admin/customer/$userId")({
  component: CustomerDetail,
  head: () => ({ meta: [{ title: "Customer Details — RIDENEPAL" }] }),
});

type Booking = {
  id: string;
  status: string;
  total_amount: number;
  start_date: string;
  end_date: string;
  created_at: string;
  bike_name: string;
  renter_full_name: string | null;
  renter_address: string | null;
  renter_phone: string | null;
  citizenship_number: string | null;
  citizenship_front_image: string | null;
  citizenship_back_image: string | null;
};

function CustomerDetail() {
  const { userId } = Route.useParams();
  const fetchDetails = useServerFn(getCustomerDetails);
  const { data, isLoading } = useQuery({
    queryKey: ["customer-details", userId],
    queryFn: () => fetchDetails({ data: { userId } }),
  });

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to admin console
        </Link>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {data && (
          <>
            <Card className="p-5 border-0 shadow-sm">
              <h1 className="text-xl font-bold">{data.user.full_name || "—"}</h1>
              <p className="text-sm text-muted-foreground">{data.user.email}</p>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div>{data.user.phone || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Address</div>
                  <div>{data.user.address || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Citizenship number</div>
                  <div>{data.user.citizenship_number || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Roles</div>
                  <div className="capitalize">{data.roles.join(", ") || "customer"}</div>
                </div>
              </div>

              {(data.user.citizenship_front_image || data.user.citizenship_back_image) && (
                <div className="mt-5">
                  <div className="text-xs text-muted-foreground mb-2">
                    Citizenship ID on file (most recent)
                  </div>
                  <div className="flex gap-3">
                    {data.user.citizenship_front_image && (
                      <a href={data.user.citizenship_front_image} target="_blank" rel="noreferrer">
                        <img
                          src={data.user.citizenship_front_image}
                          alt="Citizenship front"
                          className="w-40 h-28 rounded-md object-cover border"
                        />
                      </a>
                    )}
                    {data.user.citizenship_back_image && (
                      <a href={data.user.citizenship_back_image} target="_blank" rel="noreferrer">
                        <img
                          src={data.user.citizenship_back_image}
                          alt="Citizenship back"
                          className="w-40 h-28 rounded-md object-cover border"
                        />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <div>
              <h2 className="font-semibold text-sm mb-3">Booking history</h2>
              <div className="space-y-3">
                {(data.bookings as Booking[]).map((b) => (
                  <Card key={b.id} className="p-4 border-0 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{b.bike_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(b.start_date).toLocaleDateString()} –{" "}
                          {new Date(b.end_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">
                          NPR {Number(b.total_amount).toFixed(0)}
                        </div>
                        <div className="text-[10px] uppercase text-muted-foreground">
                          {b.status}
                        </div>
                      </div>
                    </div>
                    {(b.citizenship_front_image || b.citizenship_back_image) && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-xs text-muted-foreground mb-2">
                          Submitted with this booking — {b.renter_full_name} · {b.renter_phone}
                          {b.citizenship_number ? ` · ${b.citizenship_number}` : ""}
                        </div>
                        <div className="flex gap-2">
                          {b.citizenship_front_image && (
                            <a href={b.citizenship_front_image} target="_blank" rel="noreferrer">
                              <img
                                src={b.citizenship_front_image}
                                alt="ID front for this booking"
                                className="w-28 h-20 rounded-md object-cover border"
                              />
                            </a>
                          )}
                          {b.citizenship_back_image && (
                            <a href={b.citizenship_back_image} target="_blank" rel="noreferrer">
                              <img
                                src={b.citizenship_back_image}
                                alt="ID back for this booking"
                                className="w-28 h-20 rounded-md object-cover border"
                              />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
                {data.bookings.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
