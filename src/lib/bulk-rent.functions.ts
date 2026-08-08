import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const requestSchema = z.object({
  organization: z.string().trim().min(1).max(200),
  contact_email: z.string().trim().email(),
  bike_count: z.number().int().min(1).max(1000),
  event_date: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const submitBulkRentRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    // Public form — no auth required.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("bulk_rent_requests").insert({
      organization: data.organization,
      contact_email: data.contact_email,
      bike_count: data.bike_count,
      event_date: data.event_date || null,
      notes: data.notes || null,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
