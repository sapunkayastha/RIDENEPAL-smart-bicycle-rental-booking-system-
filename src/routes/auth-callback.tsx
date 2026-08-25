import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeGoogleSignIn, myRole } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth-callback")({
  component: GoogleCallback,
  ssr: false,
});

function GoogleCallback() {
  const navigate = useNavigate();
  const completeSignIn = useServerFn(completeGoogleSignIn);
  const fetchMyRole = useServerFn(myRole);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setError("No authorization code received from Google.");
      return;
    }
    completeSignIn({ data: { code } })
      .then(async (res) => {
        if (!res.otpVerified) {
          navigate({ to: "/verify-otp" });
          return;
        }
        const { isStaff } = await fetchMyRole();
        navigate({ to: isStaff ? "/admin" : "/dashboard" });
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
