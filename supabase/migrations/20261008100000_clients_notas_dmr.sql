-- Obrigações DMR: coluna Notas por cliente (mantém-se de mês para mês).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notas_dmr TEXT;
