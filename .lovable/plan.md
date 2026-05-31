## Objetivo

Replicar, dentro do Contabilista Explica, o modelo de análise que enviaste (`Mapa analise Sociedade_Amperdimension Lda.xlsx`) como dashboard por cliente, com vista anual (12 meses + 4 trimestres) e indicadores ano vs ano.

## Onde vive

- **Botão "Análise Financeira"** em cada cliente (`ClientListView` e `ClientDetailDialog`).
- **Página dedicada** em `/clientes/:id/analise` com:
  - Seletor de **ano** (default: ano corrente).
  - 4 secções (tabs): **Análise mensal · Mapa de Exploração · IVA · Indicadores**.

## Acesso

- Admin: pode editar tudo.
- Colaborador ativo: pode editar valores do(s) cliente(s) onde é responsável; leitura de todos.

## Estrutura de dados (novas tabelas)

1. **`financial_accounts`** (catálogo SNC — seed com as contas do teu modelo)
   - `code` (PK, ex.: `711`, `6311`, `24333311`)
   - `name`, `parent_code`, `section` (`vendas` | `pessoal_socios` | `pessoal_colab` | `despesas` | `compras` | `iva_vendas` | `iva_compras` | `ta`), `sign` (+/-), `display_order`.

2. **`client_financial_entries`**
   - `client_id`, `year`, `month` (1-12), `account_code`, `value numeric`, `updated_by`, `updated_at`.
   - PK: `(client_id, year, month, account_code)`.

3. **`client_financial_settings`** (por cliente × ano)
   - `corporate_tax_rate` (default 0.16 — derretramado), `ta_rates jsonb` (Despesas representação 10%, Ajudas custo 5%, Não documentadas 50%), `prev_year_ref` (ano de comparação).

RLS: leitura = qualquer colaborador autenticado; escrita = admin ou colaborador ativo (mesma regra de `tasks`).

## Página `/clientes/:id/analise`

### 1) Análise mensal (replica do separador "ANÁLISE")
Tabela editável estilo Excel, linhas agrupadas:
- **Faturação** — 711 Vendas, 721 Prestação de Serviços, 728 …
- **Gastos com pessoal — Sócios** — 6311, 6316, 6312, 6313, 6314, 6351
- **Gastos com pessoal — Colaboradores** — 6321..6352, 636
- **Despesas (FSE)** — 621, 6221, 6222, 6224, 6226, 6227, 6231, 6233, 6241, 6242, 6251, 6261, 6262, 6263, 6266, 6267, 6911
- **Compra de Material** — 31
- Linhas calculadas: **Total Vendas+PS**, **Total Pessoal**, **Total Despesas**, **LUCRO MENSAL** = vendas − pessoal − despesas − compras.

Colunas: Jan..Dez + **TOTAL** + **Q1..Q4**.

### 2) Mapa de Exploração (replica do 2º separador)
Tabela read-only agregada por classe SNC:
- Rendimentos: 71, 72, 73, 74, 75, 76, 78, 79 → **Total Rendimentos**
- Gastos: 61, 62, 63, 64, 65, 67, 68, 69 → **Total Gastos**
- Compras: 31
- **Resultado de Exploração**, **RAI**, **Resultado Acumulado** (cumulativo mensal), **Imposto Estimado** (RAI × `corporate_tax_rate`), **Tributações Autónomas** (6266×10% + 6315×5% + 6888×50%), **RLP** = RAI − Imposto − TA.

### 3) IVA (último bloco do separador "ANÁLISE")
- IVA Vendas (6%, 23%, NC) − IVA Compras (6%, 13%, 23%, NC) por mês.
- **IVA a entregar ao Estado** trimestral, com etiquetas "A pagar até 25/05, 25/08, 25/11, 25/02".

### 4) Indicadores (replica do 3º separador)
Cartões + tabela ano corrente vs ano anterior:
- Margem bruta, Margem líquida, Peso de despesas, Peso de pessoal, Crescimento da faturação.
- Mini-gráficos sparkline de evolução mensal.

### Gráficos
- Barras empilhadas: Faturação vs Gastos vs Lucro por mês.
- Linha: RLP acumulado.
- Donut: composição das despesas no ano.

## Importação (futuro)

Botão "Importar Excel" que lê o teu modelo (`ANÁLISE`/`Mapa Exploração`) e preenche os entries — incluído nesta primeira versão como upload opcional de XLSX que faz match por código de conta.

## Detalhes técnicos

- **Frontend**: nova rota em `App.tsx`; componente `ClientAnalysisView` com `useClientFinancials(clientId, year)` (TanStack Query).
- **Cálculos**: feitos em TypeScript no cliente (puros), não em SQL — mais fácil de iterar.
- **Persistência**: cada célula faz `upsert` à `client_financial_entries` (debounced 600ms).
- **Reaproveita** `recharts` (já está no projeto via shadcn `chart`).
- **Cores**: terracotta primary; verde para positivos, destructive para negativos.

## Fora do âmbito desta primeira versão

- Cálculo automático a partir de extratos bancários (categorização) — fica para depois.
- Comparação multi-anos (>2) — só ano corrente vs anterior.
- Exportação para PDF — fica para depois.

## Confirmações que preciso

1. **Comparação anual**: usar sempre `ano − 1` (igual ao Indicadores: 2024 vs 2023)?
2. **Taxa de IRC**: default 16% (PME, derrama incluída) ou outro?
3. **Importar agora o XLSX** que enviaste para o cliente "Sociedade Amperdimension Lda" para vires logo o dashboard preenchido (se existir esse cliente na BD)?
