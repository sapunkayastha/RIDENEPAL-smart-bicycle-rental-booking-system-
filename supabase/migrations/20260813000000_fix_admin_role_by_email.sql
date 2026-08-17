-- Assign roles based on fixed admin emails instead of "first signup wins".
-- sapunshrestha1234@gmail.com -> super_admin
-- sapunkayastha9988@gmail.com -> admin
-- everyone else -> customer

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  assigned_role := CASE
    WHEN NEW.email = 'sapunshrestha1234@gmail.com' THEN 'super_admin'::public.app_role
    WHEN NEW.email = 'sapunkayastha9988@gmail.com' THEN 'admin'::public.app_role
    ELSE 'customer'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill: recalculate roles for every existing user using the same rule.
DELETE FROM public.user_roles;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
  CASE
    WHEN u.email = 'sapunshrestha1234@gmail.com' THEN 'super_admin'::public.app_role
    WHEN u.email = 'sapunkayastha9988@gmail.com' THEN 'admin'::public.app_role
    ELSE 'customer'::public.app_role
  END
FROM auth.users u;