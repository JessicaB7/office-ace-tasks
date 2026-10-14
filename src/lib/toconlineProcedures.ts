// Procedimentos TOConline que podem ser ativados na Fila. Cada procedimento está
// descrito passo a passo em docs/toconline/<regime>.md (o manual que o Claude
// segue no TOConline pelo Claude in Chrome).
import empresasDoc from "../../docs/toconline/empresas.md?raw";
import tiRsDoc from "../../docs/toconline/ti-rs.md?raw";
import tiCoDoc from "../../docs/toconline/ti-co.md?raw";
import ivaFlexDoc from "../../docs/toconline/iva-flexibilizacao.md?raw";
import { SUB_PAGE_CONFIG } from "@/lib/contabilidadesConfig";

export type ToconlineJobStatus = "pendente" | "em_curso" | "concluida" | "bloqueada" | "erro" | "cancelada";

export type ToconlineRegime = "ti_rs" | "ti_co" | "empresas" | "iva";
export type ToconlineTarefa = "vendas" | "compras" | "nao_considerar" | "salarios" | "mapa_analise" | "classificacao_efatura" | "guias_flex_iva";

/** Separadores da Fila: um por regime. */
export const TOCONLINE_REGIMES: { id: ToconlineRegime; label: string }[] = [
  { id: "ti_rs", label: "TI Simplificado" },
  { id: "ti_co", label: "TI Organizado" },
  { id: "empresas", label: "Empresas" },
  { id: "iva", label: "IVA (todos os regimes)" },
];

/** Tarefas disponíveis em cada regime. */
export const TOCONLINE_TAREFAS: { id: ToconlineTarefa; label: string }[] = [
  { id: "vendas", label: "Vendas" },
  { id: "compras", label: "Compras" },
  { id: "nao_considerar", label: "Compras — Não considerar da atividade" },
  { id: "salarios", label: "Salários" },
  { id: "mapa_analise", label: "Mapa de análise" },
  { id: "classificacao_efatura", label: "Classificação e-Fatura" },
  { id: "guias_flex_iva", label: "Guias flexibilização IVA" },
];

export interface ToconlineProcedure {
  id: string;
  regime: ToconlineRegime;
  tarefa: ToconlineTarefa;
  label: string;
  /** Regime a que se aplica (valor de clients.tipo_contabilidade); null = todos os regimes. */
  tipoContabilidade: "SQ" | "TI CO" | "TI RS" | null;
  /** Clientes elegíveis = IVA trimestral com flexibilização e parcela a vencer no mês da tarefa. */
  ivaFlex?: boolean;
  regimeLabel: string;
  /** Filtro extra dentro do regime (ex.: só TI RS com regime de IVA). */
  filter?: (client: any) => boolean;
  description: string;
  /** Ficheiro do manual em docs/toconline/ — sem manual, o Claude deixa a tarefa Bloqueada. */
  docPath?: string;
  /** Obrigação da Gestão Mensal que fica feita quando a tarefa é concluída. */
  gestaoMensal?: { obligationType: string; label: string };
}

const COMPRAS_DESC = "Atualiza o e-Fatura do mês e grava (sem finalizar) as compras recebidas por e-mail ainda não associadas. Fornecedores em falta ficam no Resultado para a equipa criar.";
const VENDAS_TI_DESC = "Programa de faturação: SAF-T + sugestões de vendas (como nas Empresas). Recibos verdes: Vendas → Recibos Verdes → Atualizar recibos verdes do mês → + (criar e associar) → Gravar → Finalizar e pagar.";
const NAO_CONSIDERAR_DESC = "Compras → e-Fatura do mês → em cada linha, na seta → \"Não considerar este documento na atividade\". Todas as linhas do mês; em caso de dúvida fica por marcar e vai para o Resultado.";
const SALARIOS_DESC = "Contabilidade → Sugestões de salários → Gerar sugestões do mês (só Salários). Não finaliza — fica para revisão.";
const MAPA_ANALISE_DESC = "Trimestral (mês da tarefa = fim do trimestre). Exporta do TOConline o Mapa de Exploração (Contabilidade → Outros mapas, Jan até ao fim do trimestre) e o Balancete dos 3 meses (Contabilidade → Balancetes), em PDF, e importa-os na Análise financeira do cliente. IVA por trimestre à mão: Declaração periódica → Rosto → campo 93 (ou 94 com sinal negativo).";
const CLASSIFICACAO_EFATURA_DESC = "TOConline → Compras → e-Fatura do mês (Nr. Diário). Empresa → Acesso Direto → Portal do e-fatura → Verificar faturas → Aceder; no e-Fatura: Adquirente → Verificar Faturas → cada fatura → Alterar. Com n.º de diário: \"Sim, despesa totalmente afeta\". Sem n.º de diário: \"Não\" (sem preencher o setor).";
const GUIAS_FLEX_IVA_DESC = "Mês da tarefa = mês em que vence a parcela (dia 25). Portal das Finanças pelo Acesso Direto do TOConline → Pagamentos → Flexibilização de Pagamentos → Consultar Plano/Pagar. Referência: descarregar a guia da parcela para o computador. Débito direto: só consultar o valor. No fim, lista com cliente, n.º da parcela e valor.";
/** Salários só para quem tem o campo preenchido na ficha ("Sim até dia 25" / "Sim até ao fim do mês"). */
const temSalarios = (c: any) => /^sim/i.test((c.salarios || "").trim());

