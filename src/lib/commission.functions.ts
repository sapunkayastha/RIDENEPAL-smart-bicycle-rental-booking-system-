import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/role-check";

async function getPool() {
  return (await import("@/lib/mysql/db.server")).default;
}

// Public — no auth required. Only exposes the bare rate number, nothing
// else, so it's safe to show on signup/login pages before login. Used
// for the commission disclaimer applicants see before they apply.
export const getPublicCommissionRate = createServerFn({ method: "GET" }).handler(async () => {
  const pool = await getPool();
  const [rows] = await pool.query("SELECT commission_rate FROM platform_settings WHERE id = 1");
  return { rate: Number((rows as { commission_rate: number }[])[0]?.commission_rate ?? 15) };
});

export const getCommissionRate = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const pool = await getPool();
    const [rows] = await pool.query("SELECT commission_rate FROM platform_settings WHERE id = 1");
    return { rate: Number((rows as { commission_rate: number }[])[0]?.commission_rate ?? 15) };
  });

export const setCommissionRate = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ rate: z.number().min(0).max(100) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const pool = await getPool();
    await pool.execute("UPDATE platform_settings SET commission_rate = :rate WHERE id = 1", {
      rate: data.rate,
    });
    return { ok: true };
  });

export const listVendorsForFilter = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT u.id AS vendor_id, vp.business_name
       FROM vendor_profiles vp JOIN users u ON u.id = vp.user_id
       WHERE vp.status = 'approved'
       ORDER BY vp.business_name ASC`,
    );
    return (rows as { vendor_id: string; business_name: string }[]).map((r) => ({
      vendorId: r.vendor_id,
      businessName: r.business_name,
    }));
  });

export const getCommissionSummary = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .inputValidator((input: { vendorId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const pool = await getPool();
    const vendorFilter = data.vendorId ? "AND bk.vendor_id = :vendorId" : "";

    const [totals] = await pool.query(
      `SELECT
         COALESCE(SUM(b.platform_commission), 0) AS total_commission,
         COALESCE(SUM(b.vendor_payout), 0) AS total_payouts,
         COUNT(*) AS paid_bookings
       FROM bookings b
       JOIN bikes bk ON bk.id = b.bike_id
       WHERE b.status IN ('paid', 'active', 'completed') AND b.platform_commission IS NOT NULL
         ${vendorFilter}`,
      { vendorId: data.vendorId },
    );

    const [rows] = await pool.query(
      `SELECT b.id, b.total_amount, b.platform_commission, b.vendor_payout, b.created_at,
              bk.name AS bike_name, bk.vendor_id, u.full_name AS vendor_name
       FROM bookings b
       JOIN bikes bk ON bk.id = b.bike_id
       LEFT JOIN users u ON u.id = bk.vendor_id
       WHERE b.status IN ('paid', 'active', 'completed') AND b.platform_commission IS NOT NULL
         ${vendorFilter}
       ORDER BY b.created_at DESC
       LIMIT 100`,
      { vendorId: data.vendorId },
    );

    return {
      totals: (
        totals as { total_commission: number; total_payouts: number; paid_bookings: number }[]
      )[0],
      bookings: rows,
    };
  });
