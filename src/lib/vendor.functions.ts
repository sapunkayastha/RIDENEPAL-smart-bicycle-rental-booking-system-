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
      `SELECT business_name, pan_number, vat_number, business_address, status, rejection_reason
       FROM vendor_profiles WHERE user_id = :userId`,
      { userId: context.userId },
    );
    return (
      (
        rows as {
          business_name: string;
          pan_number: string;
          vat_number: string | null;
          business_address: string | null;
          status: string;
          rejection_reason: string | null;
        }[]
      )[0] ?? null
    );
  });

export const updateMyVendorProfile = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        businessName: z.string().trim().min(1).max(190),
        panNumber: z.string().trim().min(1).max(50),
        vatNumber: z.string().trim().max(50).optional(),
        businessAddress: z.string().trim().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertApprovedVendor(context.userId);
    const pool = await getPool();
    await pool.execute(
      `UPDATE vendor_profiles
       SET business_name = :businessName, pan_number = :panNumber,
           vat_number = :vatNumber, business_address = :businessAddress
       WHERE user_id = :userId`,
      {
        userId: context.userId,
        businessName: data.businessName,
        panNumber: data.panNumber,
        vatNumber: data.vatNumber || null,
        businessAddress: data.businessAddress || null,
      },
    );
    return { ok: true };
  });

// Daily earnings breakdown for the vendor's own bookings — the "cash
// flow" view showing how much came in each day, not just a running
// total.
export const getMyVendorDailyCashFlow = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT DATE(day) AS day, COUNT(*) AS booking_count, COALESCE(SUM(amount), 0) AS earned
       FROM (
         SELECT b.created_at AS day, b.vendor_payout AS amount
         FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
         WHERE bk.vendor_id = :userId AND b.status IN ('paid', 'active', 'completed')
           AND b.vendor_payout IS NOT NULL
         UNION ALL
         SELECT br.created_at AS day, br.total_amount AS amount
         FROM bulk_rent_requests br
         WHERE br.vendor_id = :userId AND br.status = 'paid'
       ) combined
       GROUP BY DATE(day)
       ORDER BY day DESC
       LIMIT 30`,
      { userId: context.userId },
    );
    return rows as { day: string; booking_count: number; earned: number }[];
  });

export const listMyVendorBikes = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT bk.*,
              COALESCE((
                SELECT COUNT(*) FROM bookings b
                WHERE b.bike_id = bk.id AND b.status IN ('pending', 'paid', 'active')
              ), 0) AS currently_rented
       FROM bikes bk WHERE bk.vendor_id = :userId
       ORDER BY bk.name ASC`,
      { userId: context.userId },
    );
    return rows;
  });

export const getMyVendorEarnings = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();

    // Combines two revenue sources: individual bookings (through the
    // normal payment gateway, split by platform commission) and paid
    // bulk rent requests (arranged directly with the customer, so the
    // full amount is the vendor's — no platform cut). Both need to
    // show up together for a vendor to see their real total income.
    const [totals] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_earned, COUNT(*) AS paid_bookings FROM (
         SELECT b.vendor_payout AS amount
         FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
         WHERE bk.vendor_id = :userId AND b.status IN ('paid', 'active', 'completed')
           AND b.vendor_payout IS NOT NULL
         UNION ALL
         SELECT br.total_amount AS amount
         FROM bulk_rent_requests br
         WHERE br.vendor_id = :userId AND br.status = 'paid'
       ) combined`,
      { userId: context.userId },
    );

    const [rows] = await pool.query(
      `SELECT id, total_amount, platform_commission, vendor_payout, status, created_at, bike_name, source
       FROM (
         SELECT b.id, b.total_amount, b.platform_commission, b.vendor_payout, b.status,
                b.created_at, bk.name AS bike_name, 'booking' AS source
         FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
         WHERE bk.vendor_id = :userId AND b.status IN ('paid', 'active', 'completed')
           AND b.vendor_payout IS NOT NULL
         UNION ALL
         SELECT br.id, br.total_amount, 0 AS platform_commission, br.total_amount AS vendor_payout,
                br.status, br.created_at,
                CONCAT(br.organization, ' — bulk (', br.bike_count, ' bikes)') AS bike_name,
                'bulk' AS source
         FROM bulk_rent_requests br
         WHERE br.vendor_id = :userId AND br.status = 'paid'
       ) combined
       ORDER BY created_at DESC
       LIMIT 50`,
      { userId: context.userId },
    );

    return {
      totals: (totals as { total_earned: number; paid_bookings: number }[])[0],
      bookings: rows,
    };
  });

// Today / this week / this month / this year — a real at-a-glance
// dashboard rather than a flat scrollable list.
export const getMyVendorDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN DATE(day) = CURDATE() THEN amount ELSE 0 END), 0) AS today,
         COALESCE(SUM(CASE WHEN YEARWEEK(day, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END), 0) AS this_week,
         COALESCE(SUM(CASE WHEN YEAR(day) = YEAR(CURDATE()) AND MONTH(day) = MONTH(CURDATE()) THEN amount ELSE 0 END), 0) AS this_month,
         COALESCE(SUM(CASE WHEN YEAR(day) = YEAR(CURDATE()) THEN amount ELSE 0 END), 0) AS this_year
       FROM (
         SELECT b.created_at AS day, b.vendor_payout AS amount
         FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
         WHERE bk.vendor_id = :userId AND b.status IN ('paid', 'active', 'completed')
           AND b.vendor_payout IS NOT NULL
         UNION ALL
         SELECT br.created_at AS day, br.total_amount AS amount
         FROM bulk_rent_requests br
         WHERE br.vendor_id = :userId AND br.status = 'paid'
       ) combined`,
      { userId: context.userId },
    );
    return (
      rows as { today: number; this_week: number; this_month: number; this_year: number }[]
    )[0];
  });

