import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Sparkles,
  Zap,
  Gauge,
  Weight,
  Battery,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createBooking } from "@/lib/bookings.functions";
import { toast } from "sonner";
import bike1 from "@/assets/bike-1.jpg";
import bike2 from "@/assets/bike-2.jpg";
import bike3 from "@/assets/bike-3.jpg";

export const Route = createFileRoute("/bike/$bikeId")({
  component: BikeDetail,
  head: () => ({ meta: [{ title: "Bike Details — RIDENEPAL" }] }),
});

const fallbackImgs = [bike1, bike2, bike3];

type BikeRow = {
  id: string;
  name: string;
  type: string;
  price_per_day: number | string;
  image_url: string | null;
  description: string | null;
  available: boolean;
  specs: Record<string, string | number | null> | null;
};

const durationOptions = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

function BikeDetail() {
  const { bikeId } = Route.useParams();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("Kathmandu");
  const [days, setDays] = useState(1);

  const { data: bike, isLoading } = useQuery({
    queryKey: ["bike", bikeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bikes")
        .select("*")
        .eq("id", bikeId)
        .maybeSingle();
      if (error) throw error;
      return data as BikeRow | null;
    },
  });

  const book = useServerFn(createBooking);
  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!bike) throw new Error("Bike not loaded");
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        navigate({ to: "/auth" });
        throw new Error("Please sign in to book");
      }
      const start = new Date();
      const end = new Date(start.getTime() + days * 24 * 3600 * 1000);
      return book({
        data: {
          bike_id: bike.id,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          pickup_location: pickup,
        },
      });
    },
    onSuccess: (booking) => {
      toast.success("Booking created!");
      navigate({ to: "/checkout/$bookingId", params: { bookingId: booking.id } });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not create booking");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-7xl mx-auto px-6 py-20 text-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin mx-auto mb-3" />
          Loading bike…
        </main>
      </div>
    );
  }

  if (!bike) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-2">Bike not found</h1>
          <p className="text-muted-foreground mb-6">This bike may no longer be available.</p>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link to="/fleet" search={{ pickup: undefined, date: undefined }}>
              Browse the fleet
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const specs = bike.specs ?? {};
  const img =
    bike.image_url?.startsWith("/src/assets/") || !bike.image_url
      ? fallbackImgs[0]
      : bike.image_url;
  const total = Number(bike.price_per_day) * days;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <div>
          <Link
            to="/fleet"
            search={{ pickup: undefined, date: undefined }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="size-3.5" /> Back to fleet
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-3xl font-bold text-primary">{bike.name}</h1>
            <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-1 rounded-full uppercase">
              {bike.type}
            </span>
            {!bike.available && (
              <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-1 rounded-full">
                Currently unavailable
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 aspect-[4/3] rounded-lg overflow-hidden bg-muted">
              <img src={img} alt={bike.name} className="w-full h-full object-cover" />
            </div>
            <div className="grid grid-rows-2 gap-3">
              <div className="rounded-lg overflow-hidden bg-muted">
                <img src={fallbackImgs[1]} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="rounded-lg overflow-hidden bg-muted">
                <img src={fallbackImgs[2]} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {bike.description && <p className="text-muted-foreground mt-6">{bike.description}</p>}

          <Card className="p-5 mt-6 border-0 shadow-sm">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Sparkles className="size-4 text-primary" /> Specs
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Battery className="size-3" /> MOTOR
                </div>
                <div className="font-bold mt-1">{String(specs.motor_power ?? "—")}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Zap className="size-3" /> RANGE
                </div>
                <div className="font-bold mt-1">
                  {specs.range_km != null ? `${specs.range_km}km Avg` : "—"}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Gauge className="size-3" /> GEARS
                </div>
                <div className="font-bold mt-1">{String(specs.gears ?? "—")}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Weight className="size-3" /> WEIGHT
                </div>
                <div className="font-bold mt-1">
                  {specs.weight_kg != null ? `${specs.weight_kg} kg` : "—"}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right booking column */}
        <aside className="space-y-5">
          <Card className="p-5 border-0 shadow-sm">
            <h3 className="font-semibold mb-4">Book This Bike</h3>
            <label className="text-xs text-muted-foreground">PICKUP LOCATION</label>
            <input
              className="w-full border rounded-md px-3 py-2 mt-1 mb-3 text-sm bg-background"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
            />
            <label className="text-xs text-muted-foreground">DURATION</label>
            <select
              className="w-full border rounded-md px-3 py-2 mt-1 mb-4 text-sm bg-background"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {durationOptions.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-between text-sm py-3 border-t border-b">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> Safety Kit
              </div>
              <span className="text-xs text-muted-foreground">Included</span>
            </div>
            <div className="flex items-center justify-between mt-4 mb-4">
              <span className="text-sm">Total Estimate</span>
              <span className="text-2xl font-bold text-primary">NPR {total.toFixed(0)}</span>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!bike.available || bookingMutation.isPending}
              onClick={() => bookingMutation.mutate()}
            >
              {bookingMutation.isPending ? "Booking…" : "Confirm Booking"}
            </Button>
          </Card>

          <Card className="p-5 border-0 shadow-sm bg-secondary/50">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-4 text-primary" />
              <span className="font-semibold text-sm">Need help deciding?</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Ask our AI trail assistant about routes, terrain, or what to pack — look for the chat
              bubble in the bottom corner.
            </p>
          </Card>
        </aside>
      </main>
    </div>
  );
}
