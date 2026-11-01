-- Manual de processos do gabinete (formação dos colaboradores).
-- Áreas: comercial · operacional (consultorias, serviço mensal).
-- Todos os autenticados leem; só o admin cria/edita/apaga.

CREATE TABLE public.processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL CHECK (area IN ('comercial', 'consultorias', 'servico_mensal')),
  grupo text NOT NULL DEFAULT 'Geral',
  title text NOT NULL,
  frequencia text,
  aplica_se text,
  toconline_doc text,
  body text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processos TO authenticated;
GRANT ALL ON public.processos TO service_role;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view processos" ON public.processos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can create processos" ON public.processos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update processos" ON public.processos
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete processos" ON public.processos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_processos_updated_at BEFORE UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX processos_area_position_idx ON public.processos (area, position);

-- ---------------------------------------------------------------------------
-- Estrutura inicial (rascunhos — a completar pela admin na app)
-- ---------------------------------------------------------------------------
INSERT INTO public.processos (area, grupo, title, frequencia, aplica_se, toconline_doc, position, body) VALUES
-- ===== COMERCIAL =====
('comercial', '1. Do diagnóstico à proposta', 'Sessão de diagnóstico', 'Por marcação', 'Todos os potenciais clientes', NULL, 10,
$$## Objetivo
Perceber a situação do potencial cliente (20–30 min com a Jéssica) e decidir o serviço a propor.

## Passos
1. A marcação entra pelo Calendly (sessão de diagnóstico, 5 €) e cria a lead em **Comercial → Leads**, fase "Reunião agendada".
2. Confirmar na lead a data da reunião e os contactos.
3. Depois da sessão, a Jéssica preenche a informação da lead (produto sugerido + valor).

## Parar e avisar
- Pagamento falhado ou marcação duplicada.

## Checklist de validação
- [ ] Sabe onde aparece a lead e a notificação da marcação
- [ ] Sabe o que tem de estar preenchido antes de sair de "Reunião agendada"$$),
('comercial', '1. Do diagnóstico à proposta', 'Envio da proposta', 'Depois do diagnóstico', 'Leads com produto sugerido + valor', NULL, 20,
$$## Objetivo
Enviar a proposta no próprio dia do diagnóstico.

## Passos
1. Abrir o modelo Canva do regime (TI RS, TI CO, Empresa) e preencher nome, serviço e valor.
2. Exportar em PDF e enviar por WhatsApp com o script de **Comercial → Scripts**.
3. Mover a lead para **Proposta enviada**.

## Checklist de validação
- [ ] Proposta com o regime e o valor certos
- [ ] Lead movida de fase$$),
('comercial', '2. Follow ups e fecho', 'Follow ups', 'Dia 3, 7 e 12 após a proposta', 'Leads em "Proposta enviada"', NULL, 30,
$$## Passos
1. **Dia 3** → mensagem de follow up 1 (Scripts) → fase `Follow up 1`.
2. **Dia 7** → follow up 2 → fase `Follow up 2`.
3. **Dia 12** sem resposta → mensagem a encerrar → **Perda** ("Sem resposta").
4. "Não é o momento" → definir a **data para contactar**.

## Checklist de validação
- [ ] Usa a vista **Follow ups** todos os dias
- [ ] Trata sempre o cliente por "tu"$$),
('comercial', '2. Follow ups e fecho', 'Ganho → entrada do novo cliente', 'Quando aceita a proposta', 'Leads ganhas', NULL, 40,
$$## Passos
1. Mover a lead para **Ganho**.
2. Enviar o formulário de entrada (Comercial → Novos clientes) e acompanhar até estar submetido.
3. Confirmar **Data de início** e **Tratamento**: o contrato e a pasta OneDrive são preparados automaticamente.
4. Criar a ficha em **Dados de clientes** (mensalidade e início de contrato obrigatórios).
5. Pedir as senhas AT / Segurança Social e criar a empresa no TOConline.

## Checklist de validação
- [ ] Contrato preparado e enviado
- [ ] Ficha do cliente completa (regime, IVA, salários, SAF-T, faturação)$$),

-- ===== OPERACIONAL · CONSULTORIAS =====
('consultorias', 'Consultorias', 'Marcação da consultoria', 'Por marcação', 'Leads de consultoria', NULL, 10,
$$## Passos
1. Criar a lead em **Consultorias → Leads** com a data e "Dada por" (Diogo ou Jéssica).
2. Confirmar o pagamento e o valor (com e sem IVA).

## Checklist de validação
- [ ] Lead com data, consultor e valor$$),
('consultorias', 'Consultorias', 'Preparação e sessão', 'Por consultoria', NULL, NULL, 20,
$$## Passos
1. Ler a informação da lead e preparar os temas.
2. Dar a consultoria e registar as notas na lead.

## Checklist de validação
- [ ] Notas registadas na lead$$),
('consultorias', 'Consultorias', 'Follow up (15 dias) e conversão', '15 dias após a consultoria', NULL, NULL, 30,
$$## Passos
1. A tarefa de follow up é criada automaticamente para o Diogo 15 dias depois.
2. Contactar e registar o resultado: **Serviço mensal sim** (→ processo de novo cliente) ou **não**.

## Checklist de validação
- [ ] Lead fechada com "Mensal sim" ou "Mensal não"$$),

