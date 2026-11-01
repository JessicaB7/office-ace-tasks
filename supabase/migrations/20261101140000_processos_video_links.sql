-- Processos: vídeo da gravação (Google Drive / OneDrive / Loom / YouTube) e ligações à Drive.
-- Operacional fica só com o Serviço mensal: os processos de consultorias passam para o Comercial.
ALTER TABLE public.processos
  ADD COLUMN video_url text,
  ADD COLUMN links jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.processos
   SET area = 'comercial', grupo = '3. Consultorias', position = position + 100
 WHERE area = 'consultorias';
