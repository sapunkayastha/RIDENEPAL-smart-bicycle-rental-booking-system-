import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Gift, Sparkles, Medal, Crown, Loader2 } from "lucide-react";
import { getMyRewards, redeemReward, TIERS } from "@/lib/rewards.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/rewards")({
  component: Rewards,
  head: () => ({ meta: [{ title: "Awards & Rewards — RIDENEPAL" }] }),
});

const iconMap: Record<string, typeof Gift> = { gift: Gift, sparkles: Sparkles, medal: Medal, crown: Crown };

function Rewards() {
  const fetchRewards = useServerFn(getMyRewards);
  const redeem = useServerFn(redeemReward);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-rewards"],
    queryFn: () => fetchRewards(),
  });

  const redeemMutation = useMutation({
    mutationFn: (rewardId: string) => redeem({ data: { rewardId } }),
    onSuccess: () => {
      toast.success("Reward redeemed! Our team will be in touch to arrange it.");
      qc.invalidateQueries({ queryKey: ["my-rewards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not redeem reward"),
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-secondary/30">
        <SiteHeader />
        <main className="max-w-7xl mx-auto px-6 py-20 text-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin mx-auto mb-3" /> Loading your rewards…
        </main>
      </div>
    );
  }

  const { balance, tier, nextTier, catalog, redemptions } = data;
  const pct = nextTier ? Math.min(100, (balance / nextTier.min) * 100) : 100;

  return (
    <div className="min-h-screen bg-secondary/30">
      <SiteHeader />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Awards & Rewards</h1>
        <p className="text-muted-foreground mt-1">Every kilometer earns points. Cash them in for upgrades, free days, and elite tours.</p>

        <Card className="mt-8 p-8 border-0 shadow-sm bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm opacity-80"><Trophy className="size-4" /> Current Tier · {tier}</div>
              <div className="text-5xl font-bold mt-2">{balance.toLocaleString()} pts</div>
              <p className="text-sm opacity-80 mt-1">
                {nextTier ? `${(nextTier.min - balance).toLocaleString()} pts until ${nextTier.name}` : "You've reached the top tier!"}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Progress value={pct} className="h-2 bg-white/20" />
          </div>
        </Card>

        <h2 className="text-xl font-bold mt-12 mb-4">Tier Progression</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TIERS.map((t) => (
            <Card key={t.name} className={`p-5 border-0 shadow-sm ${t.name === tier ? "ring-2 ring-primary" : ""}`}>
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.min.toLocaleString()}+ points</div>
            </Card>
          ))}
        </div>

        <h2 className="text-xl font-bold mt-12 mb-4">Redeem Your Points</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {catalog.map((r) => {
            const Icon = iconMap[r.icon_key] ?? Gift;
            const affordable = balance >= r.points_cost;
            const pending = redeemMutation.isPending && redeemMutation.variables === r.id;
            return (
              <Card key={r.id} className="p-6 border-0 shadow-sm hover:shadow-md transition-shadow">
                <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-semibold text-sm">{r.name}</h3>
                <div className="text-primary font-bold mt-2">{r.points_cost.toLocaleString()} pts</div>
                <Button
                  size="sm"
                  className="w-full mt-4 bg-primary hover:bg-primary/90"
                  disabled={!affordable || redeemMutation.isPending}
                  onClick={() => redeemMutation.mutate(r.id)}
                >
                  {pending ? "Redeeming…" : affordable ? "Redeem" : "Locked"}
                </Button>
              </Card>
            );
          })}
        </div>

        {redemptions.length > 0 && (
          <>
            <h2 className="text-xl font-bold mt-12 mb-4">Redemption History</h2>
            <Card className="border-0 shadow-sm divide-y">
              {redemptions.map((r: any) => (
                <div key={r.id} className="p-4 flex items-center justify-between text-sm">
                  <span>{r.reward_catalog?.name ?? "Reward"}</span>
                  <span className="text-muted-foreground">{new Date(r.redeemed_at).toLocaleDateString()} · -{r.points_spent} pts</span>
                </div>
              ))}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