-- ===== OPERACIONAL · SERVIÇO MENSAL — 1. Gestão Mensal (contabilidade) =====
('servico_mensal', '1. Gestão Mensal — contabilidade', 'Vendas', 'Mensal', 'TI RS c/ IVA, TI CO, Empresas', 'docs/toconline/ti-rs.md', 10,
$$## Objetivo
Ter todas as vendas do mês na contabilidade.

## Passos
1. **TI**: recibos verdes → Vendas → Recibos Verdes → Atualizar recibos verdes do mês → criar e associar. Programa de faturação: SAF-T + sugestões de vendas.
2. **Empresas**: verificar o SAF-T do mês e finalizar as sugestões de vendas (nunca recibos RC).
3. Marcar **Vendas** na Gestão Mensal.

## Checklist de validação
- [ ] Total de vendas bate com o e-Fatura / SAF-T$$),
('servico_mensal', '1. Gestão Mensal — contabilidade', 'Compras', 'Mensal', 'TI RS c/ IVA, TI CO, Empresas', 'docs/toconline/ti-rs.md', 20,
$$## Objetivo
Lançar as compras do mês a partir do e-Fatura e dos documentos recebidos por e-mail.

## Passos
1. Compras → e-Fatura → **Atualizar e-Fatura** do mês.
2. Compras → Recebido por email → filtro **Doc. Compra → Não associado**.
3. Para cada anexo: ler, escolher o fornecedor, preencher os dados **igual à última compra do mesmo fornecedor**, gravar sem finalizar.
4. Marcar **Compras** na Gestão Mensal.

## Parar e avisar
- Fornecedor inexistente (não criar), anexo ilegível, total ≠ base + IVA.
- Fatura de um trimestre cujo IVA já foi entregue.
- Tratamento de IVA diferente das compras anteriores do fornecedor.

## Checklist de validação
- [ ] Nenhum anexo "Não associado" por tratar
- [ ] Fornecedores estrangeiros em autoliquidação (M40) quando aplicável$$),
('servico_mensal', '1. Gestão Mensal — contabilidade', 'Bancos (extratos bancários)', 'Mensal', 'TI CO, Empresas', NULL, 30,
$$## Passos
1. Pedir/receber o extrato do mês.
2. **Clientes → Extratos Bancários**: importar o PDF/XLSX e exportar o ficheiro para o TOConline.
3. Importar no TOConline e conciliar.
4. Marcar **Bancos** na Gestão Mensal.

## Checklist de validação
- [ ] Saldo final do extrato = saldo da conta 12 no TOConline$$),
('servico_mensal', '1. Gestão Mensal — contabilidade', 'Salários (contabilização)', 'Mensal', 'Clientes com salários', 'docs/toconline/empresas.md', 40,
$$## Passos
1. Contabilidade → Sugestões de salários → Gerar sugestões do mês (só Salários).
2. Rever e finalizar.
3. Marcar **Salários** na Gestão Mensal.$$),
('servico_mensal', '1. Gestão Mensal — contabilidade', 'Depreciações', 'Mensal', 'TI CO e Empresas com ativos', NULL, 50,
$$## Passos
_Por preencher._$$),
('servico_mensal', '1. Gestão Mensal — contabilidade', 'e-Fatura — classificação / não considerar', 'Mensal (TI) · trimestral', 'TI RS e TI CO', 'docs/toconline/ti-rs.md', 60,
$$## Passos
1. **Não considerar da atividade** (TI): Compras → e-Fatura do mês → seta → "Não considerar este documento na atividade".
2. **Classificação no e-Fatura**: Portal do e-fatura (Acesso Direto) → Verificar faturas → com n.º de diário "Sim, despesa totalmente afeta"; sem n.º de diário "Não".
3. Marcar **E-Fatura** na Gestão Mensal.$$),
('servico_mensal', '1. Gestão Mensal — contabilidade', 'Apuramento do IVA', 'Mensal ou fim do trimestre', 'Clientes com IVA', NULL, 70,
$$## Passos
1. Confirmar que vendas e compras do período estão lançadas.
2. Fazer o apuramento no TOConline e conferir o campo 93/94.
3. Marcar **IVA** na Gestão Mensal → abre o pop up "IVA fechado" com as tarefas associadas.$$),

