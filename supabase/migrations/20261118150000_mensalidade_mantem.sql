-- Atualização de mensalidades: estado «mantem» (cliente fica com a mesma mensalidade).
ALTER TABLE public.mensalidade_atualizacoes DROP CONSTRAINT IF EXISTS mensalidade_atualizacoes_estado_check;
ALTER TABLE public.mensalidade_atualizacoes
  ADD CONSTRAINT mensalidade_atualizacoes_estado_check CHECK (estado IN ('pendente', 'aceite', 'recusado', 'mantem'));
