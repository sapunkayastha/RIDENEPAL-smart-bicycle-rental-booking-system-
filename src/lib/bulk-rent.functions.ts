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
    const pool = (await import("@/lib/mysql/db.server")).default;
    await pool.execute(
      `INSERT INTO bulk_rent_requests (id, organization, contact_email, bike_count, event_date, notes)
       VALUES (:id, :organization, :contactEmail, :bikeCount, :eventDate, :notes)`,
      {
        id: crypto.randomUUID(),
        organization: data.organization,
        contactEmail: data.contact_email,
        bikeCount: data.bike_count,
        eventDate: data.event_date || null,
        notes: data.notes || null,
      },
    );

    const { notifyStaff } = await import("@/lib/notifications.functions");
    await notifyStaff({
      title: "New bulk rent request",
      body: `${data.organization} requested ${data.bike_count} bikes.`,
      link: "/admin",
    });

    return { ok: true };
  });
