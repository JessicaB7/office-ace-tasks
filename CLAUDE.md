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

## 6. Navegação (4 setores) — `src/components/AppSidebar.tsx`

1. **Visão geral** — landing "O meu dia" (`DashboardView.tsx`): métricas pessoais, prazos da semana.
2. **Comercial** — pipeline (Kanban), leads, propostas enviadas, follow ups, scripts.
3. **Clientes** — dados, contabilidades, tarefas, obrigações, calendário fiscal, extratos, análise financeira.
4. **Gestão de negócio** (admin) — painel, painel comercial, painel de consultorias, colaboradores, resumo mensal.

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
  follow up automático **15 dias** após a data.
- Painel por mês: consultorias agendadas, valor total (c/ e s/ IVA), taxa de conversão
  (= serviço mensal sim), valor por consultor, **comissão Diogo 10% sobre valor sem IVA**.
  Sem ticket médio.

### Obrigações e calendário fiscal
- Prazos legais portugueses (SAFT, IVA, SS, DMR, retenções, salários) em `fiscal_deadlines`;
  execução mensal em `monthly_obligations`.
- **IVA Periódica trimestral**: cabeçalho navega por trimestres ("1º Trimestre (Jan–Mar)"), passos de
  3 meses; os registos vivem nos meses canónicos de fim de trimestre (Mar/Jun/Set/Dez).

### Extratos bancários (`src/lib/bankParsers.ts`, `ExtratosBancariosView.tsx`)
- Parsers de PDF/XLSX: **Revolut, Santander Business, Novo Banco, Abanca, BPI** (incl. cartão de crédito), BCP.
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
  Deduções à coleta editáveis, **default 250 €**. Campo "Retenção na fonte e pagamentos por conta".
- **TI Organizado** (`TIOrganizadoDashboard.tsx`): balancete XLSX, IVA trimestral editável com
  reposição do automático (delta 2436−2437), outras despesas, simulador organizado vs simplificado.
- **Empresas / SQ** (`EmpresasDashboard.tsx`): rendimentos, FSE, gastos com pessoal, depreciações,
  mercadorias (31), resultado. IVA trimestral editável + total anual + "Limpar". IRC progressivo
  **15% / 19%** ou simplificado; derrama; **tributações autónomas**: (6266 + 625) a 10%,
  (6315 + 6325) a 5%.
- `DashboardTrimestral.tsx`: FSE desagregado pelas contas-filha 62xx ("621 - Subcontratos", etc.),
  detetadas dinamicamente como folhas do balancete.
- Exportação PDF (`jspdf` + `html2canvas`): cabeçalho com **nome + NIF**; sem notas técnicas,
  sem TCO, sem "última importação".

### Regras fiscais invioláveis
- O **IRS a receber nunca pode exceder** a retenção na fonte + pagamentos por conta (`capReembolso`).
- Escalões IRS **2026**; coeficiente art. 31º CIRS configurável por cliente (`clients.irs_coeficiente`).

### Clientes e colaboradores
- `clients.status`: `ativo` / `a_sair` / `inativo` (filtros na lista). **Mensalidade** e
  **início de contrato** são campos **obrigatórios** no `ClientDetailDialog`.
- Filtro por "Responsável" na lista de clientes.
- Vista de colaboradores (admin): carga de trabalho, contagem só de **clientes ativos**, tabela de
  clientes "a sair" com valor, dialog com clientes agrupados por tipo, gestão de códigos de acesso.

### Notificações e email
- Realtime in-app (`useNotifications.ts`, tabela `notifications`) — usar **um canal Realtime isolado
  por hook**, nunca reutilizar nomes de canal.
- Email transacional via Resend com fila (`enqueue_email`, `read_email_batch`, `email_queue_dispatch`),
  supressão (`suppressed_emails`) e unsubscribe (`email_unsubscribe_tokens`).
  Funções: `send-transactional-email`, `process-email-queue`, `send-daily-summary`,
  `send-weekly-digest`, `handle-email-suppression`, `handle-email-unsubscribe`,
  `preview-transactional-email`. Templates em `supabase/functions/_shared/transactional-email-templates/`.

## 8. Base de dados

Tabelas em `public`: `clients`, `collaborators`, `collaborator_secrets`, `user_roles`, `tasks`,
`monthly_obligations`, `fiscal_deadlines`, `notifications`, `leads`, `comercial_scripts`,
`comercial_script_groups`, `financial_accounts`, `client_financial_entries`,
`client_financial_settings`, `client_financial_imports`, `email_send_log`, `email_send_state`,
`email_unsubscribe_tokens`, `suppressed_emails`.

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
