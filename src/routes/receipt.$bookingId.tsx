import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBooking } from "@/lib/bookings.functions";
import { CheckCircle2, MapPin, Phone, Store, Calendar, Loader2 } from "lucide-react";

export const Route = createFileRoute("/receipt/$bookingId")({
  component: Receipt,
  head: () => ({ meta: [{ title: "Booking Receipt — RIDENEPAL" }] }),
});

function Receipt() {
  const { bookingId } = Route.useParams();
  const fetchBooking = useServerFn(getBooking);
  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => fetchBooking({ data: { id: bookingId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <SiteHeader />
        <main className="max-w-md mx-auto px-6 py-16 text-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin mx-auto mb-3" />
          Loading receipt…
        </main>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <SiteHeader />
        <main className="max-w-md mx-auto px-6 py-16 text-center">
          <p className="text-muted-foreground">Receipt not found.</p>
        </main>
      </div>
    );
  }

  const pickupPoint = booking.vendor?.businessAddress || booking.pickup_location;

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-md mx-auto px-6 py-10">
        <div className="text-center mb-6">
          <CheckCircle2 className="size-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold mt-3">Booking Confirmed</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's your digital receipt.</p>
        </div>

        <Card className="p-6 border-0 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <div className="text-xs text-muted-foreground">Receipt #</div>
              <div className="font-mono text-xs">{booking.id}</div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-primary/15 text-primary uppercase">
              {booking.status}
            </span>
          </div>

          <div className="py-4 border-b">
            <div className="font-semibold">{booking.bikes.name}</div>
            <div className="text-xs text-muted-foreground capitalize">{booking.bikes.type}</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Calendar className="size-3.5" />
              {new Date(booking.start_date).toLocaleString()} —{" "}
              {new Date(booking.end_date).toLocaleString()}
            </div>
          </div>

          {booking.vendor ? (
            <div className="py-4 border-b">
              <div className="text-xs text-muted-foreground mb-1">Pick up your ride from</div>
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Store className="size-4 text-primary" /> {booking.vendor.businessName}
              </div>
              {pickupPoint && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground mt-1">
                  <MapPin className="size-4 shrink-0 mt-0.5" /> {pickupPoint}
                </div>
              )}
              {booking.vendor.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Phone className="size-4" /> {booking.vendor.phone}
                </div>
              )}
              {pickupPoint && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupPoint)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline mt-2 inline-block"
                >
                  View on map →
                </a>
              )}
            </div>
          ) : (
            pickupPoint && (
              <div className="py-4 border-b">
                <div className="text-xs text-muted-foreground mb-1">Pickup location</div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="size-4 shrink-0 mt-0.5 text-primary" /> {pickupPoint}
                </div>
              </div>
            )
          )}

          <div className="flex items-center justify-between pt-4">
            <span className="text-sm">Total paid</span>
            <span className="text-2xl font-bold text-primary">
              NPR {Number(booking.total_amount).toFixed(2)}
            </span>
          </div>
        </Card>

        <div className="flex flex-col gap-2 mt-6">
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link to="/track/$bookingId" params={{ bookingId }}>
              Start Live Tracking
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
