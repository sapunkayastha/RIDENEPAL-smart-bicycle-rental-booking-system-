import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeGoogleSignIn } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth-callback")({
  component: GoogleCallback,
  ssr: false,
});

function GoogleCallback() {
  const navigate = useNavigate();
  const completeSignIn = useServerFn(completeGoogleSignIn);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setError("No authorization code received from Google.");
      return;
    }
    completeSignIn({ data: { code } })
      .then((res) => {
        navigate({ to: res.otpVerified ? "/dashboard" : "/verify-otp" });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">{error ?? "Signing you in…"}</p>
    </div>
  );
}
