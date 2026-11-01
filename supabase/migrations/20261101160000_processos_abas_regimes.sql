-- Processos — Operacional em dois separadores (Gestão Mensal · Obrigações) e por tipo de cliente.
-- regimes: valores de clients.tipo_contabilidade ('TI RS', 'TI CO', 'SQ'); vazio = todos.
ALTER TABLE public.processos DROP CONSTRAINT processos_area_check;

UPDATE public.processos SET area = 'obrigacoes' WHERE area = 'servico_mensal' AND grupo = '2. Obrigações mensais';
UPDATE public.processos SET area = 'gestao_mensal' WHERE area = 'servico_mensal';

ALTER TABLE public.processos ADD CONSTRAINT processos_area_check
  CHECK (area IN ('comercial', 'consultorias', 'gestao_mensal', 'obrigacoes'));

ALTER TABLE public.processos ADD COLUMN regimes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.processos ADD CONSTRAINT processos_regimes_check
  CHECK (regimes <@ ARRAY['TI RS', 'TI CO', 'SQ']::text[]);

-- Gestão Mensal: grupos
UPDATE public.processos SET grupo = 'Lançamentos do mês' WHERE area = 'gestao_mensal' AND grupo = '1. Gestão Mensal — contabilidade';
UPDATE public.processos SET grupo = 'Fecho do trimestre' WHERE area = 'gestao_mensal' AND grupo = '3. Fecho do trimestre';

-- Obrigações: grupos por tema
UPDATE public.processos SET grupo = 'Faturação' WHERE area = 'obrigacoes' AND title IN ('SAF-T (faturação)', 'Emissão de faturas');
UPDATE public.processos SET grupo = 'IVA' WHERE area = 'obrigacoes' AND title LIKE 'IVA%';
UPDATE public.processos SET grupo = 'Salários' WHERE area = 'obrigacoes' AND title IN ('Processamento de salários', 'DMR AT', 'DMR Segurança Social');
UPDATE public.processos SET grupo = 'Retenções' WHERE area = 'obrigacoes' AND title = 'Retenções na fonte';
UPDATE public.processos SET grupo = 'Segurança Social TI' WHERE area = 'obrigacoes' AND title LIKE 'Segurança Social TI%';

-- Tipo de cliente
UPDATE public.processos SET regimes = '{TI CO,SQ}' WHERE area = 'gestao_mensal' AND title IN ('Bancos (extratos bancários)', 'Depreciações');
UPDATE public.processos SET regimes = '{TI RS,TI CO}' WHERE area = 'gestao_mensal' AND title = 'e-Fatura — classificação / não considerar';
UPDATE public.processos SET regimes = '{TI RS,TI CO}' WHERE area = 'obrigacoes' AND title LIKE 'Segurança Social TI%';

-- Vendas: o procedimento é diferente nos TI e nas Empresas → dois processos
UPDATE public.processos
   SET regimes = '{TI RS,TI CO}', aplica_se = 'TI RS com IVA e TI CO',
       body = $$## Objetivo
Ter todas as vendas do mês na contabilidade.

## Passos
1. **Recibos verdes**: Vendas → Recibos Verdes → Atualizar recibos verdes do mês → **+** (criar e associar) → Gravar → Finalizar e pagar.
2. **Programa de faturação**: SAF-T do mês + sugestões de vendas.
3. Marcar **Vendas** na Gestão Mensal.

## Checklist de validação
- [ ] Total de vendas bate com o e-Fatura / Portal$$
 WHERE area = 'gestao_mensal' AND title = 'Vendas';

INSERT INTO public.processos (area, grupo, title, frequencia, aplica_se, toconline_doc, position, regimes, body) VALUES
('gestao_mensal', 'Lançamentos do mês', 'Vendas', 'Mensal', 'Empresas', 'docs/toconline/empresas.md', 11, '{SQ}',
$$## Objetivo
Ter todas as vendas do mês na contabilidade.

## Passos
1. Verificar o SAF-T do mês (se o programa de faturação for externo).
2. Gerar as sugestões de vendas e finalizá-las (**nunca** recibos RC).
3. Marcar **Vendas** na Gestão Mensal.

## Checklist de validação
- [ ] Total de vendas bate com o SAF-T$$);

UPDATE public.processos SET aplica_se = NULL WHERE area IN ('gestao_mensal', 'obrigacoes') AND aplica_se IN ('TI RS c/ IVA, TI CO, Empresas', 'TI CO, Empresas', 'TI RS e TI CO', 'TI CO e Empresas com ativos', 'Trabalhadores independentes');
UPDATE public.processos SET aplica_se = 'TI RS com regime de IVA, TI CO e Empresas' WHERE area = 'gestao_mensal' AND title = 'Compras';
UPDATE public.processos SET aplica_se = 'Clientes com ativos' WHERE area = 'gestao_mensal' AND title = 'Depreciações';
