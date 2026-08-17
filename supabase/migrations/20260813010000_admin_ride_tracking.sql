-- Allow admin/super_admin to see all riders' live locations (for the
-- admin GPS tracking dashboard). Riders can still only see their own
-- via the existing "own ride locations select" policy — Postgres
-- combines multiple SELECT policies with OR, so both rules apply.

CREATE POLICY "staff read all ride locations" ON public.ride_locations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );