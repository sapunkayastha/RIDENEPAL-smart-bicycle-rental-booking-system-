import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBooking } from "@/lib/bookings.functions";
import { requestExtension, initExtensionPayment } from "@/lib/payments.functions";
import { Clock, Wallet, Lock, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/extend/$bookingId")({
  component: ExtendRental,
  head: () => ({ meta: [{ title: "Extend Your Rental — RIDENEPAL" }] }),
});

type Provider = "esewa" | "khalti";

function ExtendRental() {
  const { bookingId } = Route.useParams();
  const fetchBooking = useServerFn(getBooking);
  const createExtension = useServerFn(requestExtension);
  const initPayment = useServerFn(initExtensionPayment);

  const [hours, setHours] = useState(2);
  const [provider, setProvider] = useState<Provider>("esewa");
  const [submitting, setSubmitting] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => fetchBooking({ data: { id: bookingId } }),
  });

  const hourlyRate = booking ? Number(booking.total_amount) / Math.max(1, hoursBetween(booking.start_date, booking.end_date)) : 0;
  const estimatedTotal = hourlyRate * hours;

  async function extend() {
    if (!booking) return;
    setSubmitting(true);
    try {
      const extension = await createExtension({ data: { booking_id: bookingId, hours } });
      const result = await initPayment({ data: { extension_id: extension.id, provider } });

      if (result.provider === "khalti") {
        window.top!.location.href = result.payment_url;
        return;
      }
      const form = document.createElement("form");
      form.method = "POST";
      form.action = result.action;
      form.target = "_top";
      Object.entries(result.fields).forEach(([k, v]) => {
        const input = document.createElement("input");
        input.type = "hidden"; input.name = k; input.value = String(v);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start extension payment");
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin mx-auto mb-3" /> Loading booking…
        </main>
      </div>
    );
  }

  if (!booking || (booking.status !== "paid" && booking.status !== "active")) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <SiteHeader />
        <main className="max-w-lg mx-auto px-6 py-20">
          <Card className="p-10 border-0 shadow-sm text-center">
            <h1 className="text-2xl font-bold">Can't extend this booking</h1>
            <p className="text-muted-foreground mt-2">Only paid or active bookings can be extended.</p>
            <Button asChild className="mt-6 bg-primary hover:bg-primary/90"><Link to="/dashboard">Back to Dashboard</Link></Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Extend Your Rental</h1>
        <p className="text-muted-foreground mt-1 mb-8">
          Add more time on {(booking as any).bikes?.name ?? "your bike"}. Extension activates instantly after payment is confirmed.
        </p>

        <Card className="p-5 border-0 shadow-sm bg-primary/5 border-l-4 border-l-primary mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-primary mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">Payment required</div>
              <p className="text-muted-foreground">Time extension is only granted once payment via eSewa or Khalti is confirmed.</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-sm mb-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4"><Clock className="size-4 text-primary" /> Additional Time</h3>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 4, 8].map((h) => (
              <button key={h} onClick={() => setHours(h)}
                className={`border-2 rounded-lg py-3 text-sm font-semibold transition-colors ${hours === h ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"}`}>
                +{h}h
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-5 pt-5 border-t text-sm">
            <span className="text-muted-foreground">Rate</span><span>NPR {hourlyRate.toFixed(0)}/hour</span>
          </div>
          <div className="flex justify-between font-bold text-lg mt-2">
            <span>Estimated total</span><span className="text-primary">NPR {estimatedTotal.toFixed(0)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Final amount is calculated and locked server-side when you confirm.</p>
        </Card>

        <Card className="p-6 border-0 shadow-sm mb-6">
          <h3 className="font-semibold mb-4">Payment Method</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {([
              { id: "esewa", label: "eSewa", desc: "Wallet · OTP" },
              { id: "khalti", label: "Khalti", desc: "Wallet · QR" },
            ] as const).map((m) => (
              <button key={m.id} onClick={() => setProvider(m.id)}
                className={`border-2 rounded-lg p-4 text-left transition-colors ${provider === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Wallet className="size-5 text-primary mb-2" />
                <div className="font-semibold text-sm">{m.label}</div>
                <div className="text-xs text-muted-foreground">{m.desc}</div>
              </button>
            ))}
          </div>
        </Card>

        <Button size="lg" onClick={extend} disabled={submitting} className="w-full bg-primary hover:bg-primary/90">
          <Lock className="size-4" /> {submitting ? "Redirecting to payment…" : `Pay NPR ${estimatedTotal.toFixed(0)} & Extend`}
        </Button>
      </main>
    </div>
  );
}

function hoursBetween(start: string, end: string) {
  return Math.max(1, (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000);
}
