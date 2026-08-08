import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBooking } from "@/lib/bookings.functions";
import { initEsewaPayment, initKhaltiPayment } from "@/lib/payments.functions";
import { Wallet, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/checkout/$bookingId")({
  component: Checkout,
  head: () => ({ meta: [{ title: "Pay with eSewa or Khalti — RIDENEPAL" }] }),
});

type Provider = "esewa" | "khalti";

function Checkout() {
  const { bookingId } = Route.useParams();
  const fetchBooking = useServerFn(getBooking);
  const initEsewa = useServerFn(initEsewaPayment);
  const initKhalti = useServerFn(initKhaltiPayment);
  const [paying, setPaying] = useState(false);
  const [provider, setProvider] = useState<Provider>("esewa");

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => fetchBooking({ data: { id: bookingId } }),
  });

  async function pay() {
    if (!booking) return;
    setPaying(true);
    try {
      if (provider === "khalti") {
        const { payment_url } = await initKhalti({ data: { booking_id: bookingId } });
        // Break out of the preview iframe so the provider page isn't blocked.
        window.top!.location.href = payment_url;
        return;
      }
      const { action, fields } = await initEsewa({
        data: { booking_id: bookingId },
      });
      // Build and auto-submit a hidden form to eSewa
      const form = document.createElement("form");
      form.method = "POST";
      form.action = action;
      form.target = "_top";
      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type = "hidden"; input.name = k; input.value = String(v);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start payment");
      setPaying(false);
    }
  }


  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-xs text-muted-foreground mb-2">SECURE CHECKOUT</p>
        <h1 className="text-3xl font-bold mb-6">Complete your booking</h1>

        {isLoading && <p className="text-sm text-muted-foreground">Loading booking…</p>}

        {booking && (
          <Card className="p-6 border-0 shadow-sm mb-6">
            <h3 className="font-semibold mb-3">{booking.bikes?.name}</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>From: {new Date(booking.start_date).toLocaleString()}</p>
              <p>To: {new Date(booking.end_date).toLocaleString()}</p>
              {booking.pickup_location && <p>Pickup: {booking.pickup_location}</p>}
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <span className="text-sm">Total amount</span>
              <span className="text-2xl font-bold text-primary">NPR {Number(booking.total_amount).toFixed(2)}</span>
            </div>
          </Card>
        )}

        <Card className="p-6 border-0 shadow-sm mb-6">
          <h3 className="font-semibold mb-4">Payment method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { id: "esewa" as Provider, label: "eSewa (Sandbox)", desc: "Wallet · OTP verification" },
              { id: "khalti" as Provider, label: "Khalti (Sandbox)", desc: "Wallet · Khalti hosted checkout" },
            ]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={provider === opt.id}
                onClick={() => setProvider(opt.id)}
                className={`rounded-lg p-4 text-left transition ${provider === opt.id ? "border-2 border-primary bg-primary/5" : "border border-border hover:border-primary/60"}`}
              >
                <Wallet className="size-5 text-primary mb-2" />
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {provider === "esewa" ? (
              <>Test wallet: eSewa UAT account <span className="font-mono">9806800001 / Nepal@123</span>, OTP <span className="font-mono">123456</span>.</>
            ) : (
              <>Test wallet: Khalti sandbox <span className="font-mono">9800000000</span>, MPIN <span className="font-mono">1111</span>, OTP <span className="font-mono">987654</span>.</>
            )}
          </p>
        </Card>


        <Card className="p-5 border-0 shadow-sm bg-secondary/40">
          <h4 className="font-semibold text-sm flex items-center gap-2 mb-2"><ShieldCheck className="size-4 text-primary" /> RIDENEPAL Guarantee</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-start gap-2"><CheckCircle2 className="size-3 text-primary mt-0.5" /> 24/7 trail-side assistance</li>
            <li className="flex items-start gap-2"><CheckCircle2 className="size-3 text-primary mt-0.5" /> Free cancellation up to 48 hours before pickup</li>
          </ul>
        </Card>

        <div className="mt-6 text-center">
          <Button asChild variant="ghost"><Link to="/dashboard">Cancel and return</Link></Button>
        </div>

        <Button disabled={paying} onClick={pay} className="w-full mt-6 bg-primary hover:bg-primary/90" size="lg">
          {paying ? `Redirecting to ${provider === "esewa" ? "eSewa" : "Khalti"}…` : `Pay NPR ${booking ? Number(booking.total_amount).toFixed(2) : "—"}`}

        </Button>
      </main>
    </div>
  );
}
