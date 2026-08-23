import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type BikeRow = {
  id: string;
  name: string;
  type: string;
  price_per_day: number;
  image_url: string | null;
  description: string | null;
  available: number;
  specs: string | null;
};

export const listAvailableBikes = createServerFn({ method: "GET" }).handler(async () => {
  const pool = (await import("@/lib/mysql/db.server")).default;
  const [rows] = await pool.query(
    "SELECT * FROM bikes WHERE available = TRUE ORDER BY price_per_day ASC",
  );
  return rows as BikeRow[];
});

export const getBike = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const pool = (await import("@/lib/mysql/db.server")).default;
    const [rows] = await pool.query("SELECT * FROM bikes WHERE id = :id", { id: data.id });
    const bike = (rows as BikeRow[])[0];
    if (!bike) throw new Error("Bike not found");
    return bike;
  });
