
-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users full access" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.collaborators;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.fiscal_deadlines;
DROP POLICY IF EXISTS "Authenticated users full access" ON public.monthly_obligations;

-- Create admin-only policies
CREATE POLICY "Admin full access" ON public.clients
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access" ON public.collaborators
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access" ON public.tasks
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access" ON public.fiscal_deadlines
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin full access" ON public.monthly_obligations
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
