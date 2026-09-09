import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/hooks/use-auth";
import { getBike } from "@/lib/bikes.functions";
import { createBooking } from "@/lib/bookings.functions";
import { myRole } from "@/lib/auth.functions";
import { getMyProfile } from "@/lib/profile.functions";
import { toast } from "sonner";
import bike1 from "@/assets/bike-1.jpg";
import bike2 from "@/assets/bike-2.jpg";
import bike3 from "@/assets/bike-3.jpg";

export const Route = createFileRoute("/bike/$bikeId")({
  component: BikeDetail,
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === "string" ? search.date : undefined,
    days: typeof search.days === "number" ? search.days : undefined,
  }),
  head: () => ({ meta: [{ title: "Bike Details — RIDENEPAL" }] }),
});

export const PICKUP_LOCATIONS = [
  {
    id: "wheel-of-life",
    name: "Wheel of Life MTB Shop",
    address: "Paknajol Marg, Kathmandu 44600",
    lat: 27.7141765,
    lng: 85.2729905,
  },
] as const;

export function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const fallbackImgs = [bike1, bike2, bike3];

type BikeRow = {
  id: string;
  name: string;
  type: string;
  price_per_day: number | string;
  image_url: string | null;
  description: string | null;
  available: number | boolean;
  quantity: number;
  specs: Record<string, string | number | null> | null;
  vendor_name?: string | null;
};

const durationOptions = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

