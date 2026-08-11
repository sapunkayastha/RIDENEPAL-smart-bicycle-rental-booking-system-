import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Loader2, ShieldCheck, MailCheck, Calendar, Bike, Wallet } from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "My Profile — RIDENEPAL" }] }),
});

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  customer: "Customer",
};

function ProfilePage() {
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(updateMyProfile);
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () => save({ data: { full_name: fullName, phone } }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save changes"),
  });

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin mx-auto mb-3" /> Loading your profile…
        </main>
      </div>
    );
  }

  const initial = (profile.full_name || profile.email || "R")[0]?.toUpperCase();
  const highestRole = profile.roles.includes("super_admin")
    ? "super_admin"
    : profile.roles.includes("admin")
      ? "admin"
      : "customer";

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1 mb-8">View and update how RIDENEPAL knows you.</p>

        <Card className="p-6 border-0 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="size-16 rounded-full object-cover" />
            ) : (
              <div className="size-16 rounded-full bg-primary/15 text-primary flex items-center justify-center text-2xl font-bold">
                {initial}
              </div>
            )}
            <div>
              <div className="font-semibold text-lg">{profile.full_name || "Unnamed rider"}</div>
              <div className="text-sm text-muted-foreground">{profile.email}</div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full mt-1">
                <ShieldCheck className="size-3" /> {roleLabels[highestRole] ?? highestRole}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Bike className="size-3" /> Bookings
              </div>
              <div className="font-bold text-lg mt-1">{profile.booking_count}</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Wallet className="size-3" /> Total Spent
              </div>
              <div className="font-bold text-lg mt-1">NPR {profile.total_spend.toFixed(0)}</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Calendar className="size-3" /> Member Since
              </div>
              <div className="font-bold text-lg mt-1">
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <User className="size-4 text-primary" /> Edit Details
          </h3>

          <label className="text-xs text-muted-foreground">FULL NAME</label>
          <Input
            className="mt-1 mb-4"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
          />

          <label className="text-xs text-muted-foreground">PHONE</label>
          <Input
            className="mt-1 mb-4"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+977 98XXXXXXXX"
          />

          <label className="text-xs text-muted-foreground">EMAIL</label>
          <div className="flex items-center gap-2 mt-1 mb-1 border rounded-md px-3 py-2 bg-muted/40 text-sm text-muted-foreground">
            <MailCheck className="size-4" /> {profile.email}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Email is tied to your sign-in and can't be changed here.
          </p>

          <Button
            className="bg-primary hover:bg-primary/90"
            disabled={saveMutation.isPending || !fullName.trim()}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </Card>
      </main>
    </div>
  );
}
