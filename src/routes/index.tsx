import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Compass,
  LifeBuoy,
  MapPin,
  Calendar,
  Star,
  Facebook,
  Instagram,
  Twitter,
  Loader2,
  LocateFixed,
  Store,
  PackageX,
} from "lucide-react";
import { toast } from "sonner";
import { listVendorStorefronts } from "@/lib/vendor.functions";
import heroImg from "@/assets/hero-mountain.jpg";
import bike1 from "@/assets/bike-1.jpg";
import bike2 from "@/assets/bike-2.jpg";
import bike3 from "@/assets/bike-3.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RideNepal — Smart Bicycle Rental & Booking" },
      {
        name: "description",
        content:
          "Rent premium bikes anywhere, anytime. Smart booking, live GPS tracking, and rewards for every ride.",
      },
    ],
  }),
});

const fallbackImgs = [bike1, bike2, bike3];

const features = [
  {
    icon: Compass,
    title: "Discover Your Ride",
    desc: "Browse a curated fleet of premium bicycles ready for any trail or city street.",
  },
  {
    icon: Calendar,
    title: "Instant Booking",
    desc: "Reserve in seconds with OTP verification and secure online payments.",
  },
  {
    icon: LifeBuoy,
    title: "24/7 On-Trail Support",
    desc: "Live GPS tracking and roadside help, anywhere your adventure takes you.",
  },
];

const testimonials = [
  {
    name: "Sneha Shrestha",
    role: "Weekend Rider",
    quote:
      "Booking was effortless and the bike was in flawless condition. Made my mountain trip unforgettable.",
  },
  {
    name: "Aarav Giri",
    role: "City Commuter",
    quote: "I love the rewards program — every ride earns points I can redeem for discounts.",
  },
  {
    name: "Maya Karki",
    role: "Trail Explorer",
    quote: "Live tracking and 24/7 support gave me complete peace of mind on remote routes.",
  },
];

