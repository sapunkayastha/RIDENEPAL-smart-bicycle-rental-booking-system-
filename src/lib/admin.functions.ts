import { createServerFn } from "@tanstack/react-start";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { getMyRoleFlags, assertStaff, assertSuperAdmin } from "@/lib/auth/role-check";
import { APP_ROLES, type AppRole } from "@/lib/roles";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  otp_verified: number;
  created_at: string;
  email: string;
  last_sign_in_at: string | null;
  email_confirmed: number;
};
type RoleRow = { user_id: string; role: string };
type BookingSpendRow = { user_id: string; status: string; total_amount: number };

export const amISuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const { isSuperAdmin } = await getMyRoleFlags(context.userId);
    return { isSuperAdmin };
  });

export const amIStaff = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    return getMyRoleFlags(context.userId);
  });

export const myRole = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const flags = await getMyRoleFlags(context.userId);
    return { ...flags, userId: context.userId };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;

    const [userRows] = await pool.query(
      `SELECT id, full_name, phone, otp_verified, created_at, email, last_sign_in_at, email_confirmed
       FROM users`,
    );
    const [roleRows] = await pool.query("SELECT user_id, role FROM user_roles");
    const [bookingRows] = await pool.query("SELECT user_id, status, total_amount FROM bookings");

    const users = userRows as UserRow[];
    const roles = roleRows as RoleRow[];
    const bookings = bookingRows as BookingSpendRow[];

    return users.map((u) => {
      const mine = bookings.filter((b) => b.user_id === u.id);
      return {
        id: u.id,
        fullName: u.full_name,
        phone: u.phone,
        otpVerified: Boolean(u.otp_verified),
        createdAt: u.created_at,
        email: u.email,
        lastSignInAt: u.last_sign_in_at,
        emailConfirmed: Boolean(u.email_confirmed),
        roles: roles.filter((r) => r.user_id === u.id).map((r) => r.role),
        bookingCount: mine.length,
        totalSpend: mine
          .filter((b) => b.status !== "pending" && b.status !== "cancelled")
          .reduce((s, b) => s + Number(b.total_amount), 0),
      };
    });
  });

