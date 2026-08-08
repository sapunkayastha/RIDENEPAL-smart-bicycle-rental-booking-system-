
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- bikes
CREATE TABLE public.bikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'electric',
  price_per_day NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  description TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  specs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bikes TO anon, authenticated;
GRANT ALL ON public.bikes TO service_role;
ALTER TABLE public.bikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bikes public read" ON public.bikes FOR SELECT TO anon, authenticated USING (true);

-- bookings
CREATE TYPE public.booking_status AS ENUM ('pending','paid','active','completed','cancelled');
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bike_id UUID NOT NULL REFERENCES public.bikes(id) ON DELETE RESTRICT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  pickup_location TEXT,
  total_amount NUMERIC(10,2) NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookings select" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own bookings insert" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bookings update" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'esewa',
  transaction_uuid TEXT NOT NULL UNIQUE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments select" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own payments insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ride locations (gps pings)
CREATE TABLE public.ride_locations (
  id BIGSERIAL PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ride_locations_booking_idx ON public.ride_locations(booking_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.ride_locations TO authenticated;
GRANT USAGE ON SEQUENCE public.ride_locations_id_seq TO authenticated;
GRANT ALL ON public.ride_locations TO service_role;
ALTER TABLE public.ride_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ride locations select" ON public.ride_locations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ride locations insert" ON public.ride_locations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
