import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listAllBikes, createBike, updateBike } from "@/lib/bikes.functions";
import { toast } from "sonner";
import { Bike, Plus, Pencil, Loader2, ArrowLeft, Power, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/manage-bikes")({
  component: ManageBikes,
  head: () => ({ meta: [{ title: "Manage Bikes — RIDENEPAL" }] }),
});

type BikeRow = {
  id: string;
  name: string;
  type: string;
  price_per_day: number | string;
  image_url: string | null;
  description: string | null;
  available: number | boolean;
  specs: string | Record<string, string | number | null> | null;
  stock_quantity: number;
  available_stock: number;
};

type FormState = {
  id: string | null;
  name: string;
  type: "electric" | "hybrid" | "manual";
  price_per_day: string;
  image_url: string;
  description: string;
  available: boolean;
  motor_power: string;
  range_km: string;
  gears: string;
  weight_kg: string;
  stock_quantity: string;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  type: "electric",
  price_per_day: "",
  image_url: "",
  description: "",
  available: true,
  motor_power: "",
  range_km: "",
  gears: "",
  weight_kg: "",
  stock_quantity: "1",
};

function parseSpecs(specs: BikeRow["specs"]) {
  if (!specs) return {};
  if (typeof specs === "string") {
    try {
      return JSON.parse(specs) as Record<string, string | number | null>;
    } catch {
      return {};
    }
  }
  return specs;
}

