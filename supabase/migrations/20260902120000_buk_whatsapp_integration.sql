-- BUK bookings -> WhatsApp confirmation + Consultoria lead integration
--
-- Adds:
--   1. leads.external_booking_id — dedupe key so the BUK poller never
--      creates the same consultoria lead twice.
--   2. public.buk_sync_state — singleton poll cursor + rate-limit cooldown,
--      mirrors public.email_send_state.
--   3. public.whatsapp_send_log — send audit trail, mirrors public.email_send_log,
--      with the same "unique sent row" safety net against duplicate sends.
--
-- The pg_cron job that calls the poll-buk-bookings Edge Function on a schedule
-- is applied dynamically (same convention as process-email-queue in
-- 20260403182022_email_infra.sql), reusing the existing vault secret
-- 'email_queue_service_role_key' to authenticate the net.http_post call.
-- See the comment block at the end of this file.

-- 1. Dedup key for bookings imported from BUK
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS external_booking_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_booking_id_unique
  ON public.leads(external_booking_id) WHERE external_booking_id IS NOT NULL;

-- 2. Poll cursor + cooldown state (singleton row)
CREATE TABLE IF NOT EXISTS public.buk_sync_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_polled_at TIMESTAMPTZ,
  last_booking_cursor TEXT,
  cooldown_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.buk_sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.buk_sync_state ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.buk_sync_state TO service_role;

DO $$ BEGIN
  CREATE POLICY "Service role manages buk sync state"
    ON public.buk_sync_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. WhatsApp send audit log
CREATE TABLE IF NOT EXISTS public.whatsapp_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_external_id TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  template_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate sends for the same booking, mirrors
-- idx_email_send_log_message_sent_unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_send_log_booking_sent_unique
  ON public.whatsapp_send_log(booking_external_id) WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_whatsapp_send_log_created ON public.whatsapp_send_log(created_at DESC);

ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.whatsapp_send_log TO authenticated;
GRANT ALL ON public.whatsapp_send_log TO service_role;

DO $$ BEGIN
  CREATE POLICY "Service role manages whatsapp send log"
    ON public.whatsapp_send_log FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view whatsapp send log"
    ON public.whatsapp_send_log FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- POST-MIGRATION STEP (applied dynamically, not tracked here —
-- same convention as process-email-queue, see 20260403182022_email_infra.sql)
-- ============================================================
--
-- CRON JOB (pg_cron)
--   Creates job 'poll-buk-bookings' on a short interval (e.g. every 2 minutes):
--     SELECT cron.schedule(
--       'poll-buk-bookings',
--       '*/2 * * * *',
--       $$
--       SELECT net.http_post(
--         url := '<SUPABASE_URL>/functions/v1/poll-buk-bookings',
--         headers := jsonb_build_object(
--           'Authorization', 'Bearer ' || (
--             SELECT decrypted_secret FROM vault.decrypted_secrets
--             WHERE name = 'email_queue_service_role_key'
--           ),
--           'Content-Type', 'application/json'
--         ),
--         body := '{}'::jsonb
--       );
--       $$
--     );
--   To revert: SELECT cron.unschedule('poll-buk-bookings');
--   Apply this only after confirming the function works via manual invocation
--   (see the Edge Function's own comments for the BUK contract assumptions
--   that still need confirming with BUK support).