const vendorBikeSchema = z.object({
  name: z.string().trim().min(1).max(190),
  type: z.enum(["electric", "hybrid", "manual"]),
  price_per_day: z.number().positive().max(100000),
  image_url: z.string().trim().max(3_000_000).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  available: z.boolean(),
  quantity: z.number().int().min(0).max(1000),
});

export const createVendorBike = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => vendorBikeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertApprovedVendor(context.userId);
    const pool = await getPool();
    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO bikes (id, name, type, price_per_day, image_url, description, available, quantity, vendor_id)
       VALUES (:id, :name, :type, :price, :image, :description, :available, :quantity, :vendorId)`,
      {
        id,
        name: data.name,
        type: data.type,
        price: data.price_per_day,
        image: data.image_url || null,
        description: data.description || null,
        available: data.available,
        quantity: data.quantity,
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
              description = :description, available = :available, quantity = :quantity
       WHERE id = :id AND vendor_id = :vendorId`,
      {
        id: data.id,
        name: data.name,
        type: data.type,
        price: data.price_per_day,
        image: data.image_url || null,
        description: data.description || null,
        available: data.available,
        quantity: data.quantity,
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

    const [profileRows] = await pool.query(
      "SELECT business_name FROM vendor_profiles WHERE user_id = :userId",
      { userId: data.userId },
    );
    const businessName =
      (profileRows as { business_name: string }[])[0]?.business_name ?? "This vendor";

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
    const [newRateRows] = await pool.query(
      "SELECT commission_rate FROM platform_settings WHERE id = 1",
    );
    const newRate = Number(
      (newRateRows as { commission_rate: number }[])[0]?.commission_rate ?? 15,
    );

    const { notifyUser } = await import("@/lib/notifications.functions");
    await notifyUser({
      userId: data.userId,
      title: "Vendor application approved",
      body: "You can now list bikes for rent from your vendor dashboard.",
      link: "/vendor-dashboard",
    });

    // Confirm to the superadmin that they're now earning commission
    // from this vendor, and what the rate is now.
    await notifyUser({
      userId: context.userId,
      title: `${businessName} is now linked to RideNepal`,
      body: `You'll earn commission on their bookings going forward. Your platform commission rate is now ${newRate}%.`,
      link: "/commissions",
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

// Single vendor's public storefront page (/vendor/$vendorId) — full bike
// list with pricing/stock, unlike listVendorStorefronts above which only
// returns a 3-bike preview for the directory cards.
export const getVendorStorefront = createServerFn({ method: "GET" })
  .inputValidator((input: { vendorId: string }) => input)
  .handler(async ({ data }) => {
    const pool = await getPool();

    const [vendorRows] = await pool.query(
      `SELECT vp.user_id AS vendor_id, vp.business_name, vp.business_address
       FROM vendor_profiles vp
       WHERE vp.user_id = :vendorId AND vp.status = 'approved'`,
      { vendorId: data.vendorId },
    );
    const vendor = (
      vendorRows as { vendor_id: string; business_name: string; business_address: string | null }[]
    )[0];
    if (!vendor) throw new Error("Vendor not found");

    const [reviewRows] = await pool.query(
      `SELECT COUNT(*) AS review_count, AVG(rating) AS avg_rating
       FROM vendor_reviews WHERE vendor_id = :vendorId`,
      { vendorId: data.vendorId },
    );
    const reviewStats = (reviewRows as { review_count: number; avg_rating: number | null }[])[0];

    const [bikeRows] = await pool.query(
      `SELECT id, name, type, price_per_day, image_url, stock_quantity, available_stock
       FROM bikes WHERE vendor_id = :vendorId
       ORDER BY created_at ASC`,
      { vendorId: data.vendorId },
    );

    return {
      businessName: vendor.business_name,
      location: vendor.business_address,
      reviewCount: Number(reviewStats?.review_count ?? 0),
      avgRating: reviewStats?.avg_rating != null ? Number(reviewStats.avg_rating) : null,
      bikes: bikeRows as {
        id: string;
        name: string;
        type: string;
        price_per_day: number;
        image_url: string | null;
        stock_quantity: number;
        available_stock: number;
      }[],
    };
  });

// Public directory of approved vendors who have at least one bike
// listed — used by the bulk-rent "pick a vendor" screen.
export const listVendorStorefronts = createServerFn({ method: "GET" }).handler(async () => {
  const pool = await getPool();

  // Base: every approved vendor, with bike/stock counts. No longer
  // filters out vendors with zero bikes — the homepage needs to show
  // them too (with a "No bikes listed yet" state), so any page that
  // only wants vendors with stock (like bulk-rent) filters that
  // client-side instead.
  const [vendorRows] = await pool.query(
    `SELECT vp.user_id AS vendor_id, vp.business_name, vp.business_address,
            COUNT(bk.id) AS bike_count,
            COALESCE(SUM(CASE WHEN bk.quantity > 0 THEN 1 ELSE 0 END), 0) AS in_stock_count
     FROM vendor_profiles vp
     LEFT JOIN bikes bk ON bk.vendor_id = vp.user_id
     WHERE vp.status = 'approved'
     GROUP BY vp.user_id, vp.business_name, vp.business_address
     ORDER BY vp.business_name ASC`,
  );
  const vendors = vendorRows as {
    vendor_id: string;
    business_name: string;
    business_address: string | null;
    bike_count: number;
    in_stock_count: number;
  }[];
  if (vendors.length === 0) return [];

  const vendorIds = vendors.map((v) => v.vendor_id);

  const [reviewRows] = await pool.query(
    `SELECT vendor_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
     FROM vendor_reviews WHERE vendor_id IN (:vendorIds)
     GROUP BY vendor_id`,
    { vendorIds },
  );
  const reviewsByVendor = new Map(
    (reviewRows as { vendor_id: string; review_count: number; avg_rating: number }[]).map((r) => [
      r.vendor_id,
      { reviewCount: Number(r.review_count), avgRating: Number(r.avg_rating) },
    ]),
  );

  const [bikeRows] = await pool.query(
    `SELECT id, vendor_id, name, image_url, quantity AS available_stock
     FROM bikes WHERE vendor_id IN (:vendorIds)
     ORDER BY created_at ASC`,
    { vendorIds },
  );
  const bikesByVendor = new Map<
    string,
    { id: string; name: string; image_url: string | null; available_stock: number }[]
  >();
  for (const b of bikeRows as {
    id: string;
    vendor_id: string;
    name: string;
    image_url: string | null;
    available_stock: number;
  }[]) {
    const list = bikesByVendor.get(b.vendor_id) ?? [];
    list.push({
      id: b.id,
      name: b.name,
      image_url: b.image_url,
      available_stock: b.available_stock,
    });
    bikesByVendor.set(b.vendor_id, list);
  }

  return vendors.map((v) => ({
    vendorId: v.vendor_id,
    businessName: v.business_name,
    location: v.business_address,
    bikeCount: Number(v.bike_count),
    inStockCount: Number(v.in_stock_count),
    reviewCount: reviewsByVendor.get(v.vendor_id)?.reviewCount ?? 0,
    avgRating: reviewsByVendor.get(v.vendor_id)?.avgRating ?? null,
    bikes: (bikesByVendor.get(v.vendor_id) ?? []).slice(0, 3),
  }));
});