function Index() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("");
  const [date, setDate] = useState("");
  const [locating, setLocating] = useState(false);

  const fetchVendors = useServerFn(listVendorStorefronts);
  const { data: vendors, isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendor-storefronts"],
    queryFn: () => fetchVendors(),
  });

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation isn't supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`,
            { headers: { "Accept-Language": "en" } },
          );
          const data = await res.json();
          const addr = data.address ?? {};
          const place =
            addr.suburb ||
            addr.neighbourhood ||
            addr.village ||
            addr.town ||
            addr.city ||
            addr.county ||
            addr.state ||
            data.display_name ||
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          const region = addr.city || addr.town || addr.state;
          setPickup(region && region !== place ? `${place}, ${region}` : place);
          toast.success("Location detected");
        } catch {
          setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          toast.success("Location detected");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : `Couldn't get location: ${err.message}`,
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const findBike = () => {
    navigate({
      to: "/fleet",
      search: { pickup: pickup || undefined, date: date || undefined } as never,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <SiteHeader transparent />

      {/* Hero */}
      <section className="relative min-h-[640px] flex items-center">
        <img
          src={heroImg}
          alt="Cyclist riding through Himalayan mountains"
          className="absolute inset-0 w-full h-full object-cover"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-6 w-full pt-32 pb-24">
          <div className="max-w-2xl text-white">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
              Ride Anywhere
              <br />
              Anytime
            </h1>
            <p className="mt-5 text-lg text-white/85 max-w-lg">
              Premium bicycle rentals with smart booking, live tracking, and rewards for every
              kilometer.
            </p>
          </div>

          {/* Booking card */}
          <Card className="mt-10 p-4 md:p-5 bg-white/95 backdrop-blur shadow-2xl border-0 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-center">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <Input
                  className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                  placeholder="Pickup location"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                />
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locating}
                  title="Use my location"
                  aria-label="Use my location"
                  className="text-primary hover:text-primary/80 disabled:opacity-50 shrink-0"
                >
                  {locating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LocateFixed className="size-4" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-background">
                <Calendar className="size-4 text-muted-foreground" />
                <Input
                  className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                  placeholder="Date & time"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <Button size="lg" onClick={findBike} className="bg-primary hover:bg-primary/90">
                Find a Bike
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Fleet — shop by vendor */}
      <section id="fleet" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Shop by Vendor</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg">
                Every bike on RideNepal is listed by a local vendor. Pick a shop below to see
                their bikes, live stock, and pickup location.
              </p>
            </div>
            <Link
              to="/fleet"
              search={{ pickup: undefined, date: undefined, days: undefined }}
              className="text-sm text-primary hover:underline shrink-0"
            >
              View all bikes →
            </Link>
          </div>

          {vendorsLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading vendors…
            </div>
          )}

          {!vendorsLoading && (vendors?.length ?? 0) === 0 && (
            <Card className="p-10 border-0 shadow-sm text-center text-muted-foreground">
              No vendors have listed bikes yet — check back soon.
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {vendors?.slice(0, 4).map((v) => (
              <Card
                key={v.vendorId}
                className="overflow-hidden border-0 shadow-sm hover:shadow-lg transition-shadow p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Store className="size-4 text-primary" />
                      <h3 className="font-semibold">{v.businessName}</h3>
                    </div>
                    {v.location && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="size-3" /> {v.location}
                      </p>
                    )}
                  </div>
                  {v.reviewCount > 0 && (
                    <div className="flex items-center gap-1 text-xs shrink-0">
                      <Star className="size-3 fill-current text-primary" />
                      <span className="font-semibold">{v.avgRating?.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {v.bikes.slice(0, 3).map((b, i) => {
                    const img = b.image_url?.startsWith("/src/assets/")
                      ? fallbackImgs[i % 3]
                      : b.image_url || fallbackImgs[i % 3];
                    const inStock = b.available_stock > 0;
                    return (
                      <div key={b.id} className="relative aspect-square rounded-md overflow-hidden bg-muted">
                        <img
                          src={img}
                          alt={b.name}
                          loading="lazy"
                          className={`w-full h-full object-cover ${!inStock ? "grayscale opacity-60" : ""}`}
                        />
                        {!inStock && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <PackageX className="size-4 text-white" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {v.bikes.length === 0 && (
                    <div className="col-span-3 text-xs text-muted-foreground py-4 text-center">
                      No bikes listed yet
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {v.inStockCount} of {v.bikeCount} bike{v.bikeCount === 1 ? "" : "s"} in stock
                  </span>
                  <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                    <Link to="/vendor/$vendorId" params={{ vendorId: v.vendorId }}>
                      View Shop
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-secondary/40">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Experience Simplicity</h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            From discovery to drop-off, every step is built around the rider.
          </p>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {features.map((f) => (
              <div key={f.title}>
                <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="stories" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            The RideNepal Chronicles
          </h2>
          <p className="text-muted-foreground mb-10">
            Stories from riders who took the road less ridden.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="p-6 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{t.quote}"</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto rounded-2xl bg-primary text-primary-foreground p-12 md:p-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ready for your next adventure?
          </h2>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">
            Join thousands of riders exploring trails, cities, and mountains with RideNepal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link to="/fleet" search={{ pickup: undefined, date: undefined, days: undefined }}>
                Book Your First Ride
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/admin-login">Become a Partner</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t bg-background">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="font-extrabold text-lg mb-3 tracking-widest text-primary">
              RIDENEPAL
            </div>
            <p className="text-muted-foreground">Smart bicycle rentals for every adventure.</p>
          </div>
          <div>
            <div className="font-semibold mb-3">Company</div>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  Press
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-3">Support</div>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground">
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  Safety
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-3">Newsletter</div>
            <div className="flex gap-2">
              <Input placeholder="Your email" />
              <Button className="bg-primary hover:bg-primary/90">Join</Button>
            </div>
          </div>
        </div>
        <div className="border-t">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-muted-foreground">
            <span>© 2026 RideNepal. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#" aria-label="Facebook">
                <Facebook className="size-4" />
              </a>
              <a href="#" aria-label="Instagram">
                <Instagram className="size-4" />
              </a>
              <a href="#" aria-label="Twitter">
                <Twitter className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
