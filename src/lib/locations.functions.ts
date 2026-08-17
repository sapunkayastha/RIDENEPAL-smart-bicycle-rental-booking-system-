import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const postLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const { supabase, userId } = context;
    // Verify booking ownership
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .select("user_id")
      .eq("id", data.booking_id)
      .single();
    if (bErr || !booking) throw new Error("Booking not found");
    if (booking.user_id !== userId) throw new Error("Forbidden");

    const { error } = await supabase.from("ride_locations").insert({
      booking_id: data.booking_id,
      user_id: userId,
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getRideTrack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ booking_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: points, error } = await context.supabase
      .from("ride_locations")
      .select("lat, lng, recorded_at")
      .eq("booking_id", data.booking_id)
      .order("recorded_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return points ?? [];
  });
export const getActiveRideLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("@/lib/server-roles");
    await assertStaff(context.supabase, context.userId);

    type ActiveBooking = {
      id: string;
      user_id: string;
      status: string;
      bikes: { name: string } | null;
      profiles: { full_name: string | null } | null;
    };

    // Active bookings with their bike + customer info
    const { data: bookings, error: bErr } = await context.supabase
      .from("bookings")
      .select("id, user_id, status, bikes(name), profiles(full_name)")
      .in("status", ["paid", "active"])
      .returns<ActiveBooking[]>();
    if (bErr) throw new Error(bErr.message);

    const activeIds = (bookings ?? []).map((b) => b.id);
    if (activeIds.length === 0) return [];

    // Latest location per booking
    const { data: locations, error: lErr } = await context.supabase
      .from("ride_locations")
      .select("booking_id, lat, lng, recorded_at")
      .in("booking_id", activeIds)
      .order("recorded_at", { ascending: false });
    if (lErr) throw new Error(lErr.message);

    return (bookings ?? [])
      .map((b) => {
        const latest = (locations ?? []).find((l) => l.booking_id === b.id);
        if (!latest) return null;
        return {
          bookingId: b.id,
          bikeName: b.bikes?.name ?? "Unknown bike",
          customerName: b.profiles?.full_name ?? "Unknown customer",
          lat: latest.lat,
          lng: latest.lng,
          recordedAt: latest.recorded_at,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  });
