import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";

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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
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
      `INSERT INTO bookings (id, user_id, bike_id, start_date, end_date, pickup_location, total_amount, status)
       VALUES (:id, :userId, :bikeId, :startDate, :endDate, :pickup, :total, 'pending')`,
      {
        id: bookingId,
        userId: context.userId,
        bikeId: data.bike_id,
        startDate: data.start_date.slice(0, 19).replace("T", " "),
        endDate: data.end_date.slice(0, 19).replace("T", " "),
        pickup: data.pickup_location ?? null,
        total: total_amount,
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
