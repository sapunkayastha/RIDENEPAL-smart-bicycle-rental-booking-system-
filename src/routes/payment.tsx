import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, CheckCircle2, CreditCard, Wallet } from "lucide-react";
import bike1 from "@/assets/bike-1.jpg";

export const Route = createFileRoute("/payment")({
  component: Payment,
  head: () => ({ meta: [{ title: "Finalize Booking — RideNepal" }] }),
});

function Payment() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <p className="text-xs text-muted-foreground mb-2">STEP 3 OF 3</p>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Finalize Booking</h1>
        <p className="text-sm text-muted-foreground mb-8">Complete your secure checkout and prepare for your Himalayan adventure.</p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <Card className="p-6 border-0 shadow-sm">
              <h3 className="font-semibold mb-4">Rider Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground">Full Name</label><Input className="mt-1" placeholder="e.g. Aanya Sharma" /></div>
                <div><label className="text-xs text-muted-foreground">Email Address</label><Input className="mt-1" placeholder="aanya@ridenepal.com" /></div>
              </div>
            </Card>

            <Card className="p-6 border-0 shadow-sm">
              <h3 className="font-semibold mb-4">Payment Method</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button className="border-2 border-primary rounded-lg p-4 text-left bg-primary/5">
                  <Wallet className="size-5 text-primary mb-2" />
                  <div className="font-semibold text-sm">eSewa Wallet</div>
                  <div className="text-xs text-muted-foreground">Instant verification via OTP</div>
                </button>
                <button className="border rounded-lg p-4 text-left hover:border-primary transition-colors">
                  <Wallet className="size-5 text-primary mb-2" />
                  <div className="font-semibold text-sm">Khalti Pay</div>
                  <div className="text-xs text-muted-foreground">Pay with Khalti wallet</div>
                </button>
                <button className="border rounded-lg p-4 text-left hover:border-primary transition-colors">
                  <CreditCard className="size-5 text-primary mb-2" />
                  <div className="font-semibold text-sm">Card / Stripe</div>
                  <div className="text-xs text-muted-foreground">Visa, Mastercard, Amex</div>
                </button>
              </div>
            </Card>

            <Button size="lg" className="w-full bg-primary hover:bg-primary/90">Confirm & Pay NPR 24,500</Button>
            <p className="text-xs text-muted-foreground text-center">🔒 Payments are encrypted end-to-end.</p>
          </div>

          <aside className="space-y-5">
            <Card className="overflow-hidden border-0 shadow-sm">
              <div className="aspect-[16/10] bg-muted relative">
                <img src={bike1} alt="Royal Enfield Himalayan" className="w-full h-full object-cover" />
                <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] px-2 py-1 rounded-full font-semibold">TOP RATED</span>
              </div>
              <div className="p-5">
                <h4 className="font-bold">Royal Enfield Himalayan</h4>
                <p className="text-xs text-muted-foreground mt-1">Oct 12 – Oct 16, 2024 · Kathmandu Basecamp</p>
                <div className="mt-4 space-y-2 text-sm border-t pt-4">
                  <div className="flex justify-between"><span className="text-muted-foreground">Rental (4 days)</span><span>NPR 18,000</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Safety Kit</span><span>NPR 2,500</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><span>NPR 4,000</span></div>
                </div>
                <div className="flex justify-between font-bold mt-4 pt-4 border-t">
                  <span>Total Amount</span><span className="text-primary text-lg">NPR 24,500</span>
                </div>
              </div>
            </Card>

            <Card className="p-5 border-0 shadow-sm">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-3"><ShieldCheck className="size-4 text-primary" /> RideNepal Guarantee</h4>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle2 className="size-3 text-primary mt-0.5" /> Roadside Assistance available 24/7 across all trails</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="size-3 text-primary mt-0.5" /> Free Cancellation up to 48h before pickup</li>
              </ul>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
