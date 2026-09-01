import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  getMyVendorProfile,
  listMyVendorBikes,
  createVendorBike,
  applyAsVendorSelf,
} from "@/lib/vendor.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendor-dashboard")({
  component: VendorDashboard,
  head: () => ({ meta: [{ title: "Vendor Dashboard — RIDENEPAL" }] }),
});

type Bike = {
  id: string;
  name: string;
  type: string;
  price_per_day: number;
  available: number;
  image_url?: string | null;
};

// Same proven in-browser compression used for bike photos and vendor
// registration — stores as a base64 data URL, no separate file storage.
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

function ApplyAsVendorForm() {
  const qc = useQueryClient();
  const apply = useServerFn(applyAsVendorSelf);
  const [form, setForm] = useState({ businessName: "", panNumber: "", vatNumber: "" });
  const [idDocument, setIdDocument] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!idDocument) throw new Error("Please upload a photo of your ID or PAN card");
      return apply({
        data: {
          businessName: form.businessName,
          panNumber: form.panNumber,
          vatNumber: form.vatNumber || undefined,
          idDocument,
        },
      });
    },
    onSuccess: () => {
      toast.success("Vendor application submitted!");
      qc.invalidateQueries({ queryKey: ["my-vendor-profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit application"),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setIdDocument(await resizeImageToDataUrl(file));
    } catch {
      toast.error("Could not process that image, try a different file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="p-6 border-0 shadow-sm space-y-4 max-w-md">
      <div>
        <h2 className="font-semibold">Apply to become a vendor</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Uses your current account — no need to sign up again.
        </p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Business name</label>
        <Input
          value={form.businessName}
          onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">PAN number</label>
        <Input
          value={form.panNumber}
          onChange={(e) => setForm((f) => ({ ...f, panNumber: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">VAT number (optional)</label>
        <Input
          value={form.vatNumber}
          onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Upload photo of your PAN/ID card</label>
        <div className="flex items-start gap-4 mt-1">
          {idDocument && (
            <img
              src={idDocument}
              alt="ID preview"
              className="w-24 h-16 rounded-md object-cover border shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
            />
            {uploading && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Processing image…
              </p>
            )}
          </div>
        </div>
      </div>
      <Button
        className="w-full bg-primary hover:bg-primary/90"
        disabled={mutation.isPending || uploading}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Submitting…" : "Submit Application"}
      </Button>
    </Card>
  );
}

function VendorDashboard() {
  const fetchProfile = useServerFn(getMyVendorProfile);
  const fetchBikes = useServerFn(listMyVendorBikes);
  const addBike = useServerFn(createVendorBike);
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-vendor-profile"],
    queryFn: () => fetchProfile(),
  });
  const { data: bikes } = useQuery({
    queryKey: ["my-vendor-bikes"],
    queryFn: () => fetchBikes() as Promise<Bike[]>,
    enabled: profile?.status === "approved",
  });

  const [form, setForm] = useState({ name: "", type: "manual", price: "", description: "" });
  const [bikeImage, setBikeImage] = useState<string | null>(null);
  const [bikeImageUploading, setBikeImageUploading] = useState(false);

  async function handleBikeImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBikeImageUploading(true);
    try {
      setBikeImage(await resizeImageToDataUrl(file));
    } catch {
      toast.error("Could not process that image, try a different file");
    } finally {
      setBikeImageUploading(false);
    }
  }

  const mutation = useMutation({
    mutationFn: () =>
      addBike({
        data: {
          name: form.name,
          type: form.type as "manual" | "hybrid" | "electric",
          price_per_day: Number(form.price),
          description: form.description || null,
          image_url: bikeImage,
          available: true,
        },
      }),
    onSuccess: () => {
      toast.success("Bike added");
      setForm({ name: "", type: "manual", price: "", description: "" });
      setBikeImage(null);
      qc.invalidateQueries({ queryKey: ["my-vendor-bikes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add bike"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondary/20">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 py-16 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-secondary/20">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-2xl font-bold mb-6">Vendor Dashboard</h1>
          <ApplyAsVendorForm />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold">Vendor Dashboard</h1>

        <Card className="p-5 border-0 shadow-sm">
          <div className="text-sm">
            <span className="font-semibold">{profile.business_name}</span> · PAN{" "}
            {profile.pan_number}
          </div>
          <div className="mt-2">
            {profile.status === "pending" && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                PENDING REVIEW
              </span>
            )}
            {profile.status === "approved" && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">
                APPROVED
              </span>
            )}
            {profile.status === "rejected" && (
              <>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800">
                  REJECTED
                </span>
                {profile.rejection_reason && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Reason: {profile.rejection_reason}
                  </p>
                )}
              </>
            )}
          </div>
        </Card>

        {profile.status === "approved" && (
          <>
            <Card className="p-5 border-0 shadow-sm space-y-3">
              <h2 className="font-semibold text-sm">Add a bike</h2>
              <Input
                placeholder="Bike name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <select
                className="w-full border rounded-md h-9 px-2 text-sm"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="manual">Manual</option>
                <option value="hybrid">Hybrid</option>
                <option value="electric">Electric</option>
              </select>
              <Input
                type="number"
                placeholder="Price per day (NPR)"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
              <textarea
                className="w-full border rounded-md p-2 text-sm"
                placeholder="Short description (optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
              <div>
                <label className="text-xs text-muted-foreground">Bike photo</label>
                <div className="flex items-center gap-3 mt-1">
                  {bikeImage && (
                    <img
                      src={bikeImage}
                      alt="Bike preview"
                      className="w-16 h-16 rounded-md object-cover border shrink-0"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBikeImageChange}
                    disabled={bikeImageUploading}
                    className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
                  />
                </div>
                {bikeImageUploading && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> Processing…
                  </p>
                )}
              </div>
              <Button
                className="bg-primary hover:bg-primary/90"
                disabled={mutation.isPending || !form.name || !form.price || bikeImageUploading}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Adding…" : "Add Bike"}
              </Button>
            </Card>

            <div>
              <h2 className="font-semibold text-sm mb-3">My Bikes</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bikes?.map((b) => (
                  <Card key={b.id} className="p-4 border-0 shadow-sm flex gap-3">
                    {b.image_url && (
                      <img
                        src={b.image_url}
                        alt={b.name}
                        className="w-16 h-16 rounded-md object-cover shrink-0"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-sm">{b.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{b.type}</div>
                      <div className="text-sm font-bold text-primary mt-1">
                        NPR {Number(b.price_per_day).toFixed(0)}/day
                      </div>
                    </div>
                  </Card>
                ))}
                {bikes?.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bikes listed yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
