import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listMyBookings } from "@/lib/bookings.functions";
import { Bike, MapPin, Calendar, Sparkles, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "My Dashboard — RIDENEPAL" }] }),
});

function Dashboard() {
  const fetchBookings = useServerFn(listMyBookings);
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["my-bookings"],
    queryFn: () => fetchBookings(),
  });

  const active = bookings?.find((b) => b.status === "paid" || b.status === "active");

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-1">Welcome back, rider</h1>
        <p className="text-muted-foreground mb-8">Manage your bookings and track your active ride.</p>

        {isLoading && <p className="text-sm text-muted-foreground">Loading your bookings…</p>}

        {active && (
          <Card className="p-6 mb-8 border-0 shadow-sm bg-primary/5">
            <div className="flex items-center gap-2 mb-3"><Sparkles className="size-4 text-primary" /><span className="text-xs font-semibold text-primary">ACTIVE RIDE</span></div>
            <h3 className="text-lg font-bold">{active.bikes?.name ?? "Bike"}</h3>
            <p className="text-sm text-muted-foreground mt-1">{active.pickup_location ?? "Pickup location"}</p>
            <div className="flex gap-3 mt-4">
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link to="/track/$bookingId" params={{ bookingId: active.id }}>
                  <MapPin className="size-4 mr-1" /> Live Track
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/extend/$bookingId" params={{ bookingId: active.id }}>
                  <Clock className="size-4 mr-1" /> Extend Rental
                </Link>
              </Button>
            </div>
          </Card>
        )}

        <h2 className="text-xl font-semibold mb-4">My Bookings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bookings?.length === 0 && (
            <Card className="p-8 col-span-full text-center border-0 shadow-sm">
              <Bike className="size-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No bookings yet. Pick a bike to start your first ride.</p>
              <Button asChild className="bg-primary hover:bg-primary/90"><Link to="/fleet" search={{ pickup: undefined, date: undefined }}>Browse Fleet</Link></Button>
            </Card>
          )}
          {bookings?.map((b) => (
            <Card key={b.id} className="p-5 border-0 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold">{b.bikes?.name ?? "Bike"}</h3>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${b.status === "paid" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{b.status.toUpperCase()}</span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="size-3" /> {new Date(b.start_date).toLocaleDateString()} → {new Date(b.end_date).toLocaleDateString()}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-primary">NPR {Number(b.total_amount).toFixed(0)}</span>
                {b.status === "pending" && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/checkout/$bookingId" params={{ bookingId: b.id }}>Pay Now</Link>
                  </Button>
                )}
                {(b.status === "paid" || b.status === "active") && (
                  <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                    <Link to="/track/$bookingId" params={{ bookingId: b.id }}>Track</Link>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
