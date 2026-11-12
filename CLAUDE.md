# CLAUDE.md — Contabilista Explica (Gestor de Tarefas e Negócio)

Contexto permanente para o Claude Code. Lê este ficheiro antes de qualquer alteração.

## 1. O que é a app

Aplicação web interna do gabinete de contabilidade **Contabilista Explica**. Centraliza clientes,
tarefas, obrigações fiscais, calendário fiscal, extratos bancários, análise financeira por cliente,
pipeline comercial (CRM), consultorias e gestão de colaboradores. Idioma da UI: **português de Portugal**.

## 2. Stack

- React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui (Radix)
- TanStack Query para dados; React Router para rotas
- Backend: **Supabase** (Postgres + RLS, Auth, Edge Functions em Deno, Realtime)
- Bibliotecas-chave: `recharts`, `exceljs`, `xlsx`, `jspdf` + `html2canvas`, `pdfjs-dist`, `date-fns`, `zod`, `react-hook-form`
- Testes: `vitest` (`npm run test`); lint: `eslint`

Comandos: `npm run dev` (porta 8080), `npm run build`, `npm run lint`, `npm run test`.

## 3. Variáveis de ambiente (`.env`)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

Cliente Supabase: `src/integrations/supabase/client.ts` — importar sempre via
`import { supabase } from "@/integrations/supabase/client"`.
Tipos gerados: `src/integrations/supabase/types.ts` (regenerar com
`supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`).

Secrets das Edge Functions: `RESEND_API_KEY`, `CALENDLY_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Identidade visual

- Primária **terracotta `#ab5a3c`**; tokens semânticos em `src/index.css` + `tailwind.config.ts`.
- **Nunca** usar cores hardcoded (`text-white`, `bg-[#...]`) nos componentes — só tokens.
- Cores por tipo de contabilidade: **SQ** azul, **TI CO** âmbar, **TI RS** verde.
- Logo: `src/assets/logo.png` / `logo-white.png`.

## 5. Autenticação e permissões

- Login por **email + código fixo de 6 caracteres** (sem passwords, sem registo público).
  Códigos em `collaborator_secrets`, geridos pelo admin na vista de Colaboradores através da
  edge function `manage-collaborator-auth`.
- Admin: `geral@contabilistaexplica.pt`. RBAC via tabela `user_roles` + função
  `has_role(_user_id uuid, _role app_role)` (security definer). **Nunca** guardar roles em `profiles`/`clients`.
- Colaboradores: acesso global a "Clientes"; "Colaboradores" e "Resumo Mensal" são admin-only;
  criação de dados mestres é admin-only.
- Padrão obrigatório: aplicar a sessão à UI **imediatamente** e verificar RBAC em background
  (evita deadlocks de loading em `src/hooks/useAuth.tsx`).

## 6. Navegação (setores) — `src/components/AppSidebar.tsx`

1. **Visão geral** — landing "O meu dia" (`DashboardView.tsx`): métricas pessoais, prazos da semana.
2. **Comercial** — pipeline (Kanban), leads, propostas enviadas, follow ups, scripts.
3. **Clientes** — dados, gestão mensal (contabilidades), obrigações, fecho do mês, mapas trimestrais, extratos, TOConline (fila, procedimentos, automações com erro), análise financeira.
4. **Gestão de negócio** (admin) — painel, painel comercial, painel de consultorias, colaboradores, resumo mensal,
   registo de alterações.
5. **Definições** — Notificações (todos) e Manuais (admin).

## 7. Módulos

### Comercial / CRM (`src/components/comercial/`)
- Estados de lead (`leadConstants.ts`): reunião agendada → proposta enviada → `followup_1` →
  `followup_2` → `nao_e_o_momento` (com "data para contactar") → ganho / perda.
- Ao **sair** de "reunião agendada" é obrigatório **produto sugerido + valor** (validado no
  `LeadFormDialog` e no drag do `PipelineView`).
