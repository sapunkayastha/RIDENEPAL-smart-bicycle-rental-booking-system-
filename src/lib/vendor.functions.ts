import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/role-check";
import { hashPassword } from "@/lib/auth/password";

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

// Approved-vendor check: no separate "vendor" role — a vendor IS an
// "admin", but only once their vendor_profiles row says 'approved'.
// A plain platform staff admin (assigned by superadmin, not via vendor
// signup) simply has no vendor_profiles row at all.
async function assertApprovedVendor(userId: string) {
  const pool = await getPool();
  const [rows] = await pool.query("SELECT status FROM vendor_profiles WHERE user_id = :userId", {
    userId,
  });
  const profile = (rows as { status: string }[])[0];
  if (!profile || profile.status !== "approved") {
    throw new Error("Your vendor account is not yet approved");
  }
}

// ---- Registration (creates the account + a PENDING profile only —
// no role is granted until a superadmin approves) ----

export const registerVendor = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        fullName: z.string().max(100),
        businessName: z.string().min(1).max(190),
        panNumber: z.string().min(1).max(50),
        vatNumber: z.string().max(50).optional(),
        idDocument: z
          .string()
          .startsWith("data:image/", "Please upload a valid image of your ID")
          .max(3_000_000, "Image is too large"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const pool = await getPool();
    const email = data.email.toLowerCase().trim();

    const [existing] = await pool.query("SELECT id FROM users WHERE email = :email", { email });
    if ((existing as unknown[]).length > 0)
      throw new Error("An account with this email already exists");

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(data.password);
    await pool.execute(
      `INSERT INTO users (id, email, password_hash, full_name, otp_verified, email_confirmed)
       VALUES (:id, :email, :passwordHash, :fullName, TRUE, TRUE)`,
      { id: userId, email, passwordHash, fullName: data.fullName },
    );
    // Everyone starts as a plain customer until approved as a vendor.
    await pool.execute("INSERT INTO user_roles (user_id, role) VALUES (:userId, 'customer')", {
      userId,
    });
    await pool.execute(
      `INSERT INTO vendor_profiles (user_id, business_name, pan_number, vat_number, id_document, status)
       VALUES (:userId, :businessName, :panNumber, :vatNumber, :idDocument, 'pending')`,
      {
        userId,
        businessName: data.businessName,
        panNumber: data.panNumber,
        vatNumber: data.vatNumber ?? null,
        idDocument: data.idDocument,
      },
    );

    const { notifyStaff } = await import("@/lib/notifications.functions");
    await notifyStaff({
      title: "New vendor application",
      body: `${data.businessName} applied to become a vendor.`,
      link: "/vendors",
    });

    return { ok: true };
  });

// Lets an already-logged-in user (including the super admin) apply to
// become a vendor using their EXISTING account, instead of signing up
// with a brand-new email/password. Does not touch their existing role.
export const applyAsVendorSelf = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        businessName: z.string().min(1).max(190),
        panNumber: z.string().min(1).max(50),
        vatNumber: z.string().max(50).optional(),
        idDocument: z
          .string()
          .startsWith("data:image/", "Please upload a valid image of your ID")
          .max(3_000_000, "Image is too large"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const [existing] = await pool.query(
      "SELECT status FROM vendor_profiles WHERE user_id = :userId",
      { userId: context.userId },
    );
    if ((existing as unknown[]).length > 0) {
      throw new Error("You already have a vendor application on file");
    }

    await pool.execute(
      `INSERT INTO vendor_profiles (user_id, business_name, pan_number, vat_number, id_document, status)
       VALUES (:userId, :businessName, :panNumber, :vatNumber, :idDocument, 'pending')`,
      {
        userId: context.userId,
        businessName: data.businessName,
        panNumber: data.panNumber,
        vatNumber: data.vatNumber ?? null,
        idDocument: data.idDocument,
      },
    );

    const { notifyStaff } = await import("@/lib/notifications.functions");
    await notifyStaff({
      title: "New vendor application",
      body: `${data.businessName} applied to become a vendor.`,
      link: "/vendors",
    });

    return { ok: true };
  });

// ---- Vendor's own view ----

export const getMyVendorProfile = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT business_name, pan_number, vat_number, status, rejection_reason
       FROM vendor_profiles WHERE user_id = :userId`,
      { userId: context.userId },
    );
    return (
      (
        rows as {
          business_name: string;
          pan_number: string;
          vat_number: string | null;
          status: string;
          rejection_reason: string | null;
        }[]
      )[0] ?? null
    );
  });

export const listMyVendorBikes = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT * FROM bikes WHERE vendor_id = :userId", {
      userId: context.userId,
    });
    return rows;
  });

const vendorBikeSchema = z.object({
  name: z.string().trim().min(1).max(190),
  type: z.enum(["electric", "hybrid", "manual"]),
  price_per_day: z.number().positive().max(100000),
  image_url: z.string().trim().max(3_000_000).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  available: z.boolean(),
});

export const createVendorBike = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => vendorBikeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertApprovedVendor(context.userId);
    const pool = await getPool();
    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO bikes (id, name, type, price_per_day, image_url, description, available, vendor_id)
       VALUES (:id, :name, :type, :price, :image, :description, :available, :vendorId)`,
      {
        id,
        name: data.name,
        type: data.type,
        price: data.price_per_day,
        image: data.image_url || null,
        description: data.description || null,
        available: data.available,
        vendorId: context.userId,
      },
    );
    return { id };
  });

