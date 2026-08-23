import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { assertStaff } from "@/lib/auth/role-check";

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

type BookingOwnerRow = { user_id: string };
type LocationPointRow = { lat: number; lng: number; recorded_at: string };

export const postLocation = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        booking_id: z.string().uuid(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy: z.number().min(0).max(100000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = await getPool();

    const [rows] = await pool.query("SELECT user_id FROM bookings WHERE id = :id", {
      id: data.booking_id,
    });
    const booking = (rows as BookingOwnerRow[])[0];
    if (!booking) throw new Error("Booking not found");
    if (booking.user_id !== context.userId) throw new Error("Forbidden");

    await pool.execute(
      `INSERT INTO ride_locations (booking_id, user_id, lat, lng, accuracy)
       VALUES (:bookingId, :userId, :lat, :lng, :accuracy)`,
      {
        bookingId: data.booking_id,
        userId: context.userId,
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy ?? null,
      },
    );
    return { ok: true };
  });

export const getRideTrack = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ booking_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT lat, lng, recorded_at FROM ride_locations
       WHERE booking_id = :bookingId
       ORDER BY recorded_at ASC
       LIMIT 500`,
      { bookingId: data.booking_id },
    );
    return rows as LocationPointRow[];
  });

type ActiveBooking = {
  id: string;
  user_id: string;
  status: string;
  bike_name: string | null;
  full_name: string | null;
};

export const getActiveRideLocations = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const pool = await getPool();

    const [bookingRows] = await pool.query(
      `SELECT b.id, b.user_id, b.status, bk.name AS bike_name, u.full_name
       FROM bookings b
       JOIN bikes bk ON bk.id = b.bike_id
       JOIN users u ON u.id = b.user_id
       WHERE b.status IN ('paid', 'active')`,
    );
    const bookings = bookingRows as ActiveBooking[];
    const activeIds = bookings.map((b) => b.id);
    if (activeIds.length === 0) return [];

    const [locationRows] = await pool.query(
      `SELECT booking_id, lat, lng, recorded_at FROM ride_locations
       WHERE booking_id IN (:ids)
       ORDER BY recorded_at DESC`,
      { ids: activeIds },
    );
    const locations = locationRows as {
      booking_id: string;
      lat: number;
      lng: number;
      recorded_at: string;
    }[];

    return bookings
      .map((b) => {
        const latest = locations.find((l) => l.booking_id === b.id);
        if (!latest) return null;
        return {
          bookingId: b.id,
          bikeName: b.bike_name ?? "Unknown bike",
          customerName: b.full_name ?? "Unknown customer",
          lat: latest.lat,
          lng: latest.lng,
          recordedAt: latest.recorded_at,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  });