function resizeImageToDataUrl(file: File, maxWidth = 900, quality = 0.75): Promise<string> {
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

function ManageBikes() {
  const qc = useQueryClient();
  const fetchBikes = useServerFn(listAllBikes);
  const addBike = useServerFn(createBike);
  const editBike = useServerFn(updateBike);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-bikes"],
    queryFn: () => fetchBikes(),
  });

  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const isEditing = form.id !== null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setForm((f) => ({ ...f, image_url: dataUrl }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function loadForEdit(bike: BikeRow) {
    const specs = parseSpecs(bike.specs);
    setForm({
      id: bike.id,
      name: bike.name,
      type: bike.type as FormState["type"],
      price_per_day: String(bike.price_per_day),
      image_url: bike.image_url ?? "",
      description: bike.description ?? "",
      available: Boolean(bike.available),
      motor_power: specs.motor_power != null ? String(specs.motor_power) : "",
      range_km: specs.range_km != null ? String(specs.range_km) : "",
      gears: specs.gears != null ? String(specs.gears) : "",
      weight_kg: specs.weight_kg != null ? String(specs.weight_kg) : "",
      stock_quantity: String(bike.stock_quantity ?? 1),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildPayload() {
    const price = Number(form.price_per_day);
    return {
      name: form.name.trim(),
      type: form.type,
      price_per_day: price,
      image_url: form.image_url.trim() || null,
      description: form.description.trim() || null,
      available: form.available,
      motor_power: form.motor_power.trim() || null,
      range_km: form.range_km.trim() ? Number(form.range_km) : null,
      gears: form.gears.trim() || null,
      weight_kg: form.weight_kg.trim() ? Number(form.weight_kg) : null,
      stock_quantity: Math.max(0, Number(form.stock_quantity) || 0),
    };
  }

  const createMutation = useMutation({
    mutationFn: () => addBike({ data: buildPayload() }),
    onSuccess: () => {
      toast.success("Bike added");
      qc.invalidateQueries({ queryKey: ["admin-bikes"] });
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add bike"),
  });

  const updateMutation = useMutation({
    mutationFn: () => editBike({ data: { ...buildPayload(), id: form.id! } }),
    onSuccess: () => {
      toast.success("Bike updated");
      qc.invalidateQueries({ queryKey: ["admin-bikes"] });
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update bike"),
  });

  const toggleMutation = useMutation({
    mutationFn: (bike: BikeRow) => {
      const specs = parseSpecs(bike.specs);
      return editBike({
        data: {
          id: bike.id,
          name: bike.name,
          type: bike.type as FormState["type"],
          price_per_day: Number(bike.price_per_day),
          image_url: bike.image_url,
          description: bike.description,
          available: !bike.available,
          motor_power: specs.motor_power != null ? String(specs.motor_power) : null,
          range_km: specs.range_km != null ? Number(specs.range_km) : null,
          gears: specs.gears != null ? String(specs.gears) : null,
          weight_kg: specs.weight_kg != null ? Number(specs.weight_kg) : null,
          stock_quantity: bike.stock_quantity ?? 1,
        },
      });
    },
    onSuccess: () => {
      toast.success("Availability updated");
      qc.invalidateQueries({ queryKey: ["admin-bikes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update bike"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Bike name is required");
    const price = Number(form.price_per_day);
    if (!price || price <= 0) return toast.error("Enter a valid price per day");

    if (isEditing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-3.5" /> Back to Admin Console
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <Bike className="size-5 text-primary" />
          <h1 className="text-3xl font-bold">Manage Bikes</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Add new bikes to the fleet, update pricing and details, or retire a bike by marking it
          unavailable.
        </p>

        <Card className="p-6 border-0 shadow-sm mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              {isEditing ? (
                <>
                  <Pencil className="size-4 text-primary" /> Edit Bike
                </>
              ) : (
                <>
                  <Plus className="size-4 text-primary" /> Add New Bike
                </>
              )}
            </h2>
            {isEditing && (
              <Button type="button" variant="outline" size="sm" onClick={() => setForm(emptyForm)}>
                <X className="size-3.5 mr-1" /> Cancel edit
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">NAME</label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Thamel Classic Single-Speed"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">TYPE</label>
              <select
                className="w-full border rounded-md px-3 py-2 mt-1 text-sm bg-background"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as FormState["type"] })}
              >
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">PRICE PER DAY (NPR)</label>
              <Input
                className="mt-1"
                type="number"
                min="1"
                value={form.price_per_day}
                onChange={(e) => setForm({ ...form, price_per_day: e.target.value })}
                placeholder="450"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                STOCK — HOW MANY OF THIS BIKE?
              </label>
              <Input
                className="mt-1"
                type="number"
                min="0"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                placeholder="10"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Once all units are booked, this listing shows "Out of Stock".
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">PHOTO</label>
              <div className="flex items-start gap-4 mt-1">
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt="Preview"
                    className="size-20 rounded-md object-cover border shrink-0"
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Or paste an image URL instead:
                  </p>
                  <Input
                    className="mt-1"
                    value={form.image_url.startsWith("data:") ? "" : form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://…"
                  />
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image_url: "" })}
                      className="text-xs text-destructive hover:underline mt-1"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">DESCRIPTION</label>
              <Textarea
                className="mt-1"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A dependable pedal-assist hybrid for lakeside trails…"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">MOTOR POWER</label>
              <Input
                className="mt-1"
                value={form.motor_power}
                onChange={(e) => setForm({ ...form, motor_power: e.target.value })}
                placeholder="250W"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">RANGE (KM)</label>
              <Input
                className="mt-1"
                type="number"
                value={form.range_km}
                onChange={(e) => setForm({ ...form, range_km: e.target.value })}
                placeholder="60"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">GEARS</label>
              <Input
                className="mt-1"
                value={form.gears}
                onChange={(e) => setForm({ ...form, gears: e.target.value })}
                placeholder="21-speed"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">WEIGHT (KG)</label>
              <Input
                className="mt-1"
                type="number"
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                placeholder="22"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="available"
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm({ ...form, available: e.target.checked })}
                className="size-4"
              />
              <label htmlFor="available" className="text-sm">
                Available for booking
              </label>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saving}>
                {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Bike"}
              </Button>
            </div>
          </form>
        </Card>

        <h2 className="font-semibold mb-4">Fleet ({data?.length ?? 0})</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading bikes…
          </p>
        ) : (
          <div className="space-y-3">
            {(data ?? []).map((bike) => (
              <Card
                key={bike.id}
                className="p-4 border-0 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {bike.name}
                    <span className="text-[10px] font-semibold bg-primary/15 text-primary px-2 py-0.5 rounded-full uppercase">
                      {bike.type}
                    </span>
                    {!bike.available && (
                      <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        Unavailable
                      </span>
                    )}
                    {bike.available && bike.available_stock <= 0 && (
                      <span className="text-[10px] font-semibold bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">
                        Out of Stock
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    NPR {Number(bike.price_per_day).toFixed(0)}/day
                  </div>
                  <div className="text-xs mt-0.5">
                    {bike.available_stock > 0 ? (
                      <span className="text-green-700 font-medium">
                        {bike.available_stock} of {bike.stock_quantity} in stock
                      </span>
                    ) : (
                      <span className="text-destructive font-medium">
                        0 of {bike.stock_quantity} in stock
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={toggleMutation.isPending}
                    onClick={() => toggleMutation.mutate(bike)}
                  >
                    <Power className="size-3.5 mr-1" />
                    {bike.available ? "Mark Unavailable" : "Mark Available"}
                  </Button>
                  <Button size="sm" onClick={() => loadForEdit(bike)}>
                    <Pencil className="size-3.5 mr-1" /> Edit
                  </Button>
                </div>
              </Card>
            ))}
            {(data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No bikes yet — add one above.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
