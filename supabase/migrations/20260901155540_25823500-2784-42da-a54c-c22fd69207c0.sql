DROP POLICY IF EXISTS "Admin can update clients" ON public.clients;

CREATE POLICY "Authenticated can update clients" ON public.clients
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);