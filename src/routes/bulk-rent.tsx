import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Users, Building2, Calendar, Tag, CheckCircle2 } from "lucide-react";
import { submitBulkRentRequest } from "@/lib/bulk-rent.functions";
import { useAuth } from "@/hooks/use-auth";
import { myRole } from "@/lib/auth.functions";
import { useQuery } from "@tanstack/react-query";
import bike1 from "@/assets/bike-1.jpg";

export const Route = createFileRoute("/bulk-rent")({
  component: BulkRent,
  head: () => ({ meta: [{ title: "Bulk Bicycle Rental — RIDENEPAL" }] }),
});

const tiers = [
  { qty: "5–10 bikes", off: "10% off", note: "Small groups & families" },
  { qty: "11–25 bikes", off: "18% off", note: "Schools & clubs" },
  { qty: "26+ bikes", off: "25% off", note: "Corporate events & expos" },
];

function BulkRent() {
  const submitRequest = useServerFn(submitBulkRentRequest);
  const { user } = useAuth();
  const fetchMyRole = useServerFn(myRole);
  const { data: roleData } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchMyRole(),
    enabled: !!user,
    retry: false,
    throwOnError: false,
  });
  const isStaff = roleData?.isStaff ?? false;
  const [form, setForm] = useState({
    organization: "",
    contact_email: "",
    bike_count: "",
    event_date: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const count = Number(form.bike_count);
    if (!form.organization.trim()) return setError("Organization is required");
    if (!form.contact_email.trim()) return setError("Contact email is required");
    if (!count || count < 1) return setError("Enter a valid number of bikes");

    setSubmitting(true);
    try {
      await submitRequest({
        data: {
          organization: form.organization,
          contact_email: form.contact_email,
          bike_count: count,
          event_date: form.event_date || null,
          notes: form.notes || null,
        },
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mb-12">
          <div>
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold">
              <Users className="size-3" /> GROUP & ENTERPRISE
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mt-4">
              Bulk Bicycle Rental
            </h1>
            <p className="text-muted-foreground mt-3">
              Renting for a school trip, corporate retreat, or a community ride? Reserve in bulk and
              unlock tiered pricing, dedicated support, and on-site delivery.
            </p>
          </div>
          <div className="aspect-[4/3] rounded-xl overflow-hidden">
            <img src={bike1} alt="Group rental" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {tiers.map((t) => (
            <Card key={t.qty} className="p-6 border-0 shadow-sm">
              <Tag className="size-5 text-primary mb-3" />
              <div className="font-semibold">{t.qty}</div>
              <div className="text-2xl font-bold text-primary mt-1">{t.off}</div>
              <p className="text-xs text-muted-foreground mt-2">{t.note}</p>
            </Card>
          ))}
        </div>

        <Card className="p-8 border-0 shadow-sm">
          {submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="size-10 text-primary mx-auto mb-3" />
              <h2 className="text-xl font-bold">Request received!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                We'll reach out to {form.contact_email} within 24 hours.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                <Building2 className="size-5 text-primary" /> Request a Bulk Quote
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Tell us about your event and we'll respond within 24 hours.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Organization</label>
                  <Input
                    className="mt-1"
                    placeholder="RIDENEPAL Trekking Club"
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Contact Email</label>
                  <Input
                    type="email"
                    className="mt-1"
                    placeholder="lead@org.com"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Number of bikes</label>
                  <Input
                    type="number"
                    className="mt-1"
                    placeholder="20"
                    value={form.bike_count}
                    onChange={(e) => setForm({ ...form, bike_count: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Event date</label>
                  <div className="flex items-center gap-2 mt-1 border rounded-md px-3 py-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <Input
                      type="date"
                      className="border-0 shadow-none p-0 h-auto"
                      value={form.event_date}
                      onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <Textarea
                    className="mt-1"
                    placeholder="Trail, helmet sizes, delivery location..."
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive mt-3">{error}</p>}
              {isStaff && (
                <p className="text-xs text-muted-foreground bg-secondary/70 rounded-md px-3 py-2 mt-3">
                  Admin and Super Admin accounts can't submit bulk rental requests. Use the Admin
                  Console to manage incoming requests instead.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  className="bg-primary hover:bg-primary/90"
                  disabled={submitting || isStaff}
                  onClick={submit}
                >
                  {submitting ? "Submitting…" : "Submit Bulk Request"}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/fleet" search={{ pickup: undefined, date: undefined }}>
                    Browse Fleet
                  </Link>
                </Button>
              </div>
              <ul className="mt-6 grid md:grid-cols-3 gap-3 text-xs text-muted-foreground">
                {[
                  "On-site delivery & pickup",
                  "Helmet & repair kit included",
                  "Dedicated event coordinator",
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <CheckCircle2 className="size-3 text-primary mt-0.5" /> {x}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
