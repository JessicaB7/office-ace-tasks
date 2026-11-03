-- Controlo de dívidas CRM com separadores: descrição própria para a Segurança Social
-- (a divida_descricao fica para as Finanças). As notas "Mensagem enviada" passam também para a SS.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS divida_ss_descricao TEXT;

UPDATE public.clients
   SET divida_ss_descricao = divida_descricao
 WHERE divida_ss = 'com_divida' AND divida_descricao LIKE 'Mensagem enviada%';

UPDATE public.clients
   SET divida_descricao = NULL
 WHERE divida_at <> 'com_divida' AND divida_descricao LIKE 'Mensagem enviada%';
