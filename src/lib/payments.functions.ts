import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eSewa sandbox credentials (public test creds documented by eSewa)
const ESEWA_MERCHANT_CODE = "EPAYTEST";
const ESEWA_SECRET = "8gBm/:&EnhH.1/q";
const ESEWA_FORM_URL = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
const ESEWA_STATUS_URL = "https://rc.esewa.com.np/api/epay/transaction/status/";

// Khalti sandbox credentials (public test key documented by Khalti for dev.khalti.com).
// Switching to live keys means moving this into a stored secret.
const KHALTI_SANDBOX_SECRET = "live_secret_key_68791341fdd94846a146f0457ff7b455";
const KHALTI_INITIATE_URL = "https://dev.khalti.com/api/v2/epayment/initiate/";
const KHALTI_LOOKUP_URL = "https://dev.khalti.com/api/v2/epayment/lookup/";

async function hmacSha256Base64(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  let bin = ""; const bytes = new Uint8Array(sig);
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function deriveOrigin(): string {
  // Derive return origin from the incoming request — never trust client input.
  const envOrigin = process.env.APP_ORIGIN;
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  const req = getRequest();
  const origin = req?.headers.get("origin");
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, "");
  const referer = req?.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin; } catch { /* ignore */ }
  }
  const host = req?.headers.get("host");
  if (host) {
    const proto = req?.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  throw new Error("Could not determine request origin");
}

export const requestExtension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      booking_id: z.string().uuid(),
      hours: z.number().int().min(1).max(168),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, user_id, status, bikes(price_per_day)")
      .eq("id", data.booking_id)
      .single();
    if (bErr || !booking) throw new Error("Booking not found");
    if (booking.user_id !== userId) throw new Error("Forbidden");
    if (booking.status !== "paid" && booking.status !== "active") {
      throw new Error("Only paid or active bookings can be extended");
    }

    const pricePerDay = Number((booking as any).bikes?.price_per_day ?? 0);
    if (!isFinite(pricePerDay) || pricePerDay <= 0) throw new Error("Could not price this extension");
    const hourlyRate = pricePerDay / 24;
    const amount = Math.round(hourlyRate * data.hours * 100) / 100;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: extension, error } = await supabaseAdmin
      .from("booking_extensions")
      .insert({ booking_id: data.booking_id, user_id: userId, hours: data.hours, amount, status: "pending" })
      .select("id, hours, amount")
      .single();
    if (error) throw new Error(error.message);

    return extension;
  });

export const initExtensionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      extension_id: z.string().uuid(),
      provider: z.enum(["esewa", "khalti"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: extension, error: eErr } = await supabase
      .from("booking_extensions")
      .select("id, booking_id, user_id, amount, status")
      .eq("id", data.extension_id)
      .single();
    if (eErr || !extension) throw new Error("Extension not found");
    if (extension.user_id !== userId) throw new Error("Forbidden");
    if (extension.status === "paid") throw new Error("Extension already paid");

    const amount = Number(extension.amount);
    const origin = deriveOrigin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.provider === "esewa") {
      const transaction_uuid = `ext-${data.extension_id}-${Date.now()}`;
      const total_amount = amount.toFixed(2);
      const signed = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_MERCHANT_CODE}`;
      const signature = await hmacSha256Base64(signed, ESEWA_SECRET);

      await supabaseAdmin.from("payments").insert({
        booking_id: extension.booking_id,
        extension_id: extension.id,
        user_id: userId,
        provider: "esewa",
        transaction_uuid,
        amount,
        status: "pending",
      });

      return {
        provider: "esewa" as const,
        action: ESEWA_FORM_URL,
        fields: {
          amount: total_amount,
          tax_amount: "0",
          total_amount,
          transaction_uuid,
          product_code: ESEWA_MERCHANT_CODE,
          product_service_charge: "0",
          product_delivery_charge: "0",
          success_url: `${origin}/payment-return?status=success`,
          failure_url: `${origin}/payment-return?status=failure`,
          signed_field_names: "total_amount,transaction_uuid,product_code",
          signature,
        },
      };
    }

    // khalti
    const paisa = Math.round(amount * 100);
    const purchase_order_id = `ext-${data.extension_id}-${Date.now()}`;
    const res = await fetch(KHALTI_INITIATE_URL, {
      method: "POST",
      headers: { Authorization: `key ${KHALTI_SANDBOX_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        return_url: `${origin}/payment-return?provider=khalti`,
        website_url: origin,
        amount: paisa,
        purchase_order_id,
        purchase_order_name: "RIDENEPAL rental extension",
      }),
    });
    const body = (await res.json().catch(() => null)) as { pidx?: string; payment_url?: string } | null;
    if (!res.ok || !body?.pidx || !body?.payment_url) {
      console.error("Khalti extension initiate failed", res.status);
      throw new Error("Could not start Khalti payment. Please try again.");
    }

    await supabaseAdmin.from("payments").insert({
      booking_id: extension.booking_id,
      extension_id: extension.id,
      user_id: userId,
      provider: "khalti",
      transaction_uuid: body.pidx,
      amount,
      status: "pending",
    });

    return { provider: "khalti" as const, payment_url: body.payment_url };
  });

