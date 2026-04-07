
-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Admin full access" ON public.clients;
DROP POLICY IF EXISTS "Admin full access" ON public.collaborators;
DROP POLICY IF EXISTS "Admin full access" ON public.tasks;
DROP POLICY IF EXISTS "Admin full access" ON public.fiscal_deadlines;
DROP POLICY IF EXISTS "Admin full access" ON public.monthly_obligations;

-- CLIENTS: everyone reads, admin writes
CREATE POLICY "All authenticated can read clients" ON public.clients
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can modify clients" ON public.clients
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update clients" ON public.clients
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete clients" ON public.clients
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- COLLABORATORS: everyone reads, admin writes
CREATE POLICY "All authenticated can read collaborators" ON public.collaborators
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can modify collaborators" ON public.collaborators
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update collaborators" ON public.collaborators
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete collaborators" ON public.collaborators
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- TASKS: everyone reads, admin writes
CREATE POLICY "All authenticated can read tasks" ON public.tasks
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can modify tasks" ON public.tasks
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update tasks" ON public.tasks
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete tasks" ON public.tasks
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- FISCAL_DEADLINES: everyone reads, admin writes
CREATE POLICY "All authenticated can read fiscal_deadlines" ON public.fiscal_deadlines
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can modify fiscal_deadlines" ON public.fiscal_deadlines
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update fiscal_deadlines" ON public.fiscal_deadlines
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete fiscal_deadlines" ON public.fiscal_deadlines
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- MONTHLY_OBLIGATIONS: everyone reads, admin writes
CREATE POLICY "All authenticated can read monthly_obligations" ON public.monthly_obligations
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can modify monthly_obligations" ON public.monthly_obligations
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update monthly_obligations" ON public.monthly_obligations
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete monthly_obligations" ON public.monthly_obligations
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES: allow users to read their own role (needed for auth check)
CREATE POLICY "Users can read own role"
ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