// Same in-browser compression already used for vendor ID uploads and
// bike photos — no separate file storage, just a base64 data URL.
function resizeImageToDataUrl(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (dataUrl: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      onChange(await resizeImageToDataUrl(file));
    } catch {
      toast.error("Could not process that image, try a different file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-3 mt-1">
        {value && (
          <img
            src={value}
            alt={label}
            className="w-16 h-12 rounded-md object-cover border shrink-0"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleChange}
          disabled={uploading}
          className="text-xs file:mr-2 file:px-2.5 file:py-1 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-[11px] file:font-medium file:cursor-pointer cursor-pointer"
        />
      </div>
      {uploading && (
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" /> Processing…
        </p>
      )}
    </div>
  );
}

function BikeDetail() {
  const { bikeId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pickupId, setPickupId] = useState<string>(PICKUP_LOCATIONS[0].id);
  const pickupLocation = PICKUP_LOCATIONS.find((l) => l.id === pickupId) ?? PICKUP_LOCATIONS[0];
  const [days, setDays] = useState(search.days ?? 1);
  const [startDate, setStartDate] = useState(search.date ?? new Date().toISOString().slice(0, 16));

  const [showAgreement, setShowAgreement] = useState(false);
  const [agreement, setAgreement] = useState({
    fullName: "",
    address: "",
    phone: "",
    citizenshipNumber: "",
  });
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  const fetchMyRole = useServerFn(myRole);
  const { data: roleData } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchMyRole(),
    enabled: !!user,
    retry: false,
    throwOnError: false,
  });
  const isStaff = roleData?.isStaff ?? false;

  const fetchMyProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["my-profile-for-booking"],
    queryFn: () => fetchMyProfile(),
    enabled: !!user,
    retry: false,
    throwOnError: false,
  });

  // Pre-fill the rental agreement from whatever the customer saved on
  // a previous booking — they shouldn't have to re-type or re-upload
  // the same details every time.
  useEffect(() => {
    if (!profile) return;
    setAgreement((a) => ({
      fullName: a.fullName || profile.full_name || "",
      address: a.address || profile.address || "",
      phone: a.phone || profile.phone || "",
      citizenshipNumber: a.citizenshipNumber || profile.citizenship_number || "",
    }));
    if (profile.citizenship_front_image) {
      setFrontImage((v) => v ?? profile.citizenship_front_image);
    }
    if (profile.citizenship_back_image) {
      setBackImage((v) => v ?? profile.citizenship_back_image);
    }
  }, [profile]);

  const fetchBike = useServerFn(getBike);
  const { data: bike, isLoading } = useQuery({
    queryKey: ["bike", bikeId],
    queryFn: async () => {
      try {
        return (await fetchBike({ data: { id: bikeId } })) as BikeRow;
      } catch {
        return null;
      }
    },
  });

  const book = useServerFn(createBooking);
  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!bike) throw new Error("Bike not loaded");
      if (!user) {
        navigate({ to: "/auth" });
        throw new Error("Please sign in to book");
      }
      const start = new Date(startDate);
      if (isNaN(start.getTime()) || start < new Date(Date.now() - 60_000)) {
        throw new Error("Please choose a valid pickup date and time");
      }
      if (!agreement.fullName.trim() || !agreement.address.trim() || !agreement.phone.trim()) {
        throw new Error("Please fill in all your details");
      }
      if (!agreement.citizenshipNumber.trim()) {
        throw new Error("Citizenship number is required");
      }
      if (!frontImage || !backImage) {
        throw new Error("Please upload both sides of your citizenship card");
      }

      const end = new Date(start.getTime() + days * 24 * 3600 * 1000);
      return book({
        data: {
          bike_id: bike.id,
          start_date: start.toISOString(),
          end_date: end.toISOString(),
          pickup_location: `${pickupLocation.name} — ${pickupLocation.address}`,
          renter_full_name: agreement.fullName,
          renter_address: agreement.address,
          renter_phone: agreement.phone,
          citizenship_number: agreement.citizenshipNumber,
          citizenship_front_image: frontImage,
          citizenship_back_image: backImage,
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
            <Link to="/fleet" search={{ pickup: undefined, date: undefined, days: undefined }}>
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
  const agreementComplete =
    agreement.fullName.trim() &&
    agreement.address.trim() &&
    agreement.phone.trim() &&
    agreement.citizenshipNumber.trim() &&
    frontImage &&
    backImage;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <div>
          <Link
            to="/fleet"
            search={{ pickup: undefined, date: undefined, days: undefined }}
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
            {bike.available && bike.quantity <= 0 && (
              <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-full">
                Out of Stock
              </span>
            )}
          </div>
          {bike.available && bike.quantity > 0 && (
            <p className="text-xs text-muted-foreground mb-2">{bike.quantity} available</p>
          )}
          {bike.vendor_name && (
            <p className="text-sm text-muted-foreground mb-4">Listed by {bike.vendor_name}</p>
          )}
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
            <select
              className="w-full border rounded-md px-3 py-2 mt-1 text-sm bg-background"
              value={pickupId}
              onChange={(e) => setPickupId(e.target.value)}
            >
              {PICKUP_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1 mb-1">{pickupLocation.address}</p>

            <a
              href={mapsSearchUrl(pickupLocation.address)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View on map →
            </a>

            <label className="text-xs text-muted-foreground block mt-3">PICKUP DATE & TIME</label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={startDate}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <label className="text-xs text-muted-foreground block mt-3">DURATION</label>
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

            {isStaff ? (
              <p className="text-xs text-muted-foreground bg-secondary/70 rounded-md px-3 py-2 text-center">
                Admin and Super Admin accounts can't book rides. Sign in with a customer account to
                book.
              </p>
            ) : !showAgreement ? (
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!bike.available || bike.quantity <= 0}
                onClick={() => setShowAgreement(true)}
              >
                {bike.quantity <= 0 ? "Out of Stock" : "Continue to Rental Details"}
              </Button>
            ) : (
              <div className="space-y-3 border-t pt-4 mt-1">
                <h4 className="font-semibold text-sm">Renter Details</h4>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Required before your booking is confirmed.
                </p>
                <div>
                  <label className="text-xs text-muted-foreground">Full name</label>
                  <Input
                    value={agreement.fullName}
                    onChange={(e) => setAgreement((a) => ({ ...a, fullName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Address</label>
                  <Input
                    value={agreement.address}
                    onChange={(e) => setAgreement((a) => ({ ...a, address: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phone number</label>
                  <Input
                    value={agreement.phone}
                    onChange={(e) => setAgreement((a) => ({ ...a, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Citizenship number</label>
                  <Input
                    value={agreement.citizenshipNumber}
                    onChange={(e) =>
                      setAgreement((a) => ({ ...a, citizenshipNumber: e.target.value }))
                    }
                  />
                </div>
                <ImageUploadField
                  label="Citizenship photo — front"
                  value={frontImage}
                  onChange={setFrontImage}
                />
                <ImageUploadField
                  label="Citizenship photo — back"
                  value={backImage}
                  onChange={setBackImage}
                />

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAgreement(false)}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={!agreementComplete || bookingMutation.isPending}
                    onClick={() => bookingMutation.mutate()}
                  >
                    {bookingMutation.isPending ? "Booking…" : "Confirm Booking"}
                  </Button>
                </div>
              </div>
            )}
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
