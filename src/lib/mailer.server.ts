import nodemailer from "nodemailer";

// Real email delivery via Gmail SMTP. Requires SMTP_USER (your Gmail
// address) and SMTP_PASS (a Gmail "App Password", not your normal
// login password — see the setup notes in the README/chat).
//
// Because Gmail routes every "+alias" of an address to the same real
// inbox (e.g. you+1@gmail.com and you+2@gmail.com both land in
// you@gmail.com), this lets you create as many test accounts as you
// want while every OTP/notification email still arrives in one place.

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) {
    // No SMTP configured (e.g. local dev without a .env set up yet) —
    // fall back to logging so nothing silently breaks.
    console.log(`\n📧 [EMAIL NOT CONFIGURED] To: ${to} | Subject: ${subject}\n${html}\n`);
    return;
  }

  try {
    await t.sendMail({
      from: `"RideNepal" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    // Never let an email failure break the actual signup/login flow —
    // log it and let the OTP still exist in the database so the
    // console-log fallback (kept alongside this call) still works.
    console.error("Failed to send email:", err);
  }
}

export async function sendOtpEmail(to: string, code: string, minutes: number) {
  await sendEmail(
    to,
    "Your RideNepal verification code",
    `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #16a34a;">RideNepal</h2>
      <p>Your verification code is:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p style="color: #666; font-size: 14px;">This code expires in ${minutes} minutes. If you didn't request this, you can safely ignore this email.</p>
    </div>`,
  );
}
