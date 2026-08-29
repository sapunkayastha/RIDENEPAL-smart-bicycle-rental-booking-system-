import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";

// eSewa sandbox credentials (public test creds documented by eSewa)
const ESEWA_MERCHANT_CODE = "EPAYTEST";
const ESEWA_SECRET = "8gBm/:&EnhH.1/q";
const ESEWA_FORM_URL = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
const ESEWA_STATUS_URL = "https://rc.esewa.com.np/api/epay/transaction/status/";

// Khalti sandbox credentials (public test key documented by Khalti for dev.khalti.com).
const KHALTI_SANDBOX_SECRET = "live_secret_key_68791341fdd94846a146f0457ff7b455";
const KHALTI_INITIATE_URL = "https://dev.khalti.com/api/v2/epayment/initiate/";
const KHALTI_LOOKUP_URL = "https://dev.khalti.com/api/v2/epayment/lookup/";

type BookingRow = {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  price_per_day?: number;
  bike_name?: string;
};

type ExtensionRow = {
  id: string;
  booking_id: string;
  user_id: string;
  hours: number;
  amount: number;
  status: string;
};

type PaymentUpdateResult = {
  booking_id: string;
  amount: number;
  extension_id: string | null;
};

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

async function hmacSha256Base64(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  let bin = "";
  const bytes = new Uint8Array(sig);
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function deriveOrigin(): string {
  const envOrigin = process.env.APP_ORIGIN;
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  const req = getRequest();
  const origin = req?.headers.get("origin");
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, "");
  const referer = req?.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }
  const host = req?.headers.get("host");
  if (host) {
    const proto = req?.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  throw new Error("Could not determine request origin");
}