export const getCustomerDetails = createServerFn({ method: "GET" })
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId is required");
    return input;
  })
  .middleware([requireMysqlAuth])
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;

    const [userRows] = await pool.query(
      `SELECT id, email, full_name, phone, address, citizenship_number,
              citizenship_front_image, citizenship_back_image,
              otp_verified, email_confirmed, last_sign_in_at, created_at
       FROM users WHERE id = :userId`,
      { userId: data.userId },
    );
    const user = (
      userRows as {
        id: string;
        email: string;
        full_name: string | null;
        phone: string | null;
        address: string | null;
        citizenship_number: string | null;
        citizenship_front_image: string | null;
        citizenship_back_image: string | null;
        otp_verified: number;
        email_confirmed: number;
        last_sign_in_at: string | null;
        created_at: string;
      }[]
    )[0];
    if (!user) throw new Error("Customer not found");

    const [roleRows] = await pool.query("SELECT role FROM user_roles WHERE user_id = :userId", {
      userId: data.userId,
    });

    const [bookingRows] = await pool.query(
      `SELECT b.id, b.status, b.total_amount, b.start_date, b.end_date, b.created_at,
              bk.name AS bike_name,
              b.renter_full_name, b.renter_address, b.renter_phone, b.citizenship_number,
              b.citizenship_front_image, b.citizenship_back_image
       FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.user_id = :userId
       ORDER BY b.created_at DESC`,
      { userId: data.userId },
    );

    type CustomerBookingRow = {
      id: string;
      status: string;
      total_amount: number;
      start_date: string;
      end_date: string;
      created_at: string;
      bike_name: string;
      renter_full_name: string | null;
      renter_address: string | null;
      renter_phone: string | null;
      citizenship_number: string | null;
      citizenship_front_image: string | null;
      citizenship_back_image: string | null;
    };

    return {
      user: {
        ...user,
        otp_verified: Boolean(user.otp_verified),
        email_confirmed: Boolean(user.email_confirmed),
      },
      roles: (roleRows as { role: string }[]).map((r) => r.role),
      bookings: bookingRows as CustomerBookingRow[],
    };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId is required");
    return input;
  })
  .middleware([requireMysqlAuth])
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");

    const pool = (await import("@/lib/mysql/db.server")).default;
    const [rows] = await pool.query(
      `SELECT u.email, ur.role FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = :userId`,
      { userId: data.userId },
    );
    const targetRows = rows as { email: string; role: string | null }[];
    if (targetRows.length === 0) throw new Error("Customer not found");
    const roles = targetRows.map((r) => r.role).filter(Boolean);
    if (roles.includes("super_admin") || roles.includes("admin")) {
      throw new Error("Only plain customer accounts can be deleted here");
    }

    const email = targetRows[0].email;

    // Record the deletion in the audit log before removing the account
    // — the email is captured in the details text, since the user row
    // itself (and any of their own past audit entries) will be gone
    // right after this due to the ON DELETE CASCADE on user_id/actor_id.
    await pool.execute(
      `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details)
       VALUES (:id, :actorId, :action, :targetType, :targetId, :details)`,
      {
        id: crypto.randomUUID(),
        actorId: context.userId,
        action: "customer_deleted",
        targetType: "user",
        targetId: data.userId,
        details: `Deleted account: ${email}`,
      },
    );

    await pool.execute("DELETE FROM users WHERE id = :userId", { userId: data.userId });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { userId: string; role: AppRole }) => {
    if (!input?.userId) throw new Error("userId is required");
    if (!APP_ROLES.includes(input.role)) throw new Error("Invalid role");
    if (input.role === "super_admin") throw new Error("Super Admin cannot be assigned here");
    if (input.role === "admin")
      throw new Error("Admin can only be granted by approving a vendor application");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot change your own role");

    const pool = (await import("@/lib/mysql/db.server")).default;
    const [existingRoleRows] = await pool.query(
      "SELECT role FROM user_roles WHERE user_id = :userId",
      { userId: data.userId },
    );
    if ((existingRoleRows as { role: string }[]).some((r) => r.role === "super_admin")) {
      throw new Error("The Super Admin's role cannot be changed");
    }

    await pool.execute("DELETE FROM user_roles WHERE user_id = :userId", { userId: data.userId });
    await pool.execute("INSERT INTO user_roles (user_id, role) VALUES (:userId, :role)", {
      userId: data.userId,
      role: data.role,
    });

    await pool.execute(
      `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details)
       VALUES (:id, :actorId, :action, :targetType, :targetId, :details)`,
      {
        id: crypto.randomUUID(),
        actorId: context.userId,
        action: "role_change",
        targetType: "user",
        targetId: data.userId,
        details: `Changed role to ${data.role}`,
      },
    );

    return { ok: true };
  });

type PendingBookingRow = {
  id: string;
  total_amount: number;
  pickup_location: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string;
  bike_name: string;
  bike_type: string;
};

export const listPendingBookings = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;

    const [rows] = await pool.query(
      `SELECT b.id, b.total_amount, b.pickup_location, b.start_date, b.end_date, b.created_at,
              u.full_name AS customer_name, u.email AS customer_email,
              bk.name AS bike_name, bk.type AS bike_type
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.status = 'pending'
       ORDER BY b.created_at ASC`,
    );

    return (rows as PendingBookingRow[]).map((r) => ({
      id: r.id,
      totalAmount: r.total_amount,
      pickupLocation: r.pickup_location,
      startDate: r.start_date,
      endDate: r.end_date,
      createdAt: r.created_at,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      bikeName: r.bike_name,
      bikeType: r.bike_type,
    }));
  });

