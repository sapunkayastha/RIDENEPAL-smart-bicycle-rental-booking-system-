import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert } from "lucide-react";
import { signInWithPassword } from "@/lib/auth.functions";
import { myRole } from "@/lib/auth.functions";
import { getPublicCommissionRate } from "@/lib/commission.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-login")({
  component: AdminLogin,
  head: () => ({ meta: [{ title: "Admin Sign In — RIDENEPAL" }] }),
});

function AdminLogin() {
  const navigate = useNavigate();
  const signIn = useServerFn(signInWithPassword);
  const fetchRole = useServerFn(myRole);
  const fetchRate = useServerFn(getPublicCommissionRate);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { data: rateData } = useQuery({
    queryKey: ["public-commission-rate"],
    queryFn: () => fetchRate(),
  });

  const mutation = useMutation({
    mutationFn: () => signIn({ data: { email, password } }),
    onSuccess: async () => {
      toast.success("Signed in");
      const role = await fetchRole().catch(() => null);
      if (role?.isStaff) {
        navigate({ to: "/admin" });
      } else {
        // Not approved yet (or never applied) — send them to the
        // vendor dashboard, which shows pending/rejected status or
        // the application form if they haven't applied at all.
        navigate({ to: "/vendor-dashboard" });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sign in failed"),
  });

  return (
    <div className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <main className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-1">Admin Sign In</h1>
        <p className="text-sm text-muted-foreground mb-6">
          For approved vendors and platform staff only.
        </p>

        <Card className="p-4 mb-6 border-primary/30 bg-primary/5">
          <div className="flex gap-2">
            <ShieldAlert className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Before you apply:</span> RideNepal
              currently takes a{" "}
              <span className="font-semibold text-foreground">{rateData?.rate ?? "…"}%</span>{" "}
              commission on every completed booking made through the platform. This rate is set by
              RideNepal and may change over time. By applying to become a vendor, you agree to this
              arrangement.
            </p>
          </div>
        </Card>

        <Card className="p-6 border-0 shadow-sm space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && mutation.mutate()}
            />
          </div>
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            disabled={mutation.isPending || !email || !password}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Signing in…" : "Sign In"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Not registered as a vendor yet?{" "}
            <Link to="/vendor-register" className="text-primary hover:underline">
              Apply here
            </Link>
          </p>
          <p className="text-xs text-center text-muted-foreground">
            Looking to rent a bike instead?{" "}
            <Link to="/auth" className="text-primary hover:underline">
              Customer sign in
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
