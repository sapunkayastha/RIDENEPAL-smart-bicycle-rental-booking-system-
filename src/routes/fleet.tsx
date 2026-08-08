import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createBooking } from "@/lib/bookings.functions";
import bike1 from "@/assets/bike-1.jpg";
import bike2 from "@/assets/bike-2.jpg";
import bike3 from "@/assets/bike-3.jpg";
import { toast } from "sonner";

export const Route = createFileRoute("/fleet")({
  component: Fleet,
  validateSearch: (search: Record<string, unknown>) => ({
    pickup: typeof search.pickup === "string" ? search.pickup : undefined,
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Explore the Fleet — RIDENEPAL" },
      { name: "description", content: "Browse premium bicycles ready for your next Nepali expedition." },
    ],
  }),
});

const fallbackImgs = [bike1, bike2, bike3];

type Bike = {
  id: string; name: string; type: string;
  price_per_day: number | string; image_url: string | null;
  description: string | null; available: boolean;
};

function Fleet() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [pickup, setPickup] = useState(search.pickup ?? "Kathmandu");
  const [days, setDays] = useState(1);

  const { data: bikes, isLoading } = useQuery({
    queryKey: ["bikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bikes").select("*").eq("available", true)
        .order("price_per_day", { ascending: true });
      if (error) throw error;
      return data as Bike[];
    },
  });

  const book = useServerFn(createBooking);
  const bookingMutation = useMutation({
    mutationFn: async (bike: Bike) => {
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
      if (err instanceof Error && err.message.includes("sign in")) return;
      toast.error(err instanceof Error ? err.message : "Failed to book");
    },
  });

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        <aside className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 text-sm">Booking Options</h3>
            <label className="text-xs text-muted-foreground">Pickup location</label>
            <Input className="mt-1 mb-3" value={pickup} onChange={(e) => setPickup(e.target.value)} maxLength={100} />
            <label className="text-xs text-muted-foreground">Number of days</label>
            <Input className="mt-1" type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Bike Type</h4>
            <div className="space-y-2 text-sm">
              {["Electric","Mountain","Touring","City"].map(t => (
                <label key={t} className="flex items-center gap-2"><Checkbox /> {t}</label>
              ))}
            </div>
          </div>
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-2">
              <ShieldCheck className="size-4 text-primary mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold mb-1">Safety Guaranteed</div>
                <p className="text-muted-foreground">Every bike is inspected before rental.</p>
              </div>
            </div>
          </Card>
        </aside>

        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Explore the Fleet</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {bikes?.length ?? 0} pristine machines ready for your next expedition.
              </p>
            </div>
          </div>

          {isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading fleet…</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {bikes?.map((b, i) => {
              const img = b.image_url?.startsWith("/src/assets/") ? fallbackImgs[i % 3] : (b.image_url || fallbackImgs[i % 3]);
              const isPending = bookingMutation.isPending && bookingMutation.variables?.id === b.id;
              return (
                <Card key={b.id} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative aspect-[4/3] bg-muted">
                    <img src={img} alt={b.name} loading="lazy" className="w-full h-full object-cover" />
                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-full font-semibold uppercase">{b.type}</span>
                  </div>
                  <div className="p-4">
                    <Link to="/bike/$bikeId" params={{ bikeId: b.id }} className="font-semibold text-sm hover:text-primary">{b.name}</Link>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 mb-3">
                      <Star className="size-3 fill-current text-primary" /> 4.8 · {b.description?.slice(0, 40) ?? "Premium bike"}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-primary">NPR {Number(b.price_per_day).toFixed(0)}</span>
                        <span className="text-xs text-muted-foreground">/day</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/bike/$bikeId" params={{ bikeId: b.id }}>Details</Link>
                        </Button>
                        <Button onClick={() => bookingMutation.mutate(b)} disabled={isPending} size="sm" className="bg-primary hover:bg-primary/90">
                          {isPending ? "Booking…" : "Book Now"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