export const verifyBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;

    const [rows] = await pool.query(
      "SELECT id, user_id, status, total_amount FROM bookings WHERE id = :id",
      { id: data.bookingId },
    );
    const booking = (
      rows as { id: string; user_id: string; status: string; total_amount: number }[]
    )[0];
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "pending") {
      throw new Error("Only pending bookings can be verified");
    }

    await pool.execute("UPDATE bookings SET status = 'paid' WHERE id = :id", {
      id: data.bookingId,
    });

    const { notifyUser } = await import("@/lib/notifications.functions");
    await notifyUser({
      userId: booking.user_id,
      title: "Booking confirmed",
      body: `Your booking for NPR ${Number(booking.total_amount).toFixed(0)} has been verified by our team and is now active.`,
      link: "/dashboard",
    });

    await pool.execute(
      `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details)
       VALUES (:id, :actorId, :action, :targetType, :targetId, :details)`,
      {
        id: crypto.randomUUID(),
        actorId: context.userId,
        action: "booking_verified",
        targetType: "booking",
        targetId: data.bookingId,
        details: null,
      },
    );

    return { ok: true };
  });

type ActiveBookingRow = {
  id: string;
  status: string;
  total_amount: number;
  start_date: string;
  end_date: string;
  documents_verified: number;
  customer_name: string | null;
  customer_email: string;
  bike_name: string;
};

export const listActiveBookings = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;
    const [rows] = await pool.query(
      `SELECT b.id, b.status, b.total_amount, b.start_date, b.end_date, b.documents_verified,
              u.full_name AS customer_name, u.email AS customer_email,
              bk.name AS bike_name
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.status IN ('paid', 'active')
       ORDER BY b.start_date ASC`,
    );
    return (rows as ActiveBookingRow[]).map((r) => ({
      id: r.id,
      status: r.status,
      totalAmount: r.total_amount,
      startDate: r.start_date,
      endDate: r.end_date,
      documentsVerified: !!r.documents_verified,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      bikeName: r.bike_name,
    }));
  });

export const markDocumentsVerified = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;
    await pool.execute("UPDATE bookings SET documents_verified = TRUE WHERE id = :id", {
      id: data.bookingId,
    });
    return { ok: true };
  });

export const completeBooking = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;

    const [rows] = await pool.query("SELECT id, bike_id, status FROM bookings WHERE id = :id", {
      id: data.bookingId,
    });
    const booking = (rows as { id: string; bike_id: string; status: string }[])[0];
    if (!booking) throw new Error("Booking not found");
    if (!["paid", "active"].includes(booking.status)) {
      throw new Error("Only active bookings can be marked completed");
    }

    await pool.execute("UPDATE bookings SET status = 'completed' WHERE id = :id", {
      id: data.bookingId,
    });

    // The bike has been returned — it's back in stock.
    await pool.execute("UPDATE bikes SET quantity = quantity + 1 WHERE id = :id", {
      id: booking.bike_id,
    });

    await pool.execute(
      `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details)
       VALUES (:id, :actorId, :action, :targetType, :targetId, :details)`,
      {
        id: crypto.randomUUID(),
        actorId: context.userId,
        action: "booking_completed",
        targetType: "booking",
        targetId: data.bookingId,
        details: null,
      },
    );

    return { ok: true };
  });

type CancelledBookingRow = {
  id: string;
  total_amount: number;
  cancelled_at: string | null;
  customer_name: string | null;
  customer_email: string;
  bike_name: string;
};

export const listCancelledBookings = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;
    const [rows] = await pool.query(
      `SELECT b.id, b.total_amount, b.cancelled_at,
              u.full_name AS customer_name, u.email AS customer_email,
              bk.name AS bike_name
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.status = 'cancelled'
       ORDER BY b.cancelled_at DESC`,
    );
    return (rows as CancelledBookingRow[]).map((r) => ({
      id: r.id,
      totalAmount: r.total_amount,
      cancelledAt: r.cancelled_at,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      bikeName: r.bike_name,
    }));
  });

