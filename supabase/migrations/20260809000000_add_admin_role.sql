-- Add staff "admin" role between super_admin and customer
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

CREATE POLICY "admin reads all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