export const updateVendorBike = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => vendorBikeSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertApprovedVendor(context.userId);
    const pool = await getPool();
    const [rows] = await pool.query("SELECT vendor_id FROM bikes WHERE id = :id", { id: data.id });
    const bike = (rows as { vendor_id: string | null }[])[0];
    if (!bike || bike.vendor_id !== context.userId) throw new Error("Bike not found");

    await pool.execute(
      `UPDATE bikes SET name = :name, type = :type, price_per_day = :price, image_url = :image,
              description = :description, available = :available
       WHERE id = :id AND vendor_id = :vendorId`,
      {
        id: data.id,
        name: data.name,
        type: data.type,
        price: data.price_per_day,
        image: data.image_url || null,
        description: data.description || null,
        available: data.available,
        vendorId: context.userId,
      },
    );
    return { ok: true };
  });

// ---- Superadmin approval ----

export const listPendingVendors = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, u.email, u.full_name, vp.business_name, vp.pan_number,
              vp.vat_number, vp.id_document, vp.created_at
       FROM vendor_profiles vp JOIN users u ON u.id = vp.user_id
       WHERE vp.status = 'pending' ORDER BY vp.created_at ASC`,
    );
    return rows;
  });

export const approveVendor = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => input)
  .middleware([requireMysqlAuth])
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const pool = await getPool();

    await pool.execute(
      `UPDATE vendor_profiles SET status = 'approved', reviewed_by = :reviewer, reviewed_at = NOW()
       WHERE user_id = :userId`,
      { userId: data.userId, reviewer: context.userId },
    );

    // Grant "admin" only now, at approval — never at signup.
    // uniq_user_role (user_id, role) makes this safe to run even if
    // they somehow already had the row.
    await pool.execute("INSERT IGNORE INTO user_roles (user_id, role) VALUES (:userId, 'admin')", {
      userId: data.userId,
    });

    // Every new vendor that joins nudges the platform's commission
    // rate up slightly — capped so it can never run away to something
    // unreasonable. Superadmin can still override it manually anytime
    // from /commissions.
    const COMMISSION_STEP = 1; // percentage points per new vendor
    const COMMISSION_CAP = 50; // never auto-climb past this
    await pool.execute(
      `UPDATE platform_settings
       SET commission_rate = LEAST(commission_rate + :step, :cap)
       WHERE id = 1`,
      { step: COMMISSION_STEP, cap: COMMISSION_CAP },
    );

    const { notifyUser } = await import("@/lib/notifications.functions");
    await notifyUser({
      userId: data.userId,
      title: "Vendor application approved",
      body: "You can now list bikes for rent from your vendor dashboard.",
      link: "/vendor-dashboard",
    });

    return { ok: true };
  });

export const rejectVendor = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; reason: string }) => {
    if (!input.reason?.trim()) throw new Error("A rejection reason is required");
    return input;
  })
  .middleware([requireMysqlAuth])
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const pool = await getPool();
    await pool.execute(
      `UPDATE vendor_profiles SET status = 'rejected', rejection_reason = :reason,
              reviewed_by = :reviewer, reviewed_at = NOW()
       WHERE user_id = :userId`,
      { userId: data.userId, reason: data.reason, reviewer: context.userId },
    );

    const { notifyUser } = await import("@/lib/notifications.functions");
    await notifyUser({
      userId: data.userId,
      title: "Vendor application rejected",
      body: data.reason,
      link: "/vendor-dashboard",
    });

    return { ok: true };
  });

// ---- Reviews ----

export const submitVendorReview = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        bookingId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT b.status, bk.vendor_id
       FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.id = :id AND b.user_id = :userId`,
      { id: data.bookingId, userId: context.userId },
    );
    const booking = (rows as { status: string; vendor_id: string | null }[])[0];
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "completed") throw new Error("You can only review a completed trip");
    if (!booking.vendor_id) throw new Error("This bike wasn't listed by a vendor");

    await pool.execute(
      `INSERT INTO vendor_reviews (id, booking_id, vendor_id, user_id, rating, comment)
       VALUES (:id, :bookingId, :vendorId, :userId, :rating, :comment)`,
      {
        id: crypto.randomUUID(),
        bookingId: data.bookingId,
        vendorId: booking.vendor_id,
        userId: context.userId,
        rating: data.rating,
        comment: data.comment ?? null,
      },
    );
    return { ok: true };
  });

export const listVendorReviews = createServerFn({ method: "GET" })
  .inputValidator((input: { vendorId: string }) => input)
  .handler(async ({ data }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT rating, comment, created_at FROM vendor_reviews
       WHERE vendor_id = :vendorId ORDER BY created_at DESC LIMIT 20`,
      { vendorId: data.vendorId },
    );
    return rows;
  });
