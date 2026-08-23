import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  otp_verified: number;
  created_at: string;
};

type BookingSpendRow = { status: string; total_amount: number };
type RoleRow = { role: string };

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = (await import("@/lib/mysql/db.server")).default;
    const [profileRows] = await pool.query(
      "SELECT id, email, full_name, phone, otp_verified, created_at FROM users WHERE id = :id",
      { id: context.userId },
    );
    const profile = (profileRows as ProfileRow[])[0];
    if (!profile) throw new Error("Profile not found");

    const [roleRows] = await pool.query("SELECT role FROM user_roles WHERE user_id = :id", {
      id: context.userId,
    });

    const [bookingRows] = await pool.query(
      "SELECT status, total_amount FROM bookings WHERE user_id = :id",
      { id: context.userId },
    );
    const bookings = bookingRows as BookingSpendRow[];
    const spend = bookings
      .filter((b) => b.status !== "pending" && b.status !== "cancelled")
      .reduce((s, b) => s + Number(b.total_amount), 0);

    return {
      id: context.userId,
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      otp_verified: Boolean(profile.otp_verified),
      created_at: profile.created_at,
      email: profile.email,
      avatar_url: null,
      roles: (roleRows as RoleRow[]).map((r) => r.role),
      booking_count: bookings.length,
      total_spend: spend,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().trim().min(1, "Name is required").max(120),
        phone: z.string().trim().max(30).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = (await import("@/lib/mysql/db.server")).default;
    await pool.execute("UPDATE users SET full_name = :fullName, phone = :phone WHERE id = :id", {
      fullName: data.full_name,
      phone: data.phone || null,
      id: context.userId,
    });
    return { ok: true };
  });
