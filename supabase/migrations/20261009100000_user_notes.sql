-- Visão geral: bloco de notas pessoal. Cada utilizador só vê e edita as suas notas.
CREATE TABLE IF NOT EXISTS public.user_notes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_user_notes_updated_at ON public.user_notes;
CREATE TRIGGER update_user_notes_updated_at
  BEFORE UPDATE ON public.user_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notes TO authenticated;
GRANT ALL ON public.user_notes TO service_role;

DO $$ BEGIN
  CREATE POLICY "Cada utilizador gere as suas notas" ON public.user_notes
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
