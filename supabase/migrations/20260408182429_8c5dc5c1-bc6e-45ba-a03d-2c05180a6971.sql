
DROP POLICY "Admin can modify tasks" ON public.tasks;
DROP POLICY "Admin can update tasks" ON public.tasks;
DROP POLICY "Admin can delete tasks" ON public.tasks;

CREATE POLICY "Authenticated can insert tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update tasks"
ON public.tasks FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete tasks"
ON public.tasks FOR DELETE TO authenticated
USING (true);
