import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { getMyRoleFlags } from "@/lib/auth/role-check";

type BikeRow = { id: string; price_per_day: number; available: number };

type BookingRow = {
  id: string;
  user_id: string;
  bike_id: string;
  start_date: string;
  end_date: string;
  pickup_location: string | null;
  total_amount: number;
  status: string;
  created_at: string;
};

// Grace period after the scheduled ride start before we push it back —
// gives the customer a bit of slack before assuming they're late.
const PICKUP_GRACE_MINUTES = 60;

// If a paid booking's scheduled start has passed and the customer never
// picked up (still 'paid', never marked 'active'/'completed'/'cancelled'),
// push the whole window forward so they don't lose the ride time they
// paid for. Runs lazily whenever the customer's bookings are loaded.
async function autoExtendOverdueBookings(userId: string) {
  const pool = (await import("@/lib/mysql/db.server")).default;
  const [rows] = await pool.query(
    `SELECT id, start_date, end_date FROM bookings
     WHERE user_id = :userId AND status = 'paid'
       AND start_date < DATE_SUB(NOW(), INTERVAL :grace MINUTE)`,
    { userId, grace: PICKUP_GRACE_MINUTES },
  );
  const overdue = rows as { id: string; start_date: string; end_date: string }[];
  if (overdue.length === 0) return;

  const { notifyUser } = await import("@/lib/notifications.functions");

  for (const b of overdue) {
    const oldStart = new Date(b.start_date);
    const oldEnd = new Date(b.end_date);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const newStart = new Date();
    const newEnd = new Date(newStart.getTime() + durationMs);

    await pool.execute(
      "UPDATE bookings SET start_date = :start, end_date = :end WHERE id = :id AND status = 'paid'",
      { id: b.id, start: newStart, end: newEnd },
    );
    await notifyUser({
      userId,
      title: "Ride time extended",
      body: "You didn't pick up your bike at the scheduled time, so we've pushed your ride window forward — no time lost.",
      link: "/dashboard",
    });
  }
}

type BookingWithBike = {
  id: string;
  user_id: string;
  bike_id: string;
  start_date: string;
  end_date: string;
  pickup_location: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  bike_name: string;
  bike_image_url: string | null;
  bike_type: string;
  bike_specs?: string | null;
};

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        bike_id: z.string().uuid(),
        start_date: z.string().datetime(),
        end_date: z.string().datetime(),
        pickup_location: z.string().max(255).optional(),
        renter_full_name: z.string().trim().min(1, "Full name is required").max(190),
        renter_address: z.string().trim().min(1, "Address is required").max(255),
        renter_phone: z.string().trim().min(5, "Phone number is required").max(30),
        citizenship_number: z.string().trim().min(1, "Citizenship number is required").max(50),
        citizenship_front_image: z
          .string()
          .startsWith("data:image/", "Please upload the front of your citizenship card")
          .max(3_000_000),
        citizenship_back_image: z
          .string()
          .startsWith("data:image/", "Please upload the back of your citizenship card")
          .max(3_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isStaff } = await getMyRoleFlags(context.userId);
    if (isStaff) {
      throw new Error(
        "Admin and Super Admin accounts can't book rides. Please use a customer account to book.",
      );
    }

    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, price_per_day, available FROM bikes WHERE id = :id",
      { id: data.bike_id },
    );
    const bike = (rows as BikeRow[])[0];
    if (!bike) throw new Error("Bike not found");
    if (!bike.available) throw new Error("Bike is not available");

    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new Error("Invalid rental dates");
    }
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
    if (days > 30) throw new Error("Rental period cannot exceed 30 days");
    const total_amount = Number(bike.price_per_day) * days;

    const bookingId = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO bookings (
         id, user_id, bike_id, start_date, end_date, pickup_location, total_amount, status,
         renter_full_name, renter_address, renter_phone, citizenship_number,
         citizenship_front_image, citizenship_back_image
       )
       VALUES (
         :id, :userId, :bikeId, :startDate, :endDate, :pickup, :total, 'pending',
         :renterFullName, :renterAddress, :renterPhone, :citizenshipNumber,
         :citizenshipFront, :citizenshipBack
       )`,
      {
        id: bookingId,
        userId: context.userId,
        bikeId: data.bike_id,
        startDate: data.start_date.slice(0, 19).replace("T", " "),
        endDate: data.end_date.slice(0, 19).replace("T", " "),
        pickup: data.pickup_location ?? null,
        total: total_amount,
        renterFullName: data.renter_full_name,
        renterAddress: data.renter_address,
        renterPhone: data.renter_phone,
        citizenshipNumber: data.citizenship_number,
        citizenshipFront: data.citizenship_front_image,
        citizenshipBack: data.citizenship_back_image,
      },
    );

    // Save these details to the user's profile so next time they book,
    // the form is already filled in — no need to re-enter or re-upload.
    await pool.execute(
      `UPDATE users SET full_name = :fullName, phone = :phone, address = :address,
              citizenship_number = :citizenshipNumber,
              citizenship_front_image = :citizenshipFront,
              citizenship_back_image = :citizenshipBack
       WHERE id = :userId`,
      {
        fullName: data.renter_full_name,
        phone: data.renter_phone,
        address: data.renter_address,
        citizenshipNumber: data.citizenship_number,
        citizenshipFront: data.citizenship_front_image,
        citizenshipBack: data.citizenship_back_image,
        userId: context.userId,
      },
    );

    const { notifyStaff } = await import("@/lib/notifications.functions");
    await notifyStaff({
      title: "New booking",
      body: `A new booking was placed for NPR ${total_amount.toFixed(0)}.`,
      link: "/admin",
    });

    const [newRows] = await pool.query("SELECT * FROM bookings WHERE id = :id", { id: bookingId });
    return (newRows as BookingRow[])[0];
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await autoExtendOverdueBookings(context.userId);
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT b.*, bk.name AS bike_name, bk.image_url AS bike_image_url, bk.type AS bike_type
       FROM bookings b
       JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.user_id = :userId
       ORDER BY b.created_at DESC`,
      { userId: context.userId },
    );
    return (rows as BookingWithBike[]).map((r) => ({
      ...r,
      bikes: { name: r.bike_name, image_url: r.bike_image_url, type: r.bike_type },
    }));
  });

