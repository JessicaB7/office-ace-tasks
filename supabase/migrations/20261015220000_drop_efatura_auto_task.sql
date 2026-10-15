-- As tarefas associadas ao apuramento do IVA (e-Fatura, mapas de análise) deixam de ser
-- criadas automaticamente: a app mostra um pop-up e é a utilizadora que as ativa, com a data.
DROP TRIGGER IF EXISTS sync_efatura_task_after_iva_ti ON public.monthly_obligations;
DROP FUNCTION IF EXISTS public.sync_efatura_task_after_iva_ti();
