
-- Enums
CREATE TYPE public.fiscal_regime AS ENUM ('simplificado', 'organizado', 'isento', 'misto');
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_progresso', 'concluida', 'cancelada');
CREATE TYPE public.task_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE public.task_category AS ENUM ('IRS', 'IRC', 'IVA', 'SS', 'contabilidade', 'fiscal', 'outro');

-- Clients
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nif VARCHAR(9) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  fiscal_regime public.fiscal_regime NOT NULL DEFAULT 'organizado',
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Collaborators
CREATE TABLE public.collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'técnico',
  specialty TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  collaborator_id UUID REFERENCES public.collaborators(id) ON DELETE SET NULL,
  status public.task_status NOT NULL DEFAULT 'pendente',
  priority public.task_priority NOT NULL DEFAULT 'media',
  category public.task_category NOT NULL DEFAULT 'contabilidade',
  due_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fiscal deadlines
CREATE TABLE public.fiscal_deadlines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  day_of_month INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  fiscal_regime public.fiscal_regime,
  category public.task_category NOT NULL,
  recurrent BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tasks_client ON public.tasks(client_id);
CREATE INDEX idx_tasks_collaborator ON public.tasks(collaborator_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_clients_nif ON public.clients(nif);
CREATE INDEX idx_clients_active ON public.clients(active);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_deadlines ENABLE ROW LEVEL SECURITY;

-- RLS policies: all authenticated users have full access
CREATE POLICY "Authenticated users full access" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.collaborators FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users full access" ON public.fiscal_deadlines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_collaborators_updated_at BEFORE UPDATE ON public.collaborators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