export const requestExtension = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        booking_id: z.string().uuid(),
        hours: z.number().int().min(1).max(168),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT b.id, b.user_id, b.status, bk.price_per_day
       FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.id = :id`,
      { id: data.booking_id },
    );
    const booking = (rows as BookingRow[])[0];
    if (!booking) throw new Error("Booking not found");
    if (booking.user_id !== context.userId) throw new Error("Forbidden");
    if (booking.status !== "paid" && booking.status !== "active") {
      throw new Error("Only paid or active bookings can be extended");
    }

    const pricePerDay = Number(booking.price_per_day ?? 0);
    if (!isFinite(pricePerDay) || pricePerDay <= 0)
      throw new Error("Could not price this extension");
    const hourlyRate = pricePerDay / 24;
    const amount = Math.round(hourlyRate * data.hours * 100) / 100;

    await pool.execute(
      `INSERT INTO booking_extensions (booking_id, user_id, hours, amount, status)
       VALUES (:bookingId, :userId, :hours, :amount, 'pending')`,
      { bookingId: data.booking_id, userId: context.userId, hours: data.hours, amount },
    );
    const [newRows] = await pool.query(
      "SELECT id, hours, amount FROM booking_extensions WHERE booking_id = :bookingId ORDER BY created_at DESC LIMIT 1",
      { bookingId: data.booking_id },
    );
    return (newRows as ExtensionRow[])[0];
  });

export const initExtensionPayment = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        extension_id: z.string().uuid(),
        provider: z.enum(["esewa", "khalti"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, booking_id, user_id, amount, status FROM booking_extensions WHERE id = :id",
      { id: data.extension_id },
    );
    const extension = (rows as ExtensionRow[])[0];
    if (!extension) throw new Error("Extension not found");
    if (extension.user_id !== context.userId) throw new Error("Forbidden");
    if (extension.status === "paid") throw new Error("Extension already paid");

    const amount = Number(extension.amount);
    const origin = deriveOrigin();

    if (data.provider === "esewa") {
      const transaction_uuid = `ext-${data.extension_id}-${Date.now()}`;
      const total_amount = amount.toFixed(2);
      const signed = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_MERCHANT_CODE}`;
      const signature = await hmacSha256Base64(signed, ESEWA_SECRET);

      await pool.execute(
        `INSERT INTO payments (booking_id, extension_id, user_id, provider, transaction_uuid, amount, status)
         VALUES (:bookingId, :extensionId, :userId, 'esewa', :txnId, :amount, 'pending')`,
        {
          bookingId: extension.booking_id,
          extensionId: extension.id,
          userId: context.userId,
          txnId: transaction_uuid,
          amount,
        },
      );

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
          success_url: `${origin}/payment-return`,
          failure_url: `${origin}/payment-return`,
          signed_field_names: "total_amount,transaction_uuid,product_code",
          signature,
        },
      };
    }

    const paisa = Math.round(amount * 100);
    const purchase_order_id = `ext-${data.extension_id}-${Date.now()}`;
    const res = await fetch(KHALTI_INITIATE_URL, {
      method: "POST",
      headers: {
        Authorization: `key ${KHALTI_SANDBOX_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        return_url: `${origin}/payment-return`,
        website_url: origin,
        amount: paisa,
        purchase_order_id,
        purchase_order_name: "RIDENEPAL rental extension",
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      pidx?: string;
      payment_url?: string;
    } | null;
    if (!res.ok || !body?.pidx || !body?.payment_url) {
      console.error("Khalti extension initiate failed", res.status);
      throw new Error("Could not start Khalti payment. Please try again.");
    }

    await pool.execute(
      `INSERT INTO payments (booking_id, extension_id, user_id, provider, transaction_uuid, amount, status)
       VALUES (:bookingId, :extensionId, :userId, 'khalti', :txnId, :amount, 'pending')`,
      {
        bookingId: extension.booking_id,
        extensionId: extension.id,
        userId: context.userId,
        txnId: body.pidx,
        amount,
      },
    );

    return { provider: "khalti" as const, payment_url: body.payment_url };
  });

async function applyExtensionIfAny(extensionId: string | null) {
  if (!extensionId) return;
  const pool = await getPool();
  const [rows] = await pool.query(
    "SELECT id, booking_id, hours, amount, status FROM booking_extensions WHERE id = :id",
    { id: extensionId },
  );
  const extension = (rows as ExtensionRow[])[0];
  if (!extension || extension.status === "paid") return;

  const [bookingRows] = await pool.query(
    "SELECT id, end_date, total_amount FROM bookings WHERE id = :id",
    { id: extension.booking_id },
  );
  const booking = (bookingRows as { id: string; end_date: string; total_amount: number }[])[0];
  if (!booking) return;

  const newEnd = new Date(new Date(booking.end_date).getTime() + extension.hours * 3600 * 1000);
  const newEndStr = newEnd.toISOString().slice(0, 19).replace("T", " ");

  await pool.execute(
    "UPDATE bookings SET end_date = :endDate, total_amount = :total WHERE id = :id",
    {
      endDate: newEndStr,
      total: Number(booking.total_amount) + Number(extension.amount),
      id: extension.booking_id,
    },
  );
  await pool.execute("UPDATE booking_extensions SET status = 'paid' WHERE id = :id", {
    id: extensionId,
  });
}

export const initEsewaPayment = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ booking_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, total_amount, user_id, status FROM bookings WHERE id = :id",
      { id: data.booking_id },
    );
    const booking = (rows as BookingRow[])[0];
    if (!booking) throw new Error("Booking not found");
    if (booking.user_id !== context.userId) throw new Error("Forbidden");
    if (booking.status === "paid") throw new Error("Booking is already paid");

    const amount = Number(booking.total_amount);
    if (!isFinite(amount) || amount <= 0) throw new Error("Invalid booking amount");

    const transaction_uuid = `${data.booking_id}-${Date.now()}`;
    const total_amount = amount.toFixed(2);
    const signed = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_MERCHANT_CODE}`;
    const signature = await hmacSha256Base64(signed, ESEWA_SECRET);
    const origin = deriveOrigin();

    await pool.execute(
      `INSERT INTO payments (booking_id, user_id, provider, transaction_uuid, amount, status)
       VALUES (:bookingId, :userId, 'esewa', :txnId, :amount, 'pending')`,
      { bookingId: data.booking_id, userId: context.userId, txnId: transaction_uuid, amount },
    );

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
        success_url: `${origin}/payment-return`,
        failure_url: `${origin}/payment-return`,
        signed_field_names: "total_amount,transaction_uuid,product_code",
        signature,
      },
    };
  });

