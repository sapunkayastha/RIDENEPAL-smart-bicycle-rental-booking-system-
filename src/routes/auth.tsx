import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bike } from "lucide-react";
import { resolveAuthenticatedHomePath } from "@/lib/auth-navigation";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign In — RIDENEPAL" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) navigate({ to: await resolveAuthenticatedHomePath() });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // Email/password users skip the extra OTP step; only Google sign-in requires it.
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        await supabase.from("profiles").update({ otp_verified: true }).eq("id", u.user.id);
      }
      navigate({ to: await resolveAuthenticatedHomePath() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

async function handleGoogle() {
  setLoading(true);

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) throw error;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Google sign-in failed");
  } finally {
    setLoading(false);
  }
}

return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md p-8 border-0 shadow-sm">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <Bike className="size-6 text-primary" />
          <span className="font-extrabold text-xl tracking-widest text-primary">RIDENEPAL</span>
        </Link>
        <h1 className="text-2xl font-bold text-center">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          {mode === "signin" ? "Sign in to book your next ride" : "Join the trail community"}
        </p>

        <Button variant="outline" className="w-full mb-4" onClick={handleGoogle} type="button">
          <svg className="size-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
          Continue with Google
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or with email</span></div>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="text-xs text-muted-foreground">FULL NAME</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">EMAIL</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">PASSWORD</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "signin" ? "New to RIDENEPAL?" : "Already have an account?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary font-medium hover:underline">
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-4 px-2">
          Staff and customer accounts use the same sign-in. After login,{" "}
          <span className="text-foreground">customers</span> go to the dashboard;{" "}
          <span className="text-foreground">admins</span> and{" "}
          <span className="text-foreground">super admins</span> go to the admin console.
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Renting for the first time?{" "}
          <Link to="/onboarding" className="text-primary font-medium hover:underline">
            Start customer onboarding
          </Link>
        </p>

      </Card>
    </div>
  );
}
