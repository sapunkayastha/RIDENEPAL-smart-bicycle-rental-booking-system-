import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { postLocation, getRideTrack } from "@/lib/locations.functions";
import { getBooking } from "@/lib/bookings.functions";
import { MapPin, Radio, Pause, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/track/$bookingId")({
  component: TrackRide,
  head: () => ({ meta: [{ title: "Live Tracking — RIDENEPAL" }] }),
});

function TrackRide() {
  const { bookingId } = Route.useParams();
  const fetchBooking = useServerFn(getBooking);
  const fetchTrack = useServerFn(getRideTrack);
  const reportLocation = useServerFn(postLocation);

  const { data: booking } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => fetchBooking({ data: { id: bookingId } }),
  });

  const [tracking, setTracking] = useState(false);
  const [pings, setPings] = useState(0);

  // Poll for track history (replaces Supabase Realtime subscription)
  const { data: trackData } = useQuery({
    queryKey: ["ride-track", bookingId],
    queryFn: () => fetchTrack({ data: { booking_id: bookingId } }),
    refetchInterval: 5000,
  });

  const points = (trackData ?? []).map((r) => ({ lat: r.lat, lng: r.lng }));
  const latest = points.length > 0 ? points[points.length - 1] : null;

  // Geolocation watcher
  useEffect(() => {
    if (!tracking) return;
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not available on this device.");
      setTracking(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await reportLocation({
            data: {
              booking_id: bookingId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
          });
          setPings((n) => n + 1);
        } catch (e) {
          console.error(e);
        }
      },
      (err) => {
        toast.error(`GPS error: ${err.message}`);
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tracking, bookingId, reportLocation]);

  const center = latest ?? { lat: 27.7172, lng: 85.324 }; // Kathmandu
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - 0.02},${center.lat - 0.02},${center.lng + 0.02},${center.lat + 0.02}&layer=mapnik&marker=${center.lat},${center.lng}`;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Radio
                  className={`size-5 ${tracking ? "text-primary animate-pulse" : "text-muted-foreground"}`}
                />
                Live Tracking
              </h1>
              <p className="text-sm text-muted-foreground">
                {booking?.bikes?.name ?? "Loading bike…"}
              </p>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <span>{tracking ? "Sharing location" : "Tracking off"}</span>
              <Switch checked={tracking} onCheckedChange={setTracking} />
            </label>
          </div>

          <Card className="overflow-hidden border-0 shadow-sm">
            <iframe title="Live ride map" src={mapUrl} className="w-full aspect-[16/10] border-0" />
          </Card>

          <div className="grid grid-cols-3 gap-4 mt-5">
            <Card className="p-4 border-0 shadow-sm">
              <div className="text-xs text-muted-foreground">PINGS SENT</div>
              <div className="text-2xl font-bold mt-1">{pings}</div>
            </Card>
            <Card className="p-4 border-0 shadow-sm">
              <div className="text-xs text-muted-foreground">POINTS LOGGED</div>
              <div className="text-2xl font-bold mt-1">{points.length}</div>
            </Card>
            <Card className="p-4 border-0 shadow-sm">
              <div className="text-xs text-muted-foreground">CURRENT POS</div>
              <div className="text-xs font-mono mt-1">
                {latest ? `${latest.lat.toFixed(4)}, ${latest.lng.toFixed(4)}` : "—"}
              </div>
            </Card>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5 border-0 shadow-sm">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> Trip Control
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Toggle on to start sharing your location. Each ping is stored securely and only
              visible to you and staff.
            </p>
            <Button
              onClick={() => setTracking((t) => !t)}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {tracking ? (
                <>
                  <Pause className="size-4 mr-1" /> Stop Sharing
                </>
              ) : (
                <>
                  <Play className="size-4 mr-1" /> Start Sharing
                </>
              )}
            </Button>
            <Button asChild variant="outline" className="w-full mt-2">
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </Card>
          <Card className="p-5 border-0 shadow-sm bg-secondary/40">
            <h4 className="font-semibold text-sm">Recent path</h4>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground max-h-48 overflow-auto">
              {points
                .slice(-10)
                .reverse()
                .map((p, i) => (
                  <div key={i} className="font-mono">
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </div>
                ))}
              {points.length === 0 && <p>No pings yet — start sharing to log your route.</p>}
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
}
