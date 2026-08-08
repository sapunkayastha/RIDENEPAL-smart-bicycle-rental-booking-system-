import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// 1 point per NPR 10 spent on bookings that actually completed payment.
const POINTS_PER_NPR = 1 / 10;

export const TIERS = [
  { name: "Explorer", min: 0 },
  { name: "Trailblazer", min: 1000 },
  { name: "Summit Rider", min: 5000 },
  { name: "Legend", min: 10000 },
] as const;

async function computeBalance(supabase: any, userId: string) {
  const { data: bookings, error: bErr } = await supabase
    .from("bookings")
    .select("total_amount, status")
    .eq("user_id", userId)
    .in("status", ["paid", "active", "completed"]);
  if (bErr) throw new Error(bErr.message);

  const earned = Math.floor(
    (bookings ?? []).reduce((sum: number, b: any) => sum + Number(b.total_amount), 0) * POINTS_PER_NPR,
  );

  const { data: redemptions, error: rErr } = await supabase
    .from("reward_redemptions")
    .select("points_spent")
    .eq("user_id", userId);
  if (rErr) throw new Error(rErr.message);

  const spent = (redemptions ?? []).reduce((sum: number, r: any) => sum + r.points_spent, 0);

  return { earned, spent, balance: Math.max(0, earned - spent) };
}

export const getMyRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { earned, spent, balance } = await computeBalance(supabase, userId);

    const { data: catalog, error: cErr } = await supabase
      .from("reward_catalog")
      .select("id, name, points_cost, icon_key")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (cErr) throw new Error(cErr.message);

    const { data: redemptions, error: rErr } = await supabase
      .from("reward_redemptions")
      .select("id, reward_id, points_spent, redeemed_at, reward_catalog(name)")
      .eq("user_id", userId)
      .order("redeemed_at", { ascending: false })
      .limit(20);
    if (rErr) throw new Error(rErr.message);

    const tier = [...TIERS].reverse().find((t) => balance >= t.min) ?? TIERS[0];
    const nextTier = TIERS.find((t) => t.min > balance) ?? null;

    return { earned, spent, balance, tier: tier.name, nextTier, catalog: catalog ?? [], redemptions: redemptions ?? [] };
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rewardId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { balance } = await computeBalance(supabase, userId);

    const { data: reward, error: rewardErr } = await supabase
      .from("reward_catalog")
      .select("id, points_cost, active")
      .eq("id", data.rewardId)
      .single();
    if (rewardErr || !reward) throw new Error("Reward not found");
    if (!reward.active) throw new Error("This reward is no longer available");
    if (balance < reward.points_cost) throw new Error("Not enough points for this reward");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reward_redemptions").insert({
      user_id: userId,
      reward_id: reward.id,
      points_spent: reward.points_cost,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
