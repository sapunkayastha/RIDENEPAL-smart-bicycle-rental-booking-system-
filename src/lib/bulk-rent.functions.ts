import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

const requestSchema = z.object({
  vendor_id: z.string().uuid(),
  organization: z.string().trim().min(1).max(200),
  contact_email: z.string().trim().email(),
  bike_count: z.number().int().min(1).max(1000),
  event_date: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const submitBulkRentRequest = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => requestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { getMyRoleFlags } = await import("@/lib/auth/role-check");
    const { isStaff } = await getMyRoleFlags(context.userId);
    if (isStaff) {
      throw new Error(
        "Admin and Super Admin accounts can't submit bulk rental requests. Use the Admin Console to manage incoming requests instead.",
      );
    }

    const pool = await getPool();
    const [vendorRows] = await pool.query(
      "SELECT business_name FROM vendor_profiles WHERE user_id = :vendorId AND status = 'approved'",
      { vendorId: data.vendor_id },
    );
    const vendor = (vendorRows as { business_name: string }[])[0];
    if (!vendor) throw new Error("That vendor is no longer available");

    const id = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO bulk_rent_requests
         (id, user_id, vendor_id, organization, contact_email, bike_count, event_date, notes)
       VALUES (:id, :userId, :vendorId, :organization, :contactEmail, :bikeCount, :eventDate, :notes)`,
      {
        id,
        userId: context.userId,
        vendorId: data.vendor_id,
        organization: data.organization,
        contactEmail: data.contact_email,
        bikeCount: data.bike_count,
        eventDate: data.event_date || null,
        notes: data.notes || null,
      },
    );

    const { notifyUser } = await import("@/lib/notifications.functions");
    await notifyUser({
      userId: data.vendor_id,
      title: "New bulk rent request",
      body: `${data.organization} requested ${data.bike_count} bikes.`,
      link: "/vendor-dashboard",
    });

    return { ok: true };
  });

export const listMyBulkRentRequests = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT br.*, vp.business_name AS vendor_business_name, vp.business_address AS vendor_location
       FROM bulk_rent_requests br
       LEFT JOIN vendor_profiles vp ON vp.user_id = br.vendor_id
       WHERE br.user_id = :userId
       ORDER BY br.created_at DESC`,
      { userId: context.userId },
    );
    return rows;
  });

async function assertOwnsRequest(
  pool: Awaited<ReturnType<typeof getPool>>,
  requestId: string,
  vendorId: string,
) {
  const [rows] = await pool.query(
    "SELECT id, bike_count, status FROM bulk_rent_requests WHERE id = :id AND vendor_id = :vendorId",
    { id: requestId, vendorId },
  );
  const req = (rows as { id: string; bike_count: number; status: string }[])[0];
  if (!req) throw new Error("Request not found");
  return req;
}

export const listVendorBulkRequests = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT br.*, u.full_name AS customer_name
       FROM bulk_rent_requests br
       JOIN users u ON u.id = br.user_id
       WHERE br.vendor_id = :vendorId
       ORDER BY br.created_at DESC`,
      { vendorId: context.userId },
    );
    return rows;
  });

export const quoteBulkRentRequest = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        requestId: z.string().uuid(),
        pricePerBike: z.number().positive().max(100000),
        pickupLocation: z.string().trim().max(255).optional(),
        vendorNotes: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const req = await assertOwnsRequest(pool, data.requestId, context.userId);
    if (req.status !== "pending") throw new Error("This request has already been responded to");

    const total = Math.round(data.pricePerBike * req.bike_count * 100) / 100;
    await pool.execute(
      `UPDATE bulk_rent_requests
       SET status = 'quoted', price_per_bike = :price, total_amount = :total,
           pickup_location = :pickup, vendor_notes = :notes
       WHERE id = :id`,
      {
        id: data.requestId,
        price: data.pricePerBike,
        total,
        pickup: data.pickupLocation || null,
        notes: data.vendorNotes || null,
      },
    );

    const [ownerRows] = await pool.query("SELECT user_id FROM bulk_rent_requests WHERE id = :id", {
      id: data.requestId,
    });
    const customerId = (ownerRows as { user_id: string }[])[0]?.user_id;
    if (customerId) {
      const { notifyUser } = await import("@/lib/notifications.functions");
      await notifyUser({
        userId: customerId,
        title: "Bulk rent quote received",
        body: `You received a quote: NPR ${data.pricePerBike.toFixed(0)}/bike (NPR ${total.toFixed(0)} total).`,
        link: "/bulk-rent",
      });
    }

    return { ok: true };
  });

export const rejectBulkRentRequest = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) =>
    z
      .object({
        requestId: z.string().uuid(),
        reason: z.string().trim().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const req = await assertOwnsRequest(pool, data.requestId, context.userId);
    if (req.status !== "pending") throw new Error("This request has already been responded to");

    await pool.execute(
      "UPDATE bulk_rent_requests SET status = 'rejected', rejection_reason = :reason WHERE id = :id",
      { id: data.requestId, reason: data.reason },
    );

    const [ownerRows] = await pool.query("SELECT user_id FROM bulk_rent_requests WHERE id = :id", {
      id: data.requestId,
    });
    const customerId = (ownerRows as { user_id: string }[])[0]?.user_id;
    if (customerId) {
      const { notifyUser } = await import("@/lib/notifications.functions");
      await notifyUser({
        userId: customerId,
        title: "Bulk rent request declined",
        body: data.reason,
        link: "/bulk-rent",
      });
    }

    return { ok: true };
  });

export const markBulkRentPaid = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { requestId: string }) => {
    if (!input?.requestId) throw new Error("requestId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const pool = await getPool();
    const req = await assertOwnsRequest(pool, data.requestId, context.userId);
    if (req.status !== "quoted") throw new Error("Only a quoted request can be marked as paid");

    await pool.execute("UPDATE bulk_rent_requests SET status = 'paid' WHERE id = :id", {
      id: data.requestId,
    });

    const [ownerRows] = await pool.query(
      "SELECT user_id, total_amount FROM bulk_rent_requests WHERE id = :id",
      { id: data.requestId },
    );
    const owner = (ownerRows as { user_id: string; total_amount: number }[])[0];
    if (owner) {
      const { notifyUser } = await import("@/lib/notifications.functions");
      await notifyUser({
        userId: owner.user_id,
        title: "Bulk rent payment confirmed",
        body: `Your booking is confirmed — total NPR ${Number(owner.total_amount).toFixed(0)}.`,
        link: "/bulk-rent",
      });
    }

    return { ok: true };
  });
