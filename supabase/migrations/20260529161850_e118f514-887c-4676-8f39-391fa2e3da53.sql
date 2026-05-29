
-- 1) Move access_code into admin-only table
CREATE TABLE IF NOT EXISTS public.collaborator_secrets (
  collaborator_id uuid PRIMARY KEY,
  access_code text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaborator_secrets TO authenticated;
GRANT ALL ON public.collaborator_secrets TO service_role;

ALTER TABLE public.collaborator_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read collaborator secrets"
  ON public.collaborator_secrets FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert collaborator secrets"
  ON public.collaborator_secrets FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update collaborator secrets"
  ON public.collaborator_secrets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete collaborator secrets"
  ON public.collaborator_secrets FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing access codes
INSERT INTO public.collaborator_secrets (collaborator_id, access_code)
SELECT id, access_code FROM public.collaborators
WHERE access_code IS NOT NULL
ON CONFLICT (collaborator_id) DO UPDATE SET access_code = EXCLUDED.access_code;

-- Remove access_code from collaborators
ALTER TABLE public.collaborators DROP COLUMN IF EXISTS access_code;

-- 2) Tighten tasks write policies
DROP POLICY IF EXISTS "Authenticated can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated can delete tasks" ON public.tasks;

CREATE POLICY "Collaborators or admins can insert tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active = true)
  );

CREATE POLICY "Collaborators or admins can update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active = true)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active = true)
  );

CREATE POLICY "Collaborators or admins can delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active = true)
  );

-- 3) Tighten monthly_obligations write policies
DROP POLICY IF EXISTS "Authenticated can insert monthly_obligations" ON public.monthly_obligations;
DROP POLICY IF EXISTS "Authenticated can update monthly_obligations" ON public.monthly_obligations;

CREATE POLICY "Collaborators or admins can insert monthly_obligations"
  ON public.monthly_obligations FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active = true)
  );

CREATE POLICY "Collaborators or admins can update monthly_obligations"
  ON public.monthly_obligations FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active = true)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.collaborators c WHERE c.user_id = auth.uid() AND c.active = true)
  );

-- 4) Lock notifications inserts to self (admins also allowed)
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 5) Realtime channel authorization for notifications topic (notif:<user_id>)
CREATE POLICY "Users can subscribe to own notifications channel"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    (realtime.topic() = 'notif:' || auth.uid()::text)
    OR (realtime.topic() LIKE 'notifications%' AND has_role(auth.uid(), 'admin'::app_role))
  );

-- 6) Function search_path and revoke public execute on internal queue helpers
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