- Ordenação por data de reunião; barra de pesquisa; cards mostram data da reunião e próximo follow up.
- Calendly: `calendly-webhook` cria leads no segmento **comercial**, fase "reunião agendada";
  `calendly-setup-webhook` registra a subscrição.
- Scripts: abas (sessão de diagnóstico, consultoria, infoprodutos), blocos com drag-and-drop,
  infoprodutos subdivididos por produto. Persistência em `comercial_scripts` / `comercial_script_groups`
  (não voltar a usar localStorage).

### Consultorias
- Leads de consultoria: **sem** campo de reunião — apenas data; "Dada por" (Diogo ou Jéssica);
  follow up automático **15 dias** após a data, com tarefa atribuída à **Angela** (administrativa, usa o WhatsApp do Diogo; sem Angela ativa, ao Diogo) (trigger `sync_consultoria_followup_task`).
- Painel por mês: consultorias agendadas, valor total (c/ e s/ IVA), taxa de conversão
  (= serviço mensal sim), valor por consultor, **comissão Diogo 10% sobre valor sem IVA**.
  Sem ticket médio.

### Obrigações e calendário fiscal
- Prazos legais portugueses (SAFT, IVA, SS, DMR, retenções, salários) em `fiscal_deadlines`;
  execução mensal em `monthly_obligations`.
- **IVA Periódica trimestral**: cabeçalho navega por trimestres ("1º Trimestre (Jan–Mar)"), passos de
  3 meses; os registos vivem nos meses canónicos de fim de trimestre (Mar/Jun/Set/Dez).

### Extratos bancários (`src/lib/bankParsers.ts`, `ExtratosBancariosView.tsx`)
- Parsers de PDF/XLSX: **Revolut, Santander Business, Novo Banco, Abanca, BPI** (incl. cartão de crédito), BCP, **Crédito Agrícola**.
- Datas interpretadas ao **meio-dia local** (evita drift de fuso). Descrições multi-linha;
  sinal do movimento derivado do **delta de saldo**; rodapés ignorados por coordenadas no PDF.js.
- "Hint" de banco persistido em localStorage. Exportação XLSX para **TOConline**
  (`src/assets/toconline-template.xlsx`, via ExcelJS).

### Análise financeira (`src/components/financial/`, `src/hooks/useClientFinancials.ts`)
Dados: `financial_accounts` (catálogo SNC), `client_financial_entries` (cliente × ano × mês × conta),
`client_financial_settings` (IRC, TA, IVA, deduções, outras despesas), `client_financial_imports`
(slots por trimestre + nome do ficheiro + data da última importação).

Importadores: `pdfMapaImport.ts` (Mapa de Exploração → faturação 71/72, despesas 62),
`pdfBalanceteImport.ts` e `xlsxBalanceteImport.ts` (balancetes → IVA, SS, retenções).
Validação de NIF no import (`nifCheck.ts`). Totais de balancete atribuídos **apenas ao mês de fecho**;
`closeRepeatedQuarterValues` limpa valores trimestrais repetidos.

Separadores: Análise mensal (grelha editável, FSE por rubrica SNC), Mapa de Exploração, IVA por
trimestre, Indicadores (ano vs ano anterior).

Dashboards por regime:
- **TI Simplificado** (`TISimplificadoDashboard.tsx`): 5 KPIs em linha — Faturação, Segurança Social
  (total), Despesas, Outras despesas, Resultado. SS manual por trimestre (introduz-se o **valor mensal
  e multiplica-se por 3**), obrigatória para exportar; visto **TCO** só para análise (nunca no PDF).
  "Outras despesas" com título e valor editáveis, abate à faturação. **IRS Regime Simplificado**
  (coeficiente art. 31º CIRS + escalões 2026) e **IRS Regime Organizado** (sobre resultado líquido).
  Deduções à coleta editáveis, **default 250 €**; "Notas IRS" internas por baixo (não vão para o PDF).
  **Outros rendimentos** (`outros_rendimentos_valor`, manual, também no TI Organizado): somam ao rendimento
  coletável nos dois regimes; a zero não aparecem nos resultados nem no PDF.
  "Retenção na fonte e pagamentos por conta" = conta 241 (incl. 2414): o maior entre a soma dos trimestres
  importados e o **Acumulado** do último balancete (`ret_241_acum`), para cobrir trimestres não importados.
  **Cumprimento dos 15% de despesas** (art. 31.º n.º 13/14 CIRS, só coeficientes 0,75/0,35; `src/lib/despesas15.ts`):
  exigido = 15% da faturação; justificado = max(4.587,09 €, SS) + despesas + outras despesas + «Outras despesas justificadas
  (e-Fatura)» (`despesas_15_extra`); a falta é acrescida ao rendimento coletável do IRS Simplificado (resultado vai para o PDF).
- **TI Organizado** (`TIOrganizadoDashboard.tsx`): balancete XLSX, IVA trimestral editável com
  reposição do automático (delta 2436−2437), outras despesas, simulador organizado vs simplificado.
- **Empresas / SQ** (`EmpresasDashboard.tsx`): rendimentos, FSE, gastos com pessoal, depreciações,
  mercadorias (31), resultado. IVA trimestral editável + total anual + "Limpar". IRC progressivo
  **15% / 19%** ou simplificado; derrama; **tributações autónomas**: (6266 + 6251) a 10%,
  (6315 + 6325) a 5%.
- `DashboardTrimestral.tsx`: FSE desagregado pelas contas-filha 62xx ("621 - Subcontratos", etc.),
  detetadas dinamicamente como folhas do balancete.
- Exportação PDF (`jspdf` + `html2canvas`): cabeçalho com **nome + NIF**; sem notas técnicas,
  sem TCO, sem "última importação".

### Regras fiscais invioláveis
- O **IRS a receber nunca pode exceder** a retenção na fonte + pagamentos por conta (`capReembolso`).
- Escalões IRS **2026**; coeficiente art. 31º CIRS configurável por cliente (`clients.irs_coeficiente`).

### Novos clientes — contrato automático (`scripts/onboarding-contratos/`)
- Serviço local no Mac da admin (launchd `pt.contabilistaexplica.contratos`, 10 em 10 min; instalar com
  `bash scripts/onboarding-contratos/instalar.sh`). Para cada `client_onboardings` submetido, sem "Contrato" marcado
  e com **Data de início** + **Tratamento** (`genero` f/m, obrigatórios no processo): cria
  `OneDrive/Clientes/<Primeiro Último>/Contrato/`, preenche o modelo Word do regime
  (`Contabilista Explica/Contrato/Modelos/{TI RS,TI CO,Empresa}.docx`, campos «NOME», «NIF», «MORADA», «EMAIL»,
  «DATA_INICIO», «VALOR»/«VALOR_EXTENSO» = mensalidade da lead + IVA, «DATA_CONTRATO», «GERENTE_*»), nos TI copia o
  Gestor de Negócio, grava `contrato_preparado_at`/`contrato_ficheiro`, marca `pasta_drive` e notifica as admins.
  Falta de dados → `contrato_erro` (visível no processo). Modelos na forma feminina; `genero.py` passa a masculino.

### Clientes e colaboradores
- `clients.status`: `ativo` / `a_sair` / `inativo` (filtros na lista). **Mensalidade** e
  **início de contrato** são campos **obrigatórios** no `ClientDetailDialog`.
- Filtro por "Responsável" na lista de clientes.
- **Saída de clientes** (`client_offboardings`, `src/lib/clientSaida.ts`): passar a `a_sair` cria o registo (trigger);
  separador "Saída" na ficha com motivo, último mês de responsabilidade e checklist de 9 itens (cada um com data).
  Checklist completa → `completed_at` e cliente `inativo`. O último mês é copiado para `clients.ultimo_mes_responsabilidade`
  e as vistas de obrigações/gestão mensal usam `ativoNoMes()` (sem obrigações depois desse mês).
