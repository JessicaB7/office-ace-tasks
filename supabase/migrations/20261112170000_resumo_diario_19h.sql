-- Resumo diário da equipa (send-daily-summary): dias úteis às 19:00 de Lisboa.
-- Lisboa = UTC+1 no verão (19h = 18:00 UTC) e UTC+0 no inverno (19h = 19:00 UTC): o cron corre
-- às 18:00 e 19:00 UTC (seg–sex) e só chama a função quando em Lisboa são 19h (a função volta a verificar).
DO $$
BEGIN
  PERFORM cron.unschedule('send-daily-summary');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'send-daily-summary',
  '0 18,19 * * 1-5',
  $cron$
  select case when to_char(now() at time zone 'Europe/Lisbon', 'HH24') = '19' then
    (select net.http_post(
      url := 'https://unwzlmdwvpxhigmsqvam.supabase.co/functions/v1/send-daily-summary',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)::text)
  end;
  $cron$
);
