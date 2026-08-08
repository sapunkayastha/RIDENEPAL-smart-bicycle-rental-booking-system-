import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Phone, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/otp")({
  component: OtpPage,
  head: () => ({ meta: [{ title: "Sign In with OTP — RIDENEPAL" }] }),
});

function OtpPage() {
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-md mx-auto px-6 py-16">
        <Card className="p-8 border-0 shadow-sm">
          <div className="flex justify-center mb-5">
            <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ShieldCheck className="size-7" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center">Secure OTP Login</h1>
          <p className="text-sm text-muted-foreground text-center mt-2 mb-6">
            {step === "phone" ? "Enter your phone to receive a one-time code." : `We sent a 6-digit code to ${phone}.`}
          </p>

          {step === "phone" ? (
            <>
              <label className="text-xs text-muted-foreground">PHONE NUMBER</label>
              <div className="flex items-center gap-2 mt-1 mb-5 border rounded-md px-3 py-2 bg-background">
                <Phone className="size-4 text-muted-foreground" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto" placeholder="+977 98XXXXXXXX" />
              </div>
              <Button onClick={() => phone.length >= 7 && setStep("verify")} className="w-full bg-primary hover:bg-primary/90">Send OTP</Button>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button asChild className="w-full bg-primary hover:bg-primary/90" disabled={code.length !== 6}>
                <Link to="/dashboard">Verify & Continue</Link>
              </Button>
              <button onClick={() => setStep("phone")} className="w-full text-xs text-muted-foreground mt-3 hover:text-foreground">Change number</button>
            </>
          )}
        </Card>
        <p className="text-xs text-center text-muted-foreground mt-6">By continuing you accept the RIDENEPAL Terms.</p>
      </main>
    </div>
  );
}
