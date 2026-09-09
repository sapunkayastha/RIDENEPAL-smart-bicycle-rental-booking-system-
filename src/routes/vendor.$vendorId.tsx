import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, ArrowLeft, Loader2, PackageX } from "lucide-react";
import { getVendorStorefront } from "@/lib/vendor.functions";
import bike1 from "@/assets/bike-1.jpg";
import bike2 from "@/assets/bike-2.jpg";
import bike3 from "@/assets/bike-3.jpg";

export const Route = createFileRoute("/vendor/$vendorId")({
  component: VendorStorefront,
  head: () => ({ meta: [{ title: "Vendor Shop — RIDENEPAL" }] }),
});

const fallbackImgs = [bike1, bike2, bike3];

function VendorStorefront() {
  const { vendorId } = Route.useParams();
  const fetchStorefront = useServerFn(getVendorStorefront);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor-storefront", vendorId],
    queryFn: async () => {
      try {
        return await fetchStorefront({ data: { vendorId } });
      } catch {
        return null;
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-7xl mx-auto px-6 py-20 text-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin mx-auto mb-3" />
          Loading vendor…
        </main>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-2">Vendor not found</h1>
          <p className="text-muted-foreground mb-6">
            This vendor may no longer be active on RideNepal.
          </p>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link to="/fleet" search={{ pickup: undefined, date: undefined, days: undefined }}>
              Browse the fleet
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <Link
          to="/fleet"
          search={{ pickup: undefined, date: undefined, days: undefined }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-3.5" /> Back to all vendors
        </Link>

        <Card className="p-6 border-0 shadow-sm mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {vendor.businessName}
            </h1>
            {vendor.location && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="size-3.5" /> {vendor.location}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {vendor.reviewCount > 0 ? (
              <div className="flex items-center gap-1 text-sm">
                <Star className="size-4 fill-current text-primary" />
                <span className="font-semibold">{vendor.avgRating?.toFixed(1)}</span>
                <span className="text-muted-foreground">({vendor.reviewCount} reviews)</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No reviews yet</span>
            )}
            <span className="text-xs font-semibold bg-primary/15 text-primary px-3 py-1.5 rounded-full">
              {vendor.bikes.length} bike{vendor.bikes.length === 1 ? "" : "s"} listed
            </span>
          </div>
        </Card>

        {vendor.bikes.length === 0 ? (
          <Card className="p-10 border-0 shadow-sm text-center text-muted-foreground">
            This vendor hasn't listed any bikes yet — check back soon.
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {vendor.bikes.map((b, i) => {
              const img = b.image_url?.startsWith("/src/assets/")
                ? fallbackImgs[i % 3]
                : b.image_url || fallbackImgs[i % 3];
              const inStock = b.available_stock > 0;
              return (
                <Card
                  key={b.id}
                  className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-[4/3] bg-muted">
                    <img
                      src={img}
                      alt={b.name}
                      loading="lazy"
                      className={`w-full h-full object-cover ${!inStock ? "grayscale opacity-70" : ""}`}
                    />
                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-full font-semibold uppercase">
                      {b.type}
                    </span>
                    {!inStock && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-xs font-semibold py-1.5 text-center flex items-center justify-center gap-1">
                        <PackageX className="size-3.5" /> Out of Stock
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <Link
                      to="/bike/$bikeId"
                      params={{ bikeId: b.id }}
                      search={{ date: undefined, days: undefined }}
                      className="font-semibold text-sm hover:text-primary"
                    >
                      {b.name}
                    </Link>
                    <div className="mt-1 mb-3">
                      {inStock ? (
                        <span className="text-xs font-medium text-green-700">
                          {b.available_stock} of {b.stock_quantity} available
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-destructive">
                          Out of stock — all {b.stock_quantity} units booked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-primary">
                          NPR {Number(b.price_per_day).toFixed(0)}
                        </span>
                        <span className="text-xs text-muted-foreground">/day</span>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        disabled={!inStock}
                        className="bg-primary hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Link
                          to="/bike/$bikeId"
                          params={{ bikeId: b.id }}
                          search={{ date: undefined, days: undefined }}
                        >
                          {inStock ? "Book Now" : "Sold Out"}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