export const refundBooking = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { bookingId: string; notes?: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;

    const [rows] = await pool.query("SELECT id, status FROM bookings WHERE id = :id", {
      id: data.bookingId,
    });
    const booking = (rows as { id: string; status: string }[])[0];
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "cancelled") {
      throw new Error("Only cancelled bookings can be marked refunded");
    }

    await pool.execute(
      "UPDATE bookings SET status = 'refunded', refund_notes = :notes WHERE id = :id",
      { id: data.bookingId, notes: data.notes ?? null },
    );

    await pool.execute(
      `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details)
       VALUES (:id, :actorId, :action, :targetType, :targetId, :details)`,
      {
        id: crypto.randomUUID(),
        actorId: context.userId,
        action: "booking_refunded",
        targetType: "booking",
        targetId: data.bookingId,
        details: data.notes ?? null,
      },
    );

    return { ok: true };
  });

type AuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  created_at: string;
  actor_email: string;
};

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;
    const [rows] = await pool.query(
      `SELECT al.id, al.action, al.target_type, al.target_id, al.details, al.created_at,
              u.email AS actor_email
       FROM audit_log al
       JOIN users u ON u.id = al.actor_id
       ORDER BY al.created_at DESC
       LIMIT 30`,
    );
    return (rows as AuditLogRow[]).map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      createdAt: r.created_at,
      actorEmail: r.actor_email,
    }));
  });

export const getVendorFullDetails = createServerFn({ method: "GET" })
  .inputValidator((input: { vendorId: string }) => {
    if (!input?.vendorId) throw new Error("vendorId is required");
    return input;
  })
  .middleware([requireMysqlAuth])
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;

    const [profileRows] = await pool.query(
      `SELECT u.id AS vendor_id, u.email, u.full_name, u.phone,
              vp.business_name, vp.pan_number, vp.vat_number, vp.business_address,
              vp.status, vp.id_document, vp.created_at
       FROM vendor_profiles vp JOIN users u ON u.id = vp.user_id
       WHERE vp.user_id = :vendorId`,
      { vendorId: data.vendorId },
    );
    const profile = (
      profileRows as {
        vendor_id: string;
        email: string;
        full_name: string | null;
        phone: string | null;
        business_name: string;
        pan_number: string;
        vat_number: string | null;
        business_address: string | null;
        status: string;
        id_document: string | null;
        created_at: string;
      }[]
    )[0];
    if (!profile) throw new Error("Vendor not found");

    const [bikeRows] = await pool.query(
      `SELECT bk.id, bk.name, bk.type, bk.price_per_day, bk.quantity, bk.available,
              COALESCE((
                SELECT COUNT(*) FROM bookings b
                WHERE b.bike_id = bk.id AND b.status IN ('pending', 'paid', 'active')
              ), 0) AS currently_rented
       FROM bikes bk WHERE bk.vendor_id = :vendorId
       ORDER BY bk.name ASC`,
      { vendorId: data.vendorId },
    );

    const [bookingRows] = await pool.query(
      `SELECT b.id, b.status, b.total_amount, b.platform_commission, b.vendor_payout,
              b.created_at, bk.name AS bike_name
       FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
       WHERE bk.vendor_id = :vendorId
       ORDER BY b.created_at DESC
       LIMIT 50`,
      { vendorId: data.vendorId },
    );

    type VendorBikeRow = {
      id: string;
      name: string;
      type: string;
      price_per_day: number;
      quantity: number;
      available: number;
      currently_rented: number;
    };

    type VendorBookingRow = {
      id: string;
      status: string;
      total_amount: number;
      platform_commission: number | null;
      vendor_payout: number | null;
      created_at: string;
      bike_name: string;
    };

    const [earningsRows] = await pool.query(
      `SELECT COALESCE(SUM(b.vendor_payout), 0) AS total_earned, COUNT(*) AS paid_bookings
       FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
       WHERE bk.vendor_id = :vendorId
         AND b.status IN ('paid', 'active', 'completed') AND b.vendor_payout IS NOT NULL`,
      { vendorId: data.vendorId },
    );

    return {
      profile,
      bikes: bikeRows as VendorBikeRow[],
      bookings: bookingRows as VendorBookingRow[],
      earnings: (earningsRows as { total_earned: number; paid_bookings: number }[])[0],
    };
  });