- **Acompanhamento 60 dias** (`client_onboardings`): concluir o onboarding cria 3 tarefas da responsável
  (boas-vindas +2 d, contacto 30 d, ponto de situação 60 d; `tasks.onboarding_id/onboarding_step`); concluir a tarefa
  marca o campo no onboarding e vice-versa. Dashboard da admin: clientes em saída (x/9), saídas por motivo (12 meses),
  clientes novos (60 dias).
- Vista de colaboradores (admin): carga de trabalho, contagem só de **clientes ativos**, tabela de
  clientes "a sair" com valor, dialog com clientes agrupados por tipo, gestão de códigos de acesso.

### Tarefas periódicas (`task_recurrences`, `src/lib/taskRecurrence.ts`)
- No dialog de tarefa, campo **«Repetir»**: semanal / mensal / trimestral / anual, «a cada N», dia do mês
  (limitado ao fim do mês), «último dia útil» (só fins de semana) ou «último dia do mês», dia da semana, data de fim.
  Uma tarefa existente que passa a repetir fica como 1.ª ocorrência. Vista **Visão geral → Tarefas periódicas**
  (pausar/retomar — ao retomar saltam-se os períodos da pausa —, editar regra/modelo, «Criar já», apagar série;
  as ocorrências já criadas ficam).
- Cada ocorrência é uma tarefa normal com `tasks.recurrence_id` (índice único `recurrence_id + due_date`);
  **nunca mais do que uma em aberto por série**. Concluir/cancelar cria logo a seguinte (trigger
  `task_recurrence_next_occurrence`); job diário `run-task-recurrences` (pg_cron) cria a próxima `lead_days` (7) dias antes.
- Datas calculadas pelo índice a partir de `start_date` (sem "escorregar" 31 → 30 → 30); SQL
  (`task_recurrence_occurrence/next`) igual ao TS. RLS: admin vê todas; cada colaborador as que criou ou de que é responsável.

### Notificações e email
- Realtime in-app (`useNotifications.ts`, tabela `notifications`) — usar **um canal Realtime isolado
  por hook**, nunca reutilizar nomes de canal.
- Email transacional via Resend com fila (`enqueue_email`, `read_email_batch`, `email_queue_dispatch`),
  supressão (`suppressed_emails`) e unsubscribe (`email_unsubscribe_tokens`).
  Funções: `send-transactional-email`, `process-email-queue`, `send-daily-summary`,
  `send-weekly-digest`, `handle-email-suppression`, `handle-email-unsubscribe`,
  `preview-transactional-email`. Templates em `supabase/functions/_shared/transactional-email-templates/`.

### Registo de alterações (auditoria)
- `audit_log` + trigger `audit_clients` em `clients`: responsável, mensalidade, estado, tipo de contabilidade,
  criação/eliminação e senhas (`senha_at`, `senha_ss`, `senha_faturacao`, `via_ctt_senha`, `chave_ss`) — das senhas
  **nunca** se guarda o valor, só "senha alterada". **Sem interface na app** (12/11/2026, a pedido da admin foram
  retirados a página «Registo de alterações» e o separador «Alterações» da ficha); a tabela e o trigger mantêm-se na BD.

### Histórico de contactos
- `client_contacts` (tipo email/chamada/whatsapp/reuniao/pedido_documentos/outro, data, resumo, `seguimento_em`).
  Com seguimento, o trigger `client_contact_followup_task` cria a tarefa para quem registou. Separador «Histórico»
  da ficha usa a RPC `client_timeline` (contactos + emails da app para o email do cliente + mudanças de responsável
  + notas das obrigações). Regras puras em `src/lib/clientContacts.ts` (inclui `pedidosDocumentosPendentes`).

