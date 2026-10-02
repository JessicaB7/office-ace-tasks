-- Dados de clientes: senha e resposta da Via CTT (o campo via_ctt passa a ser o utilizador).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS via_ctt_senha TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS via_ctt_resposta TEXT;
