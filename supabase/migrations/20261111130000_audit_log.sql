-- Registo de alterações (auditoria) dos clientes.
-- Campos seguidos: responsavel_id, mensalidade, status, tipo_contabilidade e as senhas
-- (senha_at, senha_ss, senha_faturacao, via_ctt_senha, chave_ss). Nas senhas NUNCA se
-- guarda o valor — só "senha alterada". Também regista criação e eliminação do cliente.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela TEXT NOT NULL,
  registo_id UUID,
  -- Nome do registo no momento (para clientes eliminados continuarem identificáveis)
  registo_nome TEXT,
  campo TEXT NOT NULL,
  valor_antigo TEXT,
  valor_novo TEXT,
  alterado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_registo ON public.audit_log(tabela, registo_id, alterado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_em ON public.audit_log(alterado_em DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

-- Só a admin lê; ninguém escreve diretamente (só o trigger, security definer).
DO $$ BEGIN
  CREATE POLICY "Admin vê o registo de alterações" ON public.audit_log
    FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.audit_clients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_old_resp TEXT;
  v_new_resp TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'registo', 'Cliente criado', v_uid);
    RETURN NULL;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_antigo, alterado_por)
    VALUES ('clients', OLD.id, OLD.name, 'registo', 'Cliente eliminado', v_uid);
    RETURN NULL;
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    SELECT name INTO v_old_resp FROM public.collaborators WHERE id = OLD.responsavel_id;
    SELECT name INTO v_new_resp FROM public.collaborators WHERE id = NEW.responsavel_id;
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_antigo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'responsavel_id',
            COALESCE(v_old_resp, CASE WHEN OLD.responsavel_id IS NULL THEN NULL ELSE OLD.responsavel_id::text END),
            COALESCE(v_new_resp, CASE WHEN NEW.responsavel_id IS NULL THEN NULL ELSE NEW.responsavel_id::text END),
            v_uid);
  END IF;
  IF NEW.mensalidade IS DISTINCT FROM OLD.mensalidade THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_antigo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'mensalidade', OLD.mensalidade::text, NEW.mensalidade::text, v_uid);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_antigo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'status', OLD.status, NEW.status, v_uid);
  END IF;
  IF NEW.tipo_contabilidade IS DISTINCT FROM OLD.tipo_contabilidade THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_antigo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'tipo_contabilidade', OLD.tipo_contabilidade, NEW.tipo_contabilidade, v_uid);
  END IF;
  -- Senhas: só se regista que mudaram (nunca o valor).
  IF NEW.senha_at IS DISTINCT FROM OLD.senha_at THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'senha_at', 'senha alterada', v_uid);
  END IF;
  IF NEW.senha_ss IS DISTINCT FROM OLD.senha_ss THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'senha_ss', 'senha alterada', v_uid);
  END IF;
  IF NEW.senha_faturacao IS DISTINCT FROM OLD.senha_faturacao THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'senha_faturacao', 'senha alterada', v_uid);
  END IF;
  IF NEW.via_ctt_senha IS DISTINCT FROM OLD.via_ctt_senha THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'via_ctt_senha', 'senha alterada', v_uid);
  END IF;
  IF NEW.chave_ss IS DISTINCT FROM OLD.chave_ss THEN
    INSERT INTO public.audit_log (tabela, registo_id, registo_nome, campo, valor_novo, alterado_por)
    VALUES ('clients', NEW.id, NEW.name, 'chave_ss', 'senha alterada', v_uid);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_clients() FROM anon, authenticated, PUBLIC;

DROP TRIGGER IF EXISTS clients_audit ON public.clients;
CREATE TRIGGER clients_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_clients();
