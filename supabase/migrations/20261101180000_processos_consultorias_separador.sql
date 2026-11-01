-- Processos — Comercial com dois separadores (Serviço mensal · Consultorias):
-- os processos de consultorias voltam à área própria.
UPDATE public.processos SET area = 'consultorias', grupo = 'Consultorias', position = position - 100
 WHERE area = 'comercial' AND grupo = '3. Consultorias';