### Manuais do Notion por obrigação
- `obligation_manuals` (match_prefix, tipo_contabilidade, titulo, notion_url, ordem). Regra em
  `src/lib/obligationManuals.ts` (`resolveManual`): prefixo mais comprido que seja início do `obligation_type`,
  regime igual ao do cliente ou vazio; prefixo vazio = manual geral. Prefixos reais da Gestão Mensal:
  `contabilidade_empresas`, `contabilidade_organizada`, `contabilidade_TI_`. Ícone de livro (`ManualLink`) no
  cabeçalho das tarefas da Gestão Mensal e em cada cliente das Obrigações. Admin edita em Definições → Manuais
  (avisa "X tipos de obrigação sem manual").

### Automações TOConline — erros
- Página «Automações (erros)» (TOConline): tarefas `erro`/`bloqueada`, filtros, agrupamento por motivo
  (`src/lib/toconlineErros.ts`), Repetir (RPC `toconline_job_retry`: guarda a tentativa em
  `toconline_job_attempts` e volta a pôr o job em `pendente` — o job é único por procedimento × cliente × mês),
  Cancelar e «Resolvido manualmente» (→ `concluida` com nota). Contador na barra lateral.

### Mapas trimestrais por enviar
- `MapasTrimestraisView` (Clientes): `client_financial_settings` do ano, colunas `mapa_qN_enviado/data` e
  `relatorio_qN_entregue/data`; marcação individual e em lote; contador "X de Y". Regras em `src/lib/mapasTrimestrais.ts`.
  Retirada da barra lateral (12/11/2026, a pedido da admin); a vista continua acessível por `?view=mapas_trimestrais`
  (ligações das notificações e do relatório semanal).

### Alertas diários (`run_daily_alerts`, pg_cron `run-daily-alerts`, 08:00 Lisboa)
- Isenção SS (`clients.seguranca_social_isencao_fim`): 60 dias antes notifica responsável + admin; 15 dias antes
  nova notificação + tarefa «Fim de isenção SS – cliente» (categoria `SS_TI`, prazo = fim). Mapas por enviar 30 dias
  após o fim do trimestre (por responsável). Novos erros TOConline → admin. Seguimentos de contactos do dia.
- Sem duplicados: `alert_log` (chave × utilizador) via `notify_once`; `notifications.data` leva client_id/alerta.
- Cartão «Isenções SS a terminar (próximos 90 dias)» no «O meu dia».

### Fecho do mês (`src/lib/fechoMes.ts`, `FechoMesView`, `FechoMesCard`)
- Mês de referência = anterior. Usa `obrigacoesForClient`/`isObrigacaoDone`/`ativoNoMes`; `deadlineFor` aceita um
  `DayResolver` (prorrogações). Semáforo: verde ≥ 90% ou prazo pendente > 7 dias; vermelho < 3 dias/ultrapassado;
  amarelo 3–7 dias. Colaboradores veem só os seus clientes.

### Gestão Mensal — «Pedido ao cliente» (`ContabilidadesView`, `src/lib/pedidosCliente.ts`)
- Cada célula pode ficar «⏳ pedido dd/mm» (`monthly_obligations.pedido_cliente_em` + `pedido_cliente_nota`): clique direito
  na célula abre o popover (data, nota, remover); ícone de ampulheta no cabeçalho de cada coluna marca em lote. Mais de 5 dias
  → tom `destructive`. Clicar na célula marca como feito e o trigger `monthly_obligations_clear_pedido` limpa o pedido
  (Desfazer repõe-no). Cartão «X pedidos à espera» filtra os clientes com pedido. Não cria tarefas.

### Notificações no telemóvel
- `notification_preferences` (por pessoa): controlam o **push** (o sino recebe sempre); o trigger
  `notify_push_on_notification` consulta `notification_pref_enabled`. Tipos: `ss_isencao`, `mapas_por_enviar`,
  `toconline_erros`, `seguimento_contacto`, `task_assigned`. Convite após login (`PushPrompt`, volta a perguntar
  ao fim de 7 dias), Definições → Notificações (dispositivos, teste via `send_test_notification`), estado por
  colaborador na vista de Colaboradores (`push_devices_by_user`, admin).
