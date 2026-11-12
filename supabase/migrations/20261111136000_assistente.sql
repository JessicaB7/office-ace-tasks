-- Assistente dentro da app (edge functions "assistente" e "sync-manuais").
-- manual_pages: cópia de texto das páginas do Notion "Manual · Técnica de contabilidade"
--               (sincronizada uma vez por dia pela sync-manuais, com o secret NOTION_TOKEN).
-- assistant_log: cada uso do assistente (quem, cliente, ação, data) — sem conteúdo.

CREATE TABLE IF NOT EXISTS public.manual_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  url TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_pages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.manual_pages TO authenticated;
GRANT ALL ON public.manual_pages TO service_role;
DROP POLICY IF EXISTS "Equipa vê os manuais sincronizados" ON public.manual_pages;
CREATE POLICY "Equipa vê os manuais sincronizados" ON public.manual_pages
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.assistant_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assistant_log_created ON public.assistant_log(created_at DESC);

ALTER TABLE public.assistant_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.assistant_log TO authenticated;
GRANT ALL ON public.assistant_log TO service_role;
DROP POLICY IF EXISTS "Admin vê o uso do assistente" ON public.assistant_log;
CREATE POLICY "Admin vê o uso do assistente" ON public.assistant_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Sincronização diária dos manuais do Notion (06:15 UTC).
SELECT cron.schedule('sync-manuais', '15 6 * * *', $cron$
  select net.http_post(
    url := 'https://unwzlmdwvpxhigmsqvam.supabase.co/functions/v1/sync-manuais',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
$cron$);