export const getBooking = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT b.*, bk.name AS bike_name, bk.image_url AS bike_image_url, bk.type AS bike_type, bk.specs AS bike_specs
       FROM bookings b
       JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.id = :id AND b.user_id = :userId`,
      { id: data.id, userId: context.userId },
    );
    const row = (rows as BookingWithBike[])[0];
    if (!row) throw new Error("Booking not found");
    return {
      ...row,
      bikes: {
        name: row.bike_name,
        image_url: row.bike_image_url,
        type: row.bike_type,
        specs: row.bike_specs,
      },
    };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const { isStaff } = await getMyRoleFlags(context.userId);

    const [rows] = await pool.query(
      `SELECT b.id, b.user_id, b.status, b.total_amount, bk.name AS bike_name
       FROM bookings b JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.id = :id`,
      { id: data.id },
    );
    const booking = (
      rows as {
        id: string;
        user_id: string;
        status: string;
        total_amount: number;
        bike_name: string;
      }[]
    )[0];
    if (!booking) throw new Error("Booking not found");
    if (!isStaff && booking.user_id !== context.userId) {
      throw new Error("You can only cancel your own bookings");
    }
    if (!["pending", "paid", "active"].includes(booking.status)) {
      throw new Error("This booking can no longer be cancelled");
    }

    await pool.execute(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = :actorId WHERE id = :id",
      { id: data.id, actorId: context.userId },
    );

    const { notifyStaff } = await import("@/lib/notifications.functions");
    await notifyStaff({
      title: "Booking cancelled",
      body: `${booking.bike_name} · NPR ${Number(booking.total_amount).toFixed(0)} was cancelled.`,
      link: "/admin",
    });

    await pool.execute(
      `INSERT INTO audit_log (id, actor_id, action, target_type, target_id, details)
       VALUES (:id, :actorId, :action, :targetType, :targetId, :details)`,
      {
        id: crypto.randomUUID(),
        actorId: context.userId,
        action: "booking_cancelled",
        targetType: "booking",
        targetId: data.id,
        details: null,
      },
    );

    return { ok: true };
  });
