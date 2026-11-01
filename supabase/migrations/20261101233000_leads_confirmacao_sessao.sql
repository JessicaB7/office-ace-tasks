-- Confirmação da sessão: data (por defeito o dia anterior à reunião) e visto "Sessão confirmada".
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS confirmation_date date,
  ADD COLUMN IF NOT EXISTS meeting_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meeting_confirmed_at timestamptz;

-- Ao criar a lead ou mudar a data da reunião: data de confirmação = dia anterior (salvo se vier
-- explicitamente outra data no mesmo pedido) e o visto volta a "por confirmar".
CREATE OR REPLACE FUNCTION public.set_lead_confirmation_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.meeting_date IS NOT NULL AND NEW.confirmation_date IS NULL THEN
      NEW.confirmation_date := NEW.meeting_date - 1;
    END IF;
  ELSIF NEW.meeting_date IS DISTINCT FROM OLD.meeting_date THEN
    IF NEW.confirmation_date IS NOT DISTINCT FROM OLD.confirmation_date THEN
      NEW.confirmation_date := CASE WHEN NEW.meeting_date IS NULL THEN NULL ELSE NEW.meeting_date - 1 END;
    END IF;
    IF NEW.meeting_confirmed IS NOT DISTINCT FROM OLD.meeting_confirmed THEN
      NEW.meeting_confirmed := false;
    END IF;
  END IF;

  IF NEW.meeting_confirmed AND (TG_OP = 'INSERT' OR NOT OLD.meeting_confirmed) THEN
    NEW.meeting_confirmed_at := now();
  ELSIF NOT NEW.meeting_confirmed THEN
    NEW.meeting_confirmed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_lead_confirmation_date ON public.leads;
CREATE TRIGGER set_lead_confirmation_date
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_lead_confirmation_date();

-- Leads já existentes com reunião marcada
UPDATE public.leads SET confirmation_date = meeting_date - 1
 WHERE meeting_date IS NOT NULL AND confirmation_date IS NULL;
