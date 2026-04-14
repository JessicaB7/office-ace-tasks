
DROP POLICY "Admin can modify monthly_obligations" ON public.monthly_obligations;
DROP POLICY "Admin can update monthly_obligations" ON public.monthly_obligations;

CREATE POLICY "Authenticated can insert monthly_obligations"
ON public.monthly_obligations
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update monthly_obligations"
ON public.monthly_obligations
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);
