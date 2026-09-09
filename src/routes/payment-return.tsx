import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { verifyEsewaPayment, verifyKhaltiPayment } from "@/lib/payments.functions";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/payment-return")({
  component: PaymentReturn,
  head: () => ({ meta: [{ title: "Payment Status — RIDENEPAL" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    data: typeof search.data === "string" ? search.data : undefined,
    provider: typeof search.provider === "string" ? search.provider : undefined,
    pidx: typeof search.pidx === "string" ? search.pidx : undefined,
    purchase_order_id:
      typeof search.purchase_order_id === "string" ? search.purchase_order_id : undefined,
  }),
});

function PaymentReturn() {
  const search = Route.useSearch();
  const verify = useServerFn(verifyEsewaPayment);
  const verifyKhalti = useServerFn(verifyKhaltiPayment);
  const [state, setState] = useState<"loading" | "success" | "failed">("loading");
  const [bookingId, setBookingId] = useState<string | undefined>();

  useEffect(() => {
    if (search.pidx) {
      verifyKhalti({ data: { pidx: search.pidx } })
        .then((res) => {
          setBookingId(res.booking_id);
          setState(res.success ? "success" : "failed");
        })
        .catch(() => setState("failed"));
      return;
    }
    if (!search.data) {
      // No callback payload at all — the user likely cancelled before
      // completing payment on eSewa's side, so there's nothing to verify.
      setState("failed");
      return;
    }
    verify({ data: { encoded: search.data } })
      .then((res) => {
        setBookingId(res.booking_id);
        setState(res.success ? "success" : "failed");
      })
      .catch(() => setState("failed"));
  }, [search.data, search.pidx, verify, verifyKhalti]);

  const providerLabel = search.pidx ? "Khalti" : "eSewa";

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-md mx-auto px-6 py-16">
        <Card className="p-8 border-0 shadow-sm text-center">
          {state === "loading" && (
            <>
              <Loader2 className="size-12 text-primary mx-auto animate-spin" />
              <h1 className="text-2xl font-bold mt-4">Verifying payment…</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Hold on while we confirm with {providerLabel}.
              </p>
            </>
          )}
          {state === "success" && (
            <>
              <CheckCircle2 className="size-14 text-primary mx-auto" />
              <h1 className="text-2xl font-bold mt-4">Payment Successful</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Your booking is confirmed. Have a great ride!
              </p>
              <div className="flex flex-col gap-2 mt-6">
                {bookingId && (
                  <>
                    <Button asChild className="bg-primary hover:bg-primary/90">
                      <Link to="/receipt/$bookingId" params={{ bookingId }}>
                        View Digital Receipt
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/track/$bookingId" params={{ bookingId }}>
                        Start Live Tracking
                      </Link>
                    </Button>
                  </>
                )}
                <Button asChild variant="outline">
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              </div>
            </>
          )}
          {state === "failed" && (
            <>
              <XCircle className="size-14 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold mt-4">Payment Failed</h1>
              <p className="text-sm text-muted-foreground mt-2">
                We couldn't confirm your payment. You can try again.
              </p>
              <Button asChild className="mt-6 bg-primary hover:bg-primary/90">
                <Link to="/dashboard">Back to Dashboard</Link>
              </Button>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
