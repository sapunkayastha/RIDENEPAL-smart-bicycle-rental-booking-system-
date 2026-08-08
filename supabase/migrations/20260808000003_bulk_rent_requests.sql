CREATE TABLE public.bulk_rent_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  bike_count INTEGER NOT NULL CHECK (bike_count > 0),
  event_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new | contacted | closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.bulk_rent_requests TO service_role;
ALTER TABLE public.bulk_rent_requests ENABLE ROW LEVEL SECURITY;
-- Written only via server function (service role) so anyone can submit the
-- public form without needing an account; read only by super admins.
CREATE POLICY "super admins read bulk requests" ON public.bulk_rent_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
