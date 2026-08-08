import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { completeCustomerOnboarding } from "@/lib/onboarding.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bike, MailCheck, ShieldCheck, UserPlus } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  component: OnboardingPage,
  head: () => ({
    meta: [
      { title: "Create Your Rider Account — RIDENEPAL" },
      {
        name: "description",
        content:
          "Set up your RIDENEPAL rider account in a minute — add your details, verify your email and start booking bicycles across Nepal.",
      },
      { property: "og:title", content: "Create Your Rider Account — RIDENEPAL" },
      {
        property: "og:description",
        content: "Join RIDENEPAL as a customer, verify your email and unlock bike bookings, rewards and live ride tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function OnboardingPage() {
  const navigate = useNavigate();
  const finishOnboarding = useServerFn(completeCustomerOnboarding);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
        setEmail(data.session.user.email ?? "");
      }
    });
  }, []);

  async function routeAfterSignup() {
    const result = await finishOnboarding({ data: { fullName, phone } });
    if (result.next === "/verify-otp") {
      toast.success("Account created — one quick email verification left.");
      navigate({ to: "/verify-otp" });
    } else {
      toast.success("You're all set. Happy riding!");
      navigate({ to: result.next as "/dashboard" | "/admin" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!hasSession) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setCheckEmail(true);
          return;
        }
      }
      await routeAfterSignup();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create your account");
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md p-8 border-0 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <MailCheck className="size-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Confirm your email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it, then
            come back here to finish setting up your rider account.
          </p>
          <Button asChild variant="outline" className="mt-6 w-full">
            <Link to="/auth">Back to sign in</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md p-8 border-0 shadow-sm">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <Bike className="size-6 text-primary" />
          <span className="font-extrabold text-xl tracking-widest text-primary">RIDENEPAL</span>
        </Link>

        <div className="flex justify-center mb-4">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <UserPlus className="size-7" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center">
          {hasSession ? "Finish your rider profile" : "Create your rider account"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          Customer accounts can book bikes, earn rewards and track rides live.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">FULL NAME</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">PHONE</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+977 98…"
              maxLength={30}
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">EMAIL</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={hasSession}
            />
          </div>
          {!hasSession && (
            <div>
              <label className="text-xs text-muted-foreground">PASSWORD</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
            {loading ? "Setting up…" : hasSession ? "Continue" : "Create customer account"}
          </Button>
        </form>

        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-4">
          <ShieldCheck className="size-3.5 text-primary" />
          Email verification is required before your first booking.
        </p>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{" "}
          <Link to="/auth" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
