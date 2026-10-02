-- Emissão de faturas: nota por cliente que se mantém de mês para mês.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notas_faturas TEXT;
