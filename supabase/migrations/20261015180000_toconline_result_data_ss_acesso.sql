-- Fila TOConline: dados estruturados do resultado (ex.: Guia DMR SS — valor, referência MB, prazo, dívidas).
ALTER TABLE public.toconline_jobs ADD COLUMN IF NOT EXISTS result_data JSONB;

-- Ficha do cliente: problema de acesso à Segurança Social Direta pelo Acesso Direto do TOConline
-- (null = sem problema; texto = motivo, ex.: "Sem senha da SS no TOConline").
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ss_acesso_problema TEXT;
