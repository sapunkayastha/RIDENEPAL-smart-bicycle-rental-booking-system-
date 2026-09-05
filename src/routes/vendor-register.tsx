import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ShieldAlert } from "lucide-react";
import { registerVendor } from "@/lib/vendor.functions";
import { getPublicCommissionRate } from "@/lib/commission.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/vendor-register")({
  component: VendorRegister,
  head: () => ({ meta: [{ title: "Become a Vendor — RIDENEPAL" }] }),
});

// Same proven approach used for bike photos: compress in-browser and
// store as a base64 data URL — no separate file storage needed.
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

function VendorRegister() {
  const navigate = useNavigate();
  const register = useServerFn(registerVendor);
  const fetchRate = useServerFn(getPublicCommissionRate);
  const { data: rateData } = useQuery({
    queryKey: ["public-commission-rate"],
    queryFn: () => fetchRate(),
  });
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    businessName: "",
    panNumber: "",
    vatNumber: "",
  });
  const [idDocument, setIdDocument] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      if (!idDocument) throw new Error("Please upload a photo of your ID or PAN card");
      return register({
        data: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          businessName: form.businessName,
          panNumber: form.panNumber,
          vatNumber: form.vatNumber || undefined,
          idDocument,
        },
      });
    },
    onSuccess: () => {
      toast.success("Application submitted! We'll review it shortly.");
      navigate({ to: "/auth" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Registration failed"),
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setIdDocument(dataUrl);
    } catch {
      toast.error("Could not process that image, try a different file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-1">Become a RideNepal Vendor</h1>
        <p className="text-sm text-muted-foreground mb-6">
          List your own bikes for rent. Applications are reviewed before approval.
        </p>
        <Card className="p-4 mb-6 border-primary/30 bg-primary/5">
          <div className="flex gap-2">
            <ShieldAlert className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Before you apply:</span> RideNepal
              currently takes a{" "}
              <span className="font-semibold text-foreground">{rateData?.rate ?? "…"}%</span>{" "}
              commission on every completed booking made through the platform. This rate is set by
              RideNepal and may change over time. By applying, you agree to this arrangement.
            </p>
          </div>
        </Card>
        <Card className="p-6 border-0 shadow-sm space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Full name</label>
            <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Password</label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Business name</label>
            <Input
              value={form.businessName}
              onChange={(e) => set("businessName", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">PAN number</label>
            <Input value={form.panNumber} onChange={(e) => set("panNumber", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">VAT number (optional)</label>
            <Input value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Upload photo of your PAN/ID card
            </label>
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
          <p className="text-xs text-center text-muted-foreground">
            Already registered?{" "}
            <Link to="/admin-login" className="text-primary hover:underline">
              Admin sign in
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
