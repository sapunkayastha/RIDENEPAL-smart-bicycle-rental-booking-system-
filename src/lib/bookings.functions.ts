import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      bike_id: z.string().uuid(),
      start_date: z.string().datetime(),
      end_date: z.string().datetime(),
      pickup_location: z.string().max(255).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Server-side price calculation — never trust the client
    const { data: bike, error: bikeErr } = await supabase
      .from("bikes")
      .select("id, price_per_day, available")
      .eq("id", data.bike_id)
      .single();
    if (bikeErr || !bike) throw new Error("Bike not found");
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

    // Insert via admin client — the bookings table no longer allows client INSERT.
    // userId comes from the verified JWT (requireSupabaseAuth), so it is trusted.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        bike_id: data.bike_id,
        start_date: data.start_date,
        end_date: data.end_date,
        pickup_location: data.pickup_location,
        total_amount,
        user_id: userId,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return booking;
  });

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("bookings")
      .select("*, bikes(name, image_url, type)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: booking, error } = await context.supabase
      .from("bookings")
      .select("*, bikes(name, image_url, type, specs)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    return booking;
  });
