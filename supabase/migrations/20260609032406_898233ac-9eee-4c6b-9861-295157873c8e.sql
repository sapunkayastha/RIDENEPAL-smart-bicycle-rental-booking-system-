-- Explicitly deny UPDATE/DELETE on payments for the authenticated role.
-- The existing INSERT/SELECT policies remain for own-payment access.
REVOKE UPDATE, DELETE ON public.payments FROM authenticated;

DROP POLICY IF EXISTS "payments deny update" ON public.payments;
CREATE POLICY "payments deny update"
ON public.payments
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "payments deny delete" ON public.payments;
CREATE POLICY "payments deny delete"
ON public.payments
FOR DELETE
TO authenticated
USING (false);