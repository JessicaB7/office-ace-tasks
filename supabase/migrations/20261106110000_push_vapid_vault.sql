-- Chaves VAPID do Web Push guardadas no vault (vapid_public_key / vapid_private_key):
-- a edge function send-push lê-as por RPC com a chave de serviço quando não há
-- secrets VAPID_* definidos nas Edge Functions.
CREATE OR REPLACE FUNCTION public.get_vapid_keys()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'public_key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vapid_public_key' LIMIT 1),
    'private_key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vapid_private_key' LIMIT 1)
  );
$$;
REVOKE ALL ON FUNCTION public.get_vapid_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vapid_keys() TO service_role;
