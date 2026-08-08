-- Rewards system. Points are derived from real spend on completed/paid/active
-- bookings (1 point per NPR 10) rather than a separate mutable counter, so the
-- balance always reflects real activity. Redemptions are the only thing stored,
-- and can only be written by the service role (via a server function) so a
-- client can never insert an unearned redemption directly.

CREATE TABLE public.reward_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  icon_key TEXT NOT NULL DEFAULT 'gift',
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_catalog TO authenticated;
GRANT ALL ON public.reward_catalog TO service_role;
ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reward catalog public read" ON public.reward_catalog
  FOR SELECT TO authenticated USING (active = true);

CREATE TABLE public.reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.reward_catalog(id) ON DELETE RESTRICT,
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own redemptions" ON public.reward_redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policy for authenticated: redemptions are only
-- created by the redeemReward server function using the service role, after
-- it verifies the user's real, server-computed points balance.

INSERT INTO public.reward_catalog (name, points_cost, icon_key, sort_order) VALUES
  ('Free Helmet Upgrade', 500, 'gift', 1),
  ('1 Day Free Rental', 1200, 'sparkles', 2),
  ('Weekend Trail Pass', 2500, 'medal', 3),
  ('Annapurna Tour Discount 30%', 5000, 'crown', 4);