- Ligações diretas: `/?view=<vista>&client=<id>&tab=<separador>` (tratadas no `Index.tsx`).

### Relatório semanal (`send-weekly-digest`)
- Segunda às 08:00 de Lisboa (cron 07:00/08:00 UTC com verificação da hora). Mantém o resumo de tarefas por
  colaborador e acrescenta o relatório do escritório para a admin + versão resumida para quem ativar
  `relatorio_semanal_pessoal`. Renderiza `weekly-business-report.tsx` e põe na fila (`enqueue_email`).
  Usa cópias de `src/lib` em `supabase/functions/_shared/lib/` (o teste `sharedLib.test.ts` exige que sejam iguais).
  Botão «Enviar relatório agora» em Definições → Notificações (admin).

### Assistente (`assistente`, `sync-manuais`)
- Edge function `assistente` (secret `ANTHROPIC_API_KEY`, modelo `claude-sonnet-5-5`): resumo do cliente, rascunho de
  pedido de pendentes (por "tu", nunca envia), pergunta livre e dúvidas de processos (só com `manual_pages`).
  **Nunca** enviar `senha_at`, `senha_ss`, `senha_faturacao`, `via_ctt_senha`, `via_ctt_resposta`, `chave_ss`,
  `utilizador_faturacao`, `niss` ao modelo. Cada uso em `assistant_log` (sem conteúdo).
  Na app só é usado no ícone flutuante (processos) e no Robot da análise — o separador «Assistente» da ficha do
  cliente foi retirado (12/11/2026, a pedido da admin).
- `sync-manuais` (secret `NOTION_TOKEN`, pg_cron diário `sync-manuais`) copia as páginas-filhas de
  «Manual · Técnica de contabilidade» para `manual_pages`. Ícone flutuante `AssistenteFlutuante`.

## 8. Base de dados

Tabelas em `public`: `clients`, `collaborators`, `collaborator_secrets`, `user_roles`, `tasks`,
`monthly_obligations`, `fiscal_deadlines`, `notifications`, `leads`, `comercial_scripts`,
`comercial_script_groups`, `financial_accounts`, `client_financial_entries`,
`client_financial_settings`, `client_financial_imports`, `task_recurrences`, `email_send_log`, `email_send_state`,
`email_unsubscribe_tokens`, `suppressed_emails`, `audit_log`, `client_contacts`, `obligation_manuals`,
`toconline_job_attempts`, `notification_preferences`, `alert_log`, `manual_pages`, `assistant_log`.

Funções: `has_role`, `update_updated_at_column`, `enqueue_email`, `read_email_batch`, `delete_email`,
`move_to_dlq`, `email_queue_dispatch`, `email_queue_wake`.

Regras:
- Toda a tabela em `public` precisa de RLS **e** de `GRANT` explícito
  (`authenticated`, `service_role`; `anon` só se existir política para anon).
- Joins em `tasks` exigem **aliases de FK explícitos**:
  `collaborators!tasks_collaborator_id_fkey`, `collaborators!tasks_created_by_collaborator_fkey`.
- Migrações versionadas em `supabase/migrations/`. Nunca alterar os schemas `auth`, `storage`,
  `realtime`, `supabase_functions`, `vault`.

## 9. Convenções de código

- Cálculos financeiros em TypeScript puro (`financialMath.ts`, `src/lib/*`) — testáveis, sem side effects.
- Componentes de vista em `src/components/`, agrupados por domínio (`comercial/`, `financial/`).
- `src/components/ui/` é shadcn gerado — evitar editar; preferir composição.
- Preferir alterações mínimas e localizadas; manter os textos da UI em pt-PT.
