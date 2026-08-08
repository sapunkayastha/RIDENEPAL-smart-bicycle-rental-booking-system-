import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { markOtpVerified } from "@/lib/otp.functions";
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

// Don't re-send within this window — avoids burning Supabase's email rate limit
// every time this page mounts (redirect back here, refresh, etc).
const RESEND_COOLDOWN_MS = 60_000;
const OTP_LENGTH = 6; // matches this Supabase project's Email OTP length setting
const LAST_SENT_KEY = "ridenepal:otp-last-sent";

function VerifyOtpPage() {
  const navigate = useNavigate();
  const mark = useServerFn(markOtpVerified);
  const [email, setEmail] = useState<string>("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function msSinceLastSend() {
    const raw = sessionStorage.getItem(LAST_SENT_KEY);
    if (!raw) return Infinity;
    return Date.now() - Number(raw);
  }

  useEffect(() => {
    // If this page load came from clicking the emailed magic link (rather
    // than typing the code manually), Supabase has already authenticated
    // the session — capture that signal before the SDK consumes the hash.
    const cameFromMagicLink =
      /type=magiclink/.test(window.location.hash) || /access_token=/.test(window.location.hash);

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/auth" });
        return;
      }
      setEmail(data.user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("otp_verified")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile?.otp_verified) {
        navigate({ to: "/dashboard" });
        return;
      }
      if (cameFromMagicLink) {
        // Clicking the link IS the verification — no need to also type the code.
        await mark({});
        toast.success("Verified! Welcome to RIDENEPAL.");
        navigate({ to: "/dashboard" });
        return;
      }
      // Auto-send only if we haven't already sent one recently (covers
      // remounts from redirects/refreshes, not just repeated button clicks).
      const elapsed = msSinceLastSend();
      if (elapsed >= RESEND_COOLDOWN_MS) {
        await sendCode(data.user.email ?? "");
      } else {
        setCooldown(Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode(target: string) {
    if (!target || cooldown > 0) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: target,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/verify-otp`,
        },
      });
      if (error) throw error;
      sessionStorage.setItem(LAST_SENT_KEY, String(Date.now()));
      setCooldown(RESEND_COOLDOWN_MS / 1000);
      toast.success(`Verification code sent to ${target}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (code.length !== OTP_LENGTH) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      await mark({});
      toast.success("Verified! Welcome to RIDENEPAL.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setVerifying(false);
    }
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
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          We sent a verification code to{" "}
          <span className="font-medium text-foreground">{email || "your email"}</span>.
          <br />
          Enter it below to finish signing in.
        </p>
        <div className="flex justify-center mb-5">
          <InputOTP maxLength={OTP_LENGTH} value={code} onChange={setCode}>
            <InputOTPGroup>
              {Array.from({ length: OTP_LENGTH }, (_, i) => <InputOTPSlot key={i} index={i} />)}
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
          onClick={() => sendCode(email)}
          disabled={sending || cooldown > 0}
          className="w-full text-xs text-muted-foreground mt-3 hover:text-foreground disabled:opacity-50"
        >
          {sending ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Didn't get a code? Resend"}
        </button>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}
          className="w-full text-xs text-muted-foreground mt-2 hover:text-foreground"
        >
          Use a different account
        </button>
      </Card>
    </div>
  );
}
