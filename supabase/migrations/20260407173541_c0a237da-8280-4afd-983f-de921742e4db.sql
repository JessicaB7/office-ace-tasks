
ALTER TABLE public.clients
  ADD COLUMN senha_at text DEFAULT NULL,
  ADD COLUMN niss text DEFAULT NULL,
  ADD COLUMN senha_ss text DEFAULT NULL,
  ADD COLUMN programa_faturacao text DEFAULT NULL,
  ADD COLUMN utilizador_faturacao text DEFAULT NULL,
  ADD COLUMN senha_faturacao text DEFAULT NULL,
  ADD COLUMN via_ctt text DEFAULT NULL;