async function applyExtensionIfAny(supabaseAdmin: any, extensionId: string | null) {
  if (!extensionId) return;
  const { data: extension, error } = await supabaseAdmin
    .from("booking_extensions")
    .select("id, booking_id, hours, amount, status")
    .eq("id", extensionId)
    .single();
  if (error || !extension || extension.status === "paid") return;

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, end_date, total_amount")
    .eq("id", extension.booking_id)
    .single();
  if (!booking) return;

  const newEnd = new Date(new Date(booking.end_date).getTime() + extension.hours * 3600 * 1000);

  await supabaseAdmin.from("bookings").update({
    end_date: newEnd.toISOString(),
    total_amount: Number(booking.total_amount) + Number(extension.amount),
  }).eq("id", extension.booking_id);

  await supabaseAdmin.from("booking_extensions").update({ status: "paid" }).eq("id", extensionId);
}

export const initEsewaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      booking_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify booking belongs to user; use the DB amount, never trust the client.
    const { data: booking, error: bErr } = await supabase
      .from("bookings").select("id, total_amount, user_id, status")
      .eq("id", data.booking_id).single();
    if (bErr || !booking) throw new Error("Booking not found");
    if (booking.user_id !== userId) throw new Error("Forbidden");
    if (booking.status === "paid") throw new Error("Booking is already paid");

    const amount = Number(booking.total_amount);
    if (!isFinite(amount) || amount <= 0) throw new Error("Invalid booking amount");

    const transaction_uuid = `${data.booking_id}-${Date.now()}`;
    const total_amount = amount.toFixed(2);
    const signed = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_MERCHANT_CODE}`;
    const signature = await hmacSha256Base64(signed, ESEWA_SECRET);

    const origin = deriveOrigin();

    // Record pending payment via admin client — payments table no longer allows client INSERT.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      booking_id: data.booking_id,
      user_id: userId,
      provider: "esewa",
      transaction_uuid,
      amount,
      status: "pending",
    });

    return {
      action: ESEWA_FORM_URL,
      fields: {
        amount: total_amount,
        tax_amount: "0",
        total_amount,
        transaction_uuid,
        product_code: ESEWA_MERCHANT_CODE,
        product_service_charge: "0",
        product_delivery_charge: "0",
        success_url: `${origin}/payment-return?status=success`,
        failure_url: `${origin}/payment-return?status=failure`,
        signed_field_names: "total_amount,transaction_uuid,product_code",
        signature,
      },
    };
  });

export const verifyEsewaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ encoded: z.string().min(1).max(8000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Payment + booking status writes require admin client (RLS denies user UPDATE on payments
    // and restricts bookings.status updates).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Decode the eSewa base64 callback
    let json: any;
    try {
      json = JSON.parse(atob(data.encoded));
    } catch {
      throw new Error("Invalid callback payload");
    }

    const transaction_uuid = String(json.transaction_uuid ?? "");
    const total_amount = String(json.total_amount ?? "");
    const status = String(json.status ?? "");
    const providedSig = String(json.signature ?? "");
    const signedFieldNames = String(json.signed_field_names ?? "");

    if (!transaction_uuid || !total_amount || !providedSig || !signedFieldNames) {
      throw new Error("Callback missing required fields");
    }

    // Re-compute HMAC over the declared signed fields, in order, using the eSewa secret.
    const signedMessage = signedFieldNames
      .split(",")
      .map((f) => `${f.trim()}=${String(json[f.trim()] ?? "")}`)
      .join(",");
    const expectedSig = await hmacSha256Base64(signedMessage, ESEWA_SECRET);
    if (expectedSig !== providedSig) {
      // Mark the matching pending payment as failed and bail out.
      await supabaseAdmin.from("payments")
        .update({ status: "failed", raw_response: { ...json, _reason: "bad_signature" } })
        .eq("transaction_uuid", transaction_uuid)
        .eq("user_id", userId);
      throw new Error("Invalid callback signature");
    }

    // Optional cross-check with eSewa status API for an additional integrity layer.
    const url = `${ESEWA_STATUS_URL}?product_code=${ESEWA_MERCHANT_CODE}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`;
    let verifiedStatus = status;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        verifiedStatus = body.status ?? status;
      }
    } catch { /* fall back to signature-verified status from the callback */ }

    const isComplete = verifiedStatus === "COMPLETE";

    // Cross-check the callback amount against the DB amount before marking paid.
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .update({ status: isComplete ? "complete" : "failed", raw_response: json })
      .eq("transaction_uuid", transaction_uuid)
      .eq("user_id", userId)
      .select("booking_id, amount, extension_id")
      .single();
    if (error) throw new Error(error.message);

    if (isComplete && payment) {
      const callbackAmount = Number(total_amount);
      const dbAmount = Number(payment.amount);
      if (!isFinite(callbackAmount) || Math.abs(callbackAmount - dbAmount) > 0.01) {
        await supabaseAdmin.from("payments")
          .update({ status: "failed", raw_response: { ...json, _reason: "amount_mismatch" } })
          .eq("transaction_uuid", transaction_uuid)
          .eq("user_id", userId);
        return { success: false, status: "AMOUNT_MISMATCH", booking_id: payment.booking_id };
      }
      if (payment.extension_id) {
        await applyExtensionIfAny(supabaseAdmin, payment.extension_id);
      } else {
        await supabaseAdmin.from("bookings").update({ status: "paid" }).eq("id", payment.booking_id);
      }
    }
    return { success: isComplete, status: verifiedStatus, booking_id: payment?.booking_id };
  });

export const initKhaltiPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ booking_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("id, total_amount, user_id, status, bikes(name)")
      .eq("id", data.booking_id).single();
    if (bErr || !booking) throw new Error("Booking not found");
    if (booking.user_id !== userId) throw new Error("Forbidden");
    if (booking.status === "paid") throw new Error("Booking is already paid");

    const amount = Number(booking.total_amount);
    if (!isFinite(amount) || amount <= 0) throw new Error("Invalid booking amount");

    const origin = deriveOrigin();
    const paisa = Math.round(amount * 100);
    const purchase_order_id = `${data.booking_id}-${Date.now()}`;

    const res = await fetch(KHALTI_INITIATE_URL, {
      method: "POST",
      headers: {
        Authorization: `key ${KHALTI_SANDBOX_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        return_url: `${origin}/payment-return?provider=khalti`,
        website_url: origin,
        amount: paisa,
        purchase_order_id,
        purchase_order_name:
          (booking as { bikes?: { name?: string } | null }).bikes?.name ?? "RIDENEPAL rental",
      }),
    });

    const body = (await res.json().catch(() => null)) as { pidx?: string; payment_url?: string } | null;
    if (!res.ok || !body?.pidx || !body?.payment_url) {
      console.error("Khalti initiate failed", res.status);
      throw new Error("Could not start Khalti payment. Please try again.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      booking_id: data.booking_id,
      user_id: userId,
      provider: "khalti",
      transaction_uuid: body.pidx,
      amount,
      status: "pending",
    });

    return { payment_url: body.payment_url };
  });

