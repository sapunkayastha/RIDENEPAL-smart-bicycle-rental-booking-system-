
-- Bookings: remove client insert (server fn will use service_role)
DROP POLICY IF EXISTS "own bookings insert" ON public.bookings;
REVOKE INSERT ON public.bookings FROM authenticated;

-- Bookings: restrict update to pickup_location only (no status/amount/date tampering)
DROP POLICY IF EXISTS "own bookings update" ON public.bookings;
CREATE POLICY "own bookings update pickup only"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (SELECT status FROM public.bookings b WHERE b.id = bookings.id)
    AND total_amount = (SELECT total_amount FROM public.bookings b WHERE b.id = bookings.id)
    AND bike_id = (SELECT bike_id FROM public.bookings b WHERE b.id = bookings.id)
    AND start_date = (SELECT start_date FROM public.bookings b WHERE b.id = bookings.id)
    AND end_date = (SELECT end_date FROM public.bookings b WHERE b.id = bookings.id)
    AND user_id = (SELECT user_id FROM public.bookings b WHERE b.id = bookings.id)
  );

-- Payments: remove client insert (only verifyEsewaPayment may write payments, via service_role)
DROP POLICY IF EXISTS "own payments insert" ON public.payments;
REVOKE INSERT ON public.payments FROM authenticated;
