import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";
import { assertStaff } from "@/lib/auth/role-check";

type BikeRow = {
  id: string;
  name: string;
  type: string;
  price_per_day: number;
  image_url: string | null;
  description: string | null;
  available: number;
  specs: string | null;
  stock_quantity: number;
  available_stock: number;
  vendor_id: string | null;
};

export const listAvailableBikes = createServerFn({ method: "GET" }).handler(async () => {
  const pool = (await import("@/lib/mysql/db.server")).default;
  const [rows] = await pool.query(
    `SELECT bk.*, u.full_name AS vendor_name, vp.business_name AS vendor_business_name,
            vp.location AS vendor_location
     FROM bikes bk
     LEFT JOIN users u ON u.id = bk.vendor_id
     LEFT JOIN vendor_profiles vp ON vp.user_id = bk.vendor_id
     WHERE bk.available = TRUE ORDER BY bk.price_per_day ASC`,
  );
  return rows as (BikeRow & {
    vendor_name: string | null;
    vendor_business_name: string | null;
    vendor_location: string | null;
  })[];
});

export const getBike = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const pool = (await import("@/lib/mysql/db.server")).default;
    const [rows] = await pool.query(
      `SELECT bk.*, u.full_name AS vendor_name, vp.business_name AS vendor_business_name,
              vp.location AS vendor_location
       FROM bikes bk
       LEFT JOIN users u ON u.id = bk.vendor_id
       LEFT JOIN vendor_profiles vp ON vp.user_id = bk.vendor_id
       WHERE bk.id = :id`,
      { id: data.id },
    );
    const bike = (
      rows as (BikeRow & {
        vendor_name: string | null;
        vendor_business_name: string | null;
        vendor_location: string | null;
      })[]
    )[0];
    if (!bike) throw new Error("Bike not found");
    return bike;
  });

export const listAllBikes = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;
    const [rows] = await pool.query("SELECT * FROM bikes ORDER BY created_at DESC");
    return rows as BikeRow[];
  });

const bikeInputSchema = z.object({
  name: z.string().trim().min(1).max(190),
  type: z.enum(["electric", "hybrid", "manual"]),
  price_per_day: z.number().positive().max(100000),
  image_url: z.string().trim().max(3_000_000).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  available: z.boolean(),
  motor_power: z.string().trim().max(50).optional().nullable(),
  range_km: z.number().positive().max(2000).optional().nullable(),
  gears: z.string().trim().max(50).optional().nullable(),
  weight_kg: z.number().positive().max(200).optional().nullable(),
  stock_quantity: z.number().int().min(0).max(9999),
});

export const createBike = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => bikeInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;
    const id = crypto.randomUUID();
    const specs = {
      motor_power: data.motor_power || undefined,
      range_km: data.range_km ?? undefined,
      gears: data.gears || undefined,
      weight_kg: data.weight_kg ?? undefined,
    };
    await pool.execute(
      `INSERT INTO bikes (id, name, type, price_per_day, image_url, description, available, specs,
              stock_quantity, available_stock)
       VALUES (:id, :name, :type, :price, :image, :description, :available, :specs,
              :stock, :stock)`,
      {
        id,
        name: data.name,
        type: data.type,
        price: data.price_per_day,
        image: data.image_url || null,
        description: data.description || null,
        available: data.available,
        specs: JSON.stringify(specs),
        stock: data.stock_quantity,
      },
    );
    return { id };
  });

export const updateBike = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => bikeInputSchema.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const pool = (await import("@/lib/mysql/db.server")).default;
    const specs = {
      motor_power: data.motor_power || undefined,
      range_km: data.range_km ?? undefined,
      gears: data.gears || undefined,
      weight_kg: data.weight_kg ?? undefined,
    };

    const [existingRows] = await pool.query(
      "SELECT stock_quantity, available_stock FROM bikes WHERE id = :id",
      { id: data.id },
    );
    const existing = (existingRows as { stock_quantity: number; available_stock: number }[])[0];
    if (!existing) throw new Error("Bike not found");
    const delta = data.stock_quantity - existing.stock_quantity;
    const newAvailableStock = Math.max(
      0,
      Math.min(data.stock_quantity, existing.available_stock + delta),
    );

    await pool.execute(
      `UPDATE bikes SET name = :name, type = :type, price_per_day = :price, image_url = :image,
              description = :description, available = :available, specs = :specs,
              stock_quantity = :stock, available_stock = :availableStock
       WHERE id = :id`,
      {
        id: data.id,
        name: data.name,
        type: data.type,
        price: data.price_per_day,
        image: data.image_url || null,
        description: data.description || null,
        available: data.available,
        specs: JSON.stringify(specs),
        stock: data.stock_quantity,
        availableStock: newAvailableStock,
      },
    );
    return { ok: true };
  });