export const verifyEsewaPayment = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ encoded: z.string().min(1).max(8000) }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const userId = context.userId;

    let json: Record<string, string>;
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

    const signedMessage = signedFieldNames
      .split(",")
      .map((f) => `${f.trim()}=${String(json[f.trim()] ?? "")}`)
      .join(",");
    const expectedSig = await hmacSha256Base64(signedMessage, ESEWA_SECRET);

    if (expectedSig !== providedSig) {
      await pool.execute(
        `UPDATE payments SET status = 'failed', raw_response = :raw
         WHERE transaction_uuid = :txnId AND user_id = :userId`,
        {
          raw: JSON.stringify({ ...json, _reason: "bad_signature" }),
          txnId: transaction_uuid,
          userId,
        },
      );
      throw new Error("Invalid callback signature");
    }

    const url = `${ESEWA_STATUS_URL}?product_code=${ESEWA_MERCHANT_CODE}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`;
    let verifiedStatus = status;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        verifiedStatus = body.status ?? status;
      }
    } catch {
      /* fall back to signature-verified status */
    }

    const isComplete = verifiedStatus === "COMPLETE";

    const [preRows] = await pool.query(
      "SELECT booking_id, amount, extension_id FROM payments WHERE transaction_uuid = :txnId AND user_id = :userId",
      { txnId: transaction_uuid, userId },
    );
    const payment = (preRows as PaymentUpdateResult[])[0];
    if (!payment) throw new Error("Payment record not found");

    await pool.execute(
      "UPDATE payments SET status = :status, raw_response = :raw WHERE transaction_uuid = :txnId AND user_id = :userId",
      {
        status: isComplete ? "complete" : "failed",
        raw: JSON.stringify(json),
        txnId: transaction_uuid,
        userId,
      },
    );

    if (isComplete) {
      const callbackAmount = Number(total_amount);
      const dbAmount = Number(payment.amount);
      if (!isFinite(callbackAmount) || Math.abs(callbackAmount - dbAmount) > 0.01) {
        await pool.execute(
          "UPDATE payments SET status = 'failed', raw_response = :raw WHERE transaction_uuid = :txnId AND user_id = :userId",
          {
            raw: JSON.stringify({ ...json, _reason: "amount_mismatch" }),
            txnId: transaction_uuid,
            userId,
          },
        );
        return { success: false, status: "AMOUNT_MISMATCH", booking_id: payment.booking_id };
      }
      if (payment.extension_id) {
        await applyExtensionIfAny(payment.extension_id);
      } else {
        await pool.execute("UPDATE bookings SET status = 'paid' WHERE id = :id", {
          id: payment.booking_id,
        });
      }
    }
    return { success: isComplete, status: verifiedStatus, booking_id: payment.booking_id };
  });

export const initKhaltiPayment = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ booking_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT b.id, b.total_amount, b.user_id, b.status, bk.name AS bike_name
       FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.id = :id`,
      { id: data.booking_id },
    );
    const booking = (rows as BookingRow[])[0];
    if (!booking) throw new Error("Booking not found");
    if (booking.user_id !== context.userId) throw new Error("Forbidden");
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
        return_url: `${origin}/payment-return`,
        website_url: origin,
        amount: paisa,
        purchase_order_id,
        purchase_order_name: booking.bike_name ?? "RIDENEPAL rental",
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      pidx?: string;
      payment_url?: string;
    } | null;
    if (!res.ok || !body?.pidx || !body?.payment_url) {
      console.error("Khalti initiate failed", res.status);
      throw new Error("Could not start Khalti payment. Please try again.");
    }

    await pool.execute(
      `INSERT INTO payments (booking_id, user_id, provider, transaction_uuid, amount, status)
       VALUES (:bookingId, :userId, 'khalti', :txnId, :amount, 'pending')`,
      { bookingId: data.booking_id, userId: context.userId, txnId: body.pidx, amount },
    );

    return { payment_url: body.payment_url };
  });

export const verifyKhaltiPayment = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ pidx: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const userId = context.userId;

    const res = await fetch(KHALTI_LOOKUP_URL, {
      method: "POST",
      headers: {
        Authorization: `key ${KHALTI_SANDBOX_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pidx: data.pidx }),
    });
    const look = (await res.json().catch(() => null)) as {
      status?: string;
      total_amount?: number;
    } | null;
    if (!res.ok || !look?.status) throw new Error("Could not verify Khalti payment");

    const isComplete = look.status === "Completed";

    const [preRows] = await pool.query(
      "SELECT booking_id, amount, extension_id FROM payments WHERE transaction_uuid = :txnId AND user_id = :userId",
      { txnId: data.pidx, userId },
    );
    const payment = (preRows as PaymentUpdateResult[])[0];
    if (!payment) throw new Error("Payment record not found");

    await pool.execute(
      "UPDATE payments SET status = :status, raw_response = :raw WHERE transaction_uuid = :txnId AND user_id = :userId",
      {
        status: isComplete ? "complete" : "failed",
        raw: JSON.stringify(look),
        txnId: data.pidx,
        userId,
      },
    );

    if (isComplete) {
      const paidRupees = Number(look.total_amount ?? 0) / 100;
      if (Math.abs(paidRupees - Number(payment.amount)) > 0.01) {
        await pool.execute(
          "UPDATE payments SET status = 'failed', raw_response = :raw WHERE transaction_uuid = :txnId AND user_id = :userId",
          {
            raw: JSON.stringify({ ...look, _reason: "amount_mismatch" }),
            txnId: data.pidx,
            userId,
          },
        );
        return { success: false, status: "AMOUNT_MISMATCH", booking_id: payment.booking_id };
      }
      if (payment.extension_id) {
        await applyExtensionIfAny(payment.extension_id);
      } else {
        await pool.execute("UPDATE bookings SET status = 'paid' WHERE id = :id", {
          id: payment.booking_id,
        });
      }
    }

    return { success: isComplete, status: look.status, booking_id: payment.booking_id };
  });
