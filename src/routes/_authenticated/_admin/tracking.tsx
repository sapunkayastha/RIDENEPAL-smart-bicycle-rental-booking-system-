import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { getActiveRideLocations } from "@/lib/locations.functions";
import { Radio, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/tracking")({
  component: AdminTracking,
  head: () => ({
    meta: [{ title: "Live Bike Tracking — RIDENEPAL" }],
  }),
});

// Loaded lazily, client-side only, since Leaflet touches `window` on
// import and would crash server-side rendering / route crawling otherwise.
const LiveTrackingMap = lazy(() => import("@/components/admin/LiveTrackingMap"));

function AdminTracking() {
  const fetchActive = useServerFn(getActiveRideLocations);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-active-locations"],
    queryFn: () => fetchActive(),
    refetchInterval: 10000,
  });

  const rides = data ?? [];
  const center: [number, number] =
    rides.length > 0 ? [rides[0].lat, rides[0].lng] : [27.7172, 85.324]; // Kathmandu fallback

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Radio className="size-5 text-primary animate-pulse" />
            <h1 className="text-3xl font-bold">Live Bike Tracking</h1>
          </div>
          <Link to="/admin" className="text-sm font-medium text-primary hover:underline">
            ← Back to Admin Console
          </Link>
        </div>
        <p className="text-muted-foreground mb-6">
          Real-time locations for all currently active bookings. Updates every 10 seconds.
        </p>

        <Card className="p-4 border-0 shadow-sm mb-6 flex items-center gap-2">
          <MapPin className="size-4 text-primary" />
          <span className="text-sm font-medium">{rides.length} bike(s) currently active</span>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm">
          {isLoading || !mounted ? (
            <div className="h-[600px] flex items-center justify-center text-muted-foreground text-sm">
              Loading map…
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="h-[600px] flex items-center justify-center text-muted-foreground text-sm">
                  Loading map…
                </div>
              }
            >
              <LiveTrackingMap rides={rides} center={center} />
            </Suspense>
          )}
        </Card>

        {rides.length === 0 && !isLoading && mounted && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            No active bookings right now — the map will populate once a customer starts tracking a
            ride.
          </p>
        )}
      </main>
    </div>
  );
}
