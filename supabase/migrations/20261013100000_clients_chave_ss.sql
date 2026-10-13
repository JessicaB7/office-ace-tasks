-- Chave da Segurança Social do cliente (ficha de cliente, por baixo do NISS)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS chave_ss text;