export const TOCONLINE_PROCEDURES: ToconlineProcedure[] = [
  // ---- TI Simplificado (TI RS com regime de IVA) ----
  {
    id: "ti_rs_vendas", regime: "ti_rs", tarefa: "vendas", label: "Vendas",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado", filter: SUB_PAGE_CONFIG.TI_iva.filter,
    description: VENDAS_TI_DESC, docPath: "docs/toconline/ti-rs.md",
    gestaoMensal: { obligationType: "contabilidade_TI_iva_vendas", label: "Gestão Mensal → TI Simplificado - Reg. IVA → Vendas" },
  },
  {
    id: "ti_rs_iva_lancar_compras", regime: "ti_rs", tarefa: "compras", label: "Compras",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado", filter: SUB_PAGE_CONFIG.TI_iva.filter,
    description: COMPRAS_DESC, docPath: "docs/toconline/ti-rs.md",
    gestaoMensal: { obligationType: "contabilidade_TI_iva_compras", label: "Gestão Mensal → TI Simplificado - Reg. IVA → Compras" },
  },
  {
    id: "ti_rs_nao_considerar", regime: "ti_rs", tarefa: "nao_considerar", label: "Não considerar da atividade",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado",
    description: NAO_CONSIDERAR_DESC, docPath: "docs/toconline/ti-rs.md",
  },
  {
    id: "ti_rs_salarios", regime: "ti_rs", tarefa: "salarios", label: "Salários",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado", filter: temSalarios,
    description: SALARIOS_DESC, docPath: "docs/toconline/ti-rs.md",
    gestaoMensal: { obligationType: "contabilidade_TI_iva_salários", label: "Gestão Mensal → TI Simplificado - Reg. IVA → Salários" },
  },
  {
    id: "ti_rs_mapa_analise", regime: "ti_rs", tarefa: "mapa_analise", label: "Mapa de análise",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado",
    description: MAPA_ANALISE_DESC, docPath: "docs/toconline/ti-rs.md",
  },
  {
    id: "ti_rs_classificacao_efatura", regime: "ti_rs", tarefa: "classificacao_efatura", label: "Classificação e-Fatura",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado",
    description: CLASSIFICACAO_EFATURA_DESC, docPath: "docs/toconline/ti-rs.md",
  },
  // ---- TI Organizado (TI CO) ----
  {
    id: "ti_co_vendas", regime: "ti_co", tarefa: "vendas", label: "Vendas",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado",
    description: VENDAS_TI_DESC, docPath: "docs/toconline/ti-co.md",
    gestaoMensal: { obligationType: "contabilidade_organizada_vendas", label: "Gestão Mensal → TI Contabilidade Organizada → Vendas" },
  },
  {
    id: "ti_co_lancar_compras", regime: "ti_co", tarefa: "compras", label: "Compras",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado",
    description: COMPRAS_DESC, docPath: "docs/toconline/ti-co.md",
    gestaoMensal: { obligationType: "contabilidade_organizada_compras", label: "Gestão Mensal → TI Contabilidade Organizada → Compras" },
  },
  {
    id: "ti_co_nao_considerar", regime: "ti_co", tarefa: "nao_considerar", label: "Não considerar da atividade",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado",
    description: NAO_CONSIDERAR_DESC, docPath: "docs/toconline/ti-co.md",
  },
  {
    id: "ti_co_salarios", regime: "ti_co", tarefa: "salarios", label: "Salários",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado", filter: temSalarios,
    description: SALARIOS_DESC, docPath: "docs/toconline/ti-co.md",
    gestaoMensal: { obligationType: "contabilidade_organizada_salários", label: "Gestão Mensal → TI Contabilidade Organizada → Salários" },
  },
  {
    id: "ti_co_mapa_analise", regime: "ti_co", tarefa: "mapa_analise", label: "Mapa de análise",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado",
    description: MAPA_ANALISE_DESC, docPath: "docs/toconline/ti-co.md",
  },
  {
    id: "ti_co_classificacao_efatura", regime: "ti_co", tarefa: "classificacao_efatura", label: "Classificação e-Fatura",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado",
    description: CLASSIFICACAO_EFATURA_DESC, docPath: "docs/toconline/ti-co.md",
  },
  // ---- Empresas (SQ) ----
  {
    id: "empresas_importar_vendas", regime: "empresas", tarefa: "vendas", label: "Vendas",
    tipoContabilidade: "SQ", regimeLabel: "Empresas",
    description: "Verifica o SAF-T do mês (se o programa de faturação for externo), gera as sugestões de vendas e finaliza-as (nunca recibos RC).",
    docPath: "docs/toconline/empresas.md",
    gestaoMensal: { obligationType: "contabilidade_empresas_vendas", label: "Gestão Mensal → Empresas → Vendas" },
  },
  {
    id: "empresas_lancar_compras", regime: "empresas", tarefa: "compras", label: "Compras",
    tipoContabilidade: "SQ", regimeLabel: "Empresas",
    description: COMPRAS_DESC, docPath: "docs/toconline/empresas.md",
    gestaoMensal: { obligationType: "contabilidade_empresas_compras", label: "Gestão Mensal → Empresas → Compras" },
  },
  {
    id: "empresas_salarios", regime: "empresas", tarefa: "salarios", label: "Salários",
    tipoContabilidade: "SQ", regimeLabel: "Empresas", filter: temSalarios,
    description: SALARIOS_DESC, docPath: "docs/toconline/empresas.md",
    gestaoMensal: { obligationType: "contabilidade_empresas_salários", label: "Gestão Mensal → Empresas → Salários" },
  },
  {
    id: "empresas_mapa_analise", regime: "empresas", tarefa: "mapa_analise", label: "Mapa de análise",
    tipoContabilidade: "SQ", regimeLabel: "Empresas",
    description: MAPA_ANALISE_DESC, docPath: "docs/toconline/empresas.md",
  },
  // ---- IVA (todos os regimes) ----
  {
    id: "iva_guias_flexibilizacao", regime: "iva", tarefa: "guias_flex_iva", label: "Guias flexibilização IVA",
    tipoContabilidade: null, regimeLabel: "IVA", ivaFlex: true,
    description: GUIAS_FLEX_IVA_DESC, docPath: "docs/toconline/iva-flexibilizacao.md",
  },
];