export const verifyKhaltiPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pidx: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Khalti's lookup endpoint is the source of truth, never the return-url query params.
    const res = await fetch(KHALTI_LOOKUP_URL, {
      method: "POST",
      headers: {
        Authorization: `key ${KHALTI_SANDBOX_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pidx: data.pidx }),
    });
    const look = (await res.json().catch(() => null)) as
      | { status?: string; total_amount?: number }
      | null;
    if (!res.ok || !look?.status) throw new Error("Could not verify Khalti payment");

    const isComplete = look.status === "Completed";

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .update({ status: isComplete ? "complete" : "failed", raw_response: look })
      .eq("transaction_uuid", data.pidx)
      .eq("user_id", userId)
      .select("booking_id, amount, extension_id")
      .single();
    if (error) throw new Error(error.message);

    if (isComplete && payment) {
      const paidRupees = Number(look.total_amount ?? 0) / 100;
      if (Math.abs(paidRupees - Number(payment.amount)) > 0.01) {
        await supabaseAdmin.from("payments")
          .update({ status: "failed", raw_response: { ...look, _reason: "amount_mismatch" } })
          .eq("transaction_uuid", data.pidx)
          .eq("user_id", userId);
        return { success: false, status: "AMOUNT_MISMATCH", booking_id: payment.booking_id };
      }
      if (payment.extension_id) {
        await applyExtensionIfAny(supabaseAdmin, payment.extension_id);
      } else {
        await supabaseAdmin.from("bookings").update({ status: "paid" }).eq("id", payment.booking_id);
      }
    }

    return { success: isComplete, status: look.status, booking_id: payment?.booking_id };
  });