-- ===== OPERACIONAL · SERVIÇO MENSAL — 2. Obrigações mensais =====
('servico_mensal', '2. Obrigações mensais', 'SAF-T (faturação)', 'Mensal · até dia 5', 'Clientes com SAF-T', NULL, 110,
$$## Passos
1. Obter o SAF-T do programa de faturação do cliente (ou confirmar comunicação automática).
2. Submeter no Portal das Finanças até dia 5 do mês seguinte.
3. Marcar em **Obrigações Mensais → SAFT**.$$),
('servico_mensal', '2. Obrigações mensais', 'Emissão de faturas', 'Semanal / mensal / pontual', 'Clientes com faturação "Emitir"', 'docs/toconline/emissao-faturas.md', 120,
$$## Passos
1. Ler as linhas por faturar no Excel **Gestor de Negócio** do cliente.
2. Portal das Finanças → Faturas e Recibos → **Emitir novo** a partir da fatura anterior do adquirente.
3. Conferir com o Excel, emitir, descarregar o PDF para a pasta de vendas do mês e escrever o n.º no Excel.
4. Marcar em **Obrigações Mensais → Emissão de Faturas**.

## Parar e avisar
- Falta NIF, data ou valor; Transmitente errado; total não bate.$$),
('servico_mensal', '2. Obrigações mensais', 'IVA – Declaração periódica', 'Mensal (dia 20 do 2.º mês) · trimestral', 'Clientes com IVA', NULL, 130,
$$## Passos
1. Depois do apuramento, submeter a declaração periódica no Portal (pelo TOConline).
2. Marcar **Entregue** em **IVA - Periódica**.
3. Se houver flexibilização, marcar **Flexibilização**.

## Checklist de validação
- [ ] Comprovativo guardado na pasta do cliente$$),
('servico_mensal', '2. Obrigações mensais', 'IVA – Guias da flexibilização', 'Mensal (dia 25)', 'IVA trimestral com plano de flexibilização', 'docs/toconline/iva-flexibilizacao.md', 140,
$$## Passos
1. Portal das Finanças → Flexibilização de Pagamentos → Consultar Plano/Pagar → plano do trimestre → + INFO.
2. Referência: descarregar a guia da parcela. Débito direto: só consultar o valor.
3. Enviar ao cliente com o valor e o n.º da parcela.$$),
('servico_mensal', '2. Obrigações mensais', 'IVA – OSS', 'Trimestral', 'Clientes com OSS', NULL, 150,
$$## Passos
_Por preencher._$$),
('servico_mensal', '2. Obrigações mensais', 'IVA – Declaração recapitulativa', 'Mensal ou trimestral', 'Clientes com operações intracomunitárias', NULL, 160,
$$## Passos
_Por preencher._$$),
('servico_mensal', '2. Obrigações mensais', 'Retenções na fonte', 'Mensal · dia 20', 'Clientes com retenções', NULL, 170,
$$## Passos
_Por preencher._$$),
('servico_mensal', '2. Obrigações mensais', 'Processamento de salários', 'Mensal (até dia 25 ou fim do mês)', 'Clientes com salários', NULL, 180,
$$## Passos
_Por preencher._ (processar, enviar recibos ao cliente, marcar em Obrigações Mensais → Salários)$$),
('servico_mensal', '2. Obrigações mensais', 'DMR AT', 'Mensal · dia 10', 'Clientes com salários', 'docs/toconline/dmr.md', 190,
$$## Passos
1. Submeter a DMR AT do mês.
2. Obter a guia: Acesso Direto → Consultar DMR-AT → Opções → Obter documento de pagamento.
3. Guardar `Guia_DMR_AT_<Cliente>_<MM>_<AAAA>.pdf` e enviar ao cliente.$$),
('servico_mensal', '2. Obrigações mensais', 'DMR Segurança Social', 'Mensal · dia 10', 'Clientes com salários', 'docs/toconline/dmr.md', 200,
$$## Passos
1. Submeter a declaração de remunerações na SS Direta.
2. Pagamentos e dívidas → Posição atual → descarregar as referências.
3. Registar contribuições em atraso e dívidas e avisar o cliente.$$),
('servico_mensal', '2. Obrigações mensais', 'Segurança Social TI – pagamento', 'Mensal · dia 20', 'Trabalhadores independentes', NULL, 210,
$$## Passos
_Por preencher._$$),
('servico_mensal', '2. Obrigações mensais', 'Segurança Social TI – declaração trimestral', 'Jan, Abr, Jul, Out', 'Trabalhadores independentes', 'docs/toconline/ti-rs.md', 220,
$$## Passos
_Por preencher._$$),

-- ===== OPERACIONAL · SERVIÇO MENSAL — 3. Fecho do trimestre =====
('servico_mensal', '3. Fecho do trimestre', 'Mapa de análise', 'Trimestral (após o IVA entregue)', 'Todos os clientes com análise', 'docs/toconline/ti-co.md', 310,
$$## Passos
1. TOConline: exportar o Mapa de Exploração (Jan até ao fim do trimestre) e o Balancete dos 3 meses em PDF.
2. **Análise Financeira** do cliente → importar os dois ficheiros.
3. IVA do trimestre: Declaração periódica → Rosto → campo 93 (ou 94 com sinal negativo).
4. Rever o dashboard e exportar o PDF para o cliente.

## Checklist de validação
- [ ] NIF do ficheiro = NIF do cliente
- [ ] Texto da análise por "tu"$$);
