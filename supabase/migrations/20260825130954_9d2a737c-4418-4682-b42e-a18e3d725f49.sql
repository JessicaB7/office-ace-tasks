CREATE TABLE public.comercial_scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tag text not null default 'Geral',
  category text not null,
  script_group text,
  body text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_scripts TO authenticated;
GRANT ALL ON public.comercial_scripts TO service_role;
ALTER TABLE public.comercial_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view scripts" ON public.comercial_scripts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can create scripts" ON public.comercial_scripts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update scripts" ON public.comercial_scripts FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete scripts" ON public.comercial_scripts FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TABLE public.comercial_script_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'infoprodutos',
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comercial_script_groups TO authenticated;
GRANT ALL ON public.comercial_script_groups TO service_role;
ALTER TABLE public.comercial_script_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view script groups" ON public.comercial_script_groups FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can create script groups" ON public.comercial_script_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update script groups" ON public.comercial_script_groups FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete script groups" ON public.comercial_script_groups FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_comercial_scripts_updated_at BEFORE UPDATE ON public.comercial_scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();