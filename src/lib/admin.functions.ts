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
    // Any staff member (admin or super_admin) can view the customer/staff
    // list — only changing roles is restricted further, in setUserRole.
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

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { userId: string; role: AppRole }) => {
    if (!input?.userId) throw new Error("userId is required");
    if (!APP_ROLES.includes(input.role)) throw new Error("Invalid role");
    return input;
  })
  .handler(async ({ data, context }) => {
    // Role management is super_admin only — an admin can never grant
    // themselves or anyone else admin or super_admin privileges.
    await assertSuperAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot change your own role");

    const pool = (await import("@/lib/mysql/db.server")).default;
    await pool.execute("DELETE FROM user_roles WHERE user_id = :userId", { userId: data.userId });
    await pool.execute("INSERT INTO user_roles (user_id, role) VALUES (:userId, :role)", {
      userId: data.userId,
      role: data.role,
    });
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
    // Any staff member can verify a pending booking (same access rule as listCustomers).
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
    // Any staff member can verify — matches the "admin and super admin can
    // verify" requirement. Role changes remain super_admin-only (setUserRole).
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

    return { ok: true };
  });
