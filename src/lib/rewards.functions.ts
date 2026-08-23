import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireMysqlAuth } from "@/lib/auth/auth-middleware";

const POINTS_PER_NPR = 1 / 10;

export const TIERS = [
  { name: "Explorer", min: 0 },
  { name: "Trailblazer", min: 1000 },
  { name: "Summit Rider", min: 5000 },
  { name: "Legend", min: 10000 },
] as const;

type BookingAmountRow = { total_amount: number };
type RedemptionPointsRow = { points_spent: number };
type CatalogRow = { id: string; name: string; points_cost: number; icon_key: string | null };
type RedemptionRow = {
  id: string;
  reward_id: string;
  points_spent: number;
  redeemed_at: string;
  reward_name: string;
};
type RewardRow = { id: string; points_cost: number; active: number };

async function computeBalance(userId: string) {
  const pool = (await import("@/lib/mysql/db.server")).default;
  const [bookingRows] = await pool.query(
    `SELECT total_amount FROM bookings WHERE user_id = :userId AND status IN ('paid', 'active', 'completed')`,
    { userId },
  );
  const earned = Math.floor(
    (bookingRows as BookingAmountRow[]).reduce((sum, b) => sum + Number(b.total_amount), 0) *
      POINTS_PER_NPR,
  );

  const [redemptionRows] = await pool.query(
    "SELECT points_spent FROM reward_redemptions WHERE user_id = :userId",
    { userId },
  );
  const spent = (redemptionRows as RedemptionPointsRow[]).reduce(
    (sum, r) => sum + r.points_spent,
    0,
  );

  return { earned, spent, balance: Math.max(0, earned - spent) };
}

export const getMyRewards = createServerFn({ method: "GET" })
  .middleware([requireMysqlAuth])
  .handler(async ({ context }) => {
    const pool = (await import("@/lib/mysql/db.server")).default;
    const { earned, spent, balance } = await computeBalance(context.userId);

    const [catalogRows] = await pool.query(
      "SELECT id, name, points_cost, icon_key FROM reward_catalog WHERE active = TRUE ORDER BY sort_order ASC",
    );

    const [redemptionRows] = await pool.query(
      `SELECT rr.id, rr.reward_id, rr.points_spent, rr.redeemed_at, rc.name AS reward_name
       FROM reward_redemptions rr
       JOIN reward_catalog rc ON rc.id = rr.reward_id
       WHERE rr.user_id = :userId
       ORDER BY rr.redeemed_at DESC
       LIMIT 20`,
      { userId: context.userId },
    );

    const tier = [...TIERS].reverse().find((t) => balance >= t.min) ?? TIERS[0];
    const nextTier = TIERS.find((t) => t.min > balance) ?? null;

    return {
      earned,
      spent,
      balance,
      tier: tier.name,
      nextTier,
      catalog: catalogRows as CatalogRow[],
      redemptions: (redemptionRows as RedemptionRow[]).map((r) => ({
        ...r,
        reward_catalog: { name: r.reward_name },
      })),
    };
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireMysqlAuth])
  .inputValidator((input) => z.object({ rewardId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const pool = (await import("@/lib/mysql/db.server")).default;
    const { balance } = await computeBalance(context.userId);

    const [rewardRows] = await pool.query(
      "SELECT id, points_cost, active FROM reward_catalog WHERE id = :id",
      { id: data.rewardId },
    );
    const reward = (rewardRows as RewardRow[])[0];
    if (!reward) throw new Error("Reward not found");
    if (!reward.active) throw new Error("This reward is no longer available");
    if (balance < reward.points_cost) throw new Error("Not enough points for this reward");

    await pool.execute(
      "INSERT INTO reward_redemptions (id, user_id, reward_id, points_spent) VALUES (:id, :userId, :rewardId, :points)",
      {
        id: crypto.randomUUID(),
        userId: context.userId,
        rewardId: reward.id,
        points: reward.points_cost,
      },
    );
    return { ok: true };
  });
