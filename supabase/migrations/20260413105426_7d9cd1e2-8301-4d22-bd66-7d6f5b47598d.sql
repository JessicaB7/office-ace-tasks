ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.tasks ADD COLUMN created_by uuid REFERENCES public.collaborators(id) DEFAULT NULL;