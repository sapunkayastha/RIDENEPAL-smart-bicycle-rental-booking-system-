-- Booking extensions: adding rental time to an already-paid/active booking.
-- Reuses the existing eSewa/Khalti payment gateways — an extension payment
-- goes through the same signature verification, and on success the verify
-- functions apply the extension (push out end_date, add to total_amount)
-- instead of just re-marking the booking "paid".

CREATE TABLE public.booking_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours INTEGER NOT NULL CHECK (hours > 0 AND hours <= 168),
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.booking_extensions TO authenticated;
GRANT ALL ON public.booking_extensions TO service_role;
ALTER TABLE public.booking_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own extensions" ON public.booking_extensions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No client INSERT/UPDATE: created and settled only by server functions
-- using the service role, same pattern as bookings/payments.

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS extension_id UUID REFERENCES public.booking_extensions(id) ON DELETE SET NULL;
