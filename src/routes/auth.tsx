import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { signUpWithPassword, signInWithPassword, googleAuthUrl } from "@/lib/auth.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bike } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign In — RIDENEPAL" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const signUp = useServerFn(signUpWithPassword);
  const signIn = useServerFn(signInWithPassword);
  const getGoogleUrl = useServerFn(googleAuthUrl);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp({ data: { email, password, fullName } });
        toast.success("Account created!");
      } else {
        await signIn({ data: { email, password } });
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const { url } = await getGoogleUrl();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
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
        <h1 className="text-2xl font-bold text-center">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          {mode === "signin" ? "Sign in to book your next ride" : "Join the trail community"}
        </p>

        <Button
          variant="outline"
          className="w-full mb-4"
          onClick={handleGoogle}
          type="button"
          disabled={loading}
        >
          <svg className="size-4 mr-2" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or with email</span>
          </div>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <div>
              <label className="text-xs text-muted-foreground">FULL NAME</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground">EMAIL</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
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
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={loading}
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {mode === "signin" ? "New to RIDENEPAL?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-primary font-medium hover:underline"
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-4 px-2">
          Staff and customer accounts use the same sign-in. After login,{" "}
          <span className="text-foreground">customers</span> go to the dashboard;{" "}
          <span className="text-foreground">admins</span> and{" "}
          <span className="text-foreground">super admins</span> go to the admin console.
        </p>
      </Card>
    </div>
  );
}
