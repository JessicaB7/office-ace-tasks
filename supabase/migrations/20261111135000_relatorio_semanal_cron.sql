-- Relatório semanal (send-weekly-digest): segunda-feira às 08:00 de Lisboa em qualquer
-- época do ano. O cron corre às 07:00 e 08:00 UTC e só chama a função quando em Lisboa
-- são 08:00 (07:00 UTC no horário de verão, 08:00 UTC no de inverno).
SELECT cron.schedule('send-weekly-digest', '0 7,8 * * 1', $cron$
  select case when to_char(now() at time zone 'Europe/Lisbon', 'HH24:MI') = '08:00' then
    (select net.http_post(
      url := 'https://unwzlmdwvpxhigmsqvam.supabase.co/functions/v1/send-weekly-digest',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000)::text)
  end;
$cron$);
