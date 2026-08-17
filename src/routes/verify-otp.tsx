import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { me, verifyOtpCode, sendOtp, logout } from "@/lib/auth.functions";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Bike, MailCheck } from "lucide-react";

export const Route = createFileRoute("/verify-otp")({
  ssr: false,
  component: VerifyOtpPage,
  head: () => ({ meta: [{ title: "Verify Email — RIDENEPAL" }] }),
});

const OTP_LENGTH = 6;

function VerifyOtpPage() {
  const navigate = useNavigate();
  const fetchMe = useServerFn(me);
  const verify = useServerFn(verifyOtpCode);
  const resend = useServerFn(sendOtp);
  const doLogout = useServerFn(logout);

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    retry: false,
  });

  async function handleVerify() {
    if (code.length !== OTP_LENGTH) return;
    setVerifying(true);
    try {
      await verify({ data: { code } });
      toast.success("Verified! Welcome to RIDENEPAL.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setSending(true);
    try {
      await resend();
      toast.success("New code sent — check your server console.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    navigate({ to: "/auth" });
    return null;
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
            <MailCheck className="size-7" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center">Verify your email</h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-2">
          Enter the 6-digit code for{" "}
          <span className="font-medium text-foreground">{user.email}</span>.
        </p>
        <p className="text-xs text-muted-foreground text-center mb-6">
          (Dev mode: check your server terminal for the code — search for "🔐 [DEV OTP]")
        </p>
        <div className="flex justify-center mb-5">
          <InputOTP maxLength={OTP_LENGTH} value={code} onChange={setCode}>
            <InputOTPGroup>
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          onClick={handleVerify}
          disabled={code.length !== OTP_LENGTH || verifying}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {verifying ? "Verifying…" : "Verify & Continue"}
        </Button>
        <button
          onClick={handleResend}
          disabled={sending}
          className="w-full text-xs text-muted-foreground mt-3 hover:text-foreground disabled:opacity-50"
        >
          {sending ? "Sending…" : "Didn't get a code? Resend"}
        </button>
        <button
          onClick={async () => {
            await doLogout();
            navigate({ to: "/auth" });
          }}
          className="w-full text-xs text-muted-foreground mt-2 hover:text-foreground"
        >
          Use a different account
        </button>
      </Card>
    </div>
  );
}
