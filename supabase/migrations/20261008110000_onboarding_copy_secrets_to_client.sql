-- Ao ligar um onboarding a um cliente (client_id), copia as senhas do
-- formulário (Finanças, Segurança Social, programa de faturação) para a ficha
-- do cliente. Corre como SECURITY DEFINER para funcionar também quando é um
-- colaborador (sem acesso a client_onboarding_secrets) a criar o cliente.
-- Só preenche campos que ainda estejam vazios no cliente.

CREATE OR REPLACE FUNCTION public.copy_onboarding_secrets_to_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.client_id IS DISTINCT FROM NEW.client_id) THEN
    UPDATE public.clients c
    SET senha_at = COALESCE(NULLIF(c.senha_at, ''), s.senha_at),
        senha_ss = COALESCE(NULLIF(c.senha_ss, ''), s.senha_ss),
        utilizador_faturacao = COALESCE(NULLIF(c.utilizador_faturacao, ''), s.utilizador_faturacao),
        senha_faturacao = COALESCE(NULLIF(c.senha_faturacao, ''), s.senha_faturacao)
    FROM public.client_onboarding_secrets s
    WHERE c.id = NEW.client_id AND s.onboarding_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_onboarding_secrets_to_client() FROM PUBLIC;

DROP TRIGGER IF EXISTS client_onboardings_copy_secrets ON public.client_onboardings;
CREATE TRIGGER client_onboardings_copy_secrets
  AFTER INSERT OR UPDATE OF client_id ON public.client_onboardings
  FOR EACH ROW EXECUTE FUNCTION public.copy_onboarding_secrets_to_client();

-- Recupera as senhas dos clientes já convertidos
UPDATE public.clients c
SET senha_at = COALESCE(NULLIF(c.senha_at, ''), s.senha_at),
    senha_ss = COALESCE(NULLIF(c.senha_ss, ''), s.senha_ss),
    utilizador_faturacao = COALESCE(NULLIF(c.utilizador_faturacao, ''), s.utilizador_faturacao),
    senha_faturacao = COALESCE(NULLIF(c.senha_faturacao, ''), s.senha_faturacao)
FROM public.client_onboardings o
JOIN public.client_onboarding_secrets s ON s.onboarding_id = o.id
WHERE o.client_id = c.id;
