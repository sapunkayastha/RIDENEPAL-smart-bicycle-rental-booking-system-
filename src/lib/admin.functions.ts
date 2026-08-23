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
