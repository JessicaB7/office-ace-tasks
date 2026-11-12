-- Gestão Mensal: «Pedido ao cliente» por célula (cliente × tarefa × mês).
-- Data do pedido + nota curta (o que se pediu). Marcar a célula como feita limpa o pedido.

ALTER TABLE public.monthly_obligations
  ADD COLUMN IF NOT EXISTS pedido_cliente_em date,
  ADD COLUMN IF NOT EXISTS pedido_cliente_nota text;

CREATE OR REPLACE FUNCTION public.monthly_obligations_clear_pedido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    NEW.pedido_cliente_em := NULL;
    NEW.pedido_cliente_nota := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS monthly_obligations_clear_pedido ON public.monthly_obligations;
CREATE TRIGGER monthly_obligations_clear_pedido
  BEFORE INSERT OR UPDATE OF status ON public.monthly_obligations
  FOR EACH ROW EXECUTE FUNCTION public.monthly_obligations_clear_pedido();

CREATE INDEX IF NOT EXISTS monthly_obligations_pedido_idx
  ON public.monthly_obligations (reference_month)
  WHERE pedido_cliente_em IS NOT NULL;