/** Como o cliente TI emite as vendas, a partir de clients.programa_faturacao:
 * "Portal das Finanças" / "AT" / "Finanças" = recibos verdes; qualquer outro nome = programa de faturação. */
export type TipoFaturacao = "recibos_verdes" | "programa" | "ambos" | "sem_info";

export const TIPO_FATURACAO_LABELS: Record<TipoFaturacao, string> = {
  recibos_verdes: "Recibos verdes",
  programa: "Programa de faturação",
  ambos: "Recibos verdes + programa",
  sem_info: "Sem informação",
};

const PORTAL_RE = /portal|finan[cç]as|\bat\b/gi;

export function tipoFaturacao(programa: string | null | undefined): TipoFaturacao {
  const raw = (programa || "").trim();
  if (!raw) return "sem_info";
  const temPortal = PORTAL_RE.test(raw);
  PORTAL_RE.lastIndex = 0;
  // O que sobra depois de tirar as referências ao Portal/AT e ligações ("+", "e", "/", PIN, notas)
  const resto = raw.replace(PORTAL_RE, " ").replace(/\b(das?|e|pin|pede|pelo|wpp|pedir)\b|[+/;:|()\-\d]/gi, " ").trim();
  if (temPortal && !resto) return "recibos_verdes";
  if (temPortal) return "ambos";
  return "programa";
}

export const procedureFor = (regime: ToconlineRegime, tarefa: ToconlineTarefa) =>
  TOCONLINE_PROCEDURES.find((p) => p.regime === regime && p.tarefa === tarefa);

export const procedureById = (id: string) => TOCONLINE_PROCEDURES.find((p) => p.id === id);

/** Manuais por regime (texto markdown), para a página "Procedimentos". */
export const TOCONLINE_DOCS: { regimeLabel: string; path: string; content: string }[] = [
  { regimeLabel: "Empresas (SQ)", path: "docs/toconline/empresas.md", content: empresasDoc },
  { regimeLabel: "TI Simplificado (TI RS)", path: "docs/toconline/ti-rs.md", content: tiRsDoc },
  { regimeLabel: "TI Contabilidade Organizada (TI CO)", path: "docs/toconline/ti-co.md", content: tiCoDoc },
  { regimeLabel: "IVA — Flexibilização (todos os regimes)", path: "docs/toconline/iva-flexibilizacao.md", content: ivaFlexDoc },
];

export const STATUS_LABELS: Record<ToconlineJobStatus, string> = {
  pendente: "Pendente",
  em_curso: "Em curso",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
  erro: "Erro",
  cancelada: "Cancelada",
};

export const STATUS_CLASSES: Record<ToconlineJobStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_curso: "bg-primary/15 text-primary",
  concluida: "bg-success/15 text-success",
  bloqueada: "bg-warning/15 text-warning",
  erro: "bg-destructive/15 text-destructive",
  cancelada: "bg-muted text-muted-foreground line-through",
};
