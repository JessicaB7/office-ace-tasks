// Procedimentos TOConline que podem ser ativados na Fila. Cada procedimento está
// descrito passo a passo em docs/toconline/<regime>.md (o manual que o Claude
// segue no TOConline pelo Claude in Chrome).
import empresasDoc from "../../docs/toconline/empresas.md?raw";
import tiRsDoc from "../../docs/toconline/ti-rs.md?raw";
import tiCoDoc from "../../docs/toconline/ti-co.md?raw";
import { SUB_PAGE_CONFIG } from "@/lib/contabilidadesConfig";

export type ToconlineJobStatus = "pendente" | "em_curso" | "concluida" | "bloqueada" | "erro" | "cancelada";

export type ToconlineRegime = "ti_rs" | "ti_co" | "empresas";
export type ToconlineTarefa = "vendas" | "compras" | "salarios";

/** Separadores da Fila: um por regime. */
export const TOCONLINE_REGIMES: { id: ToconlineRegime; label: string }[] = [
  { id: "ti_rs", label: "TI Simplificado" },
  { id: "ti_co", label: "TI Organizado" },
  { id: "empresas", label: "Empresas" },
];

/** Tarefas disponíveis em cada regime. */
export const TOCONLINE_TAREFAS: { id: ToconlineTarefa; label: string }[] = [
  { id: "vendas", label: "Vendas" },
  { id: "compras", label: "Compras" },
  { id: "salarios", label: "Salários" },
];

export interface ToconlineProcedure {
  id: string;
  regime: ToconlineRegime;
  tarefa: ToconlineTarefa;
  label: string;
  /** Regime a que se aplica (valor de clients.tipo_contabilidade). */
  tipoContabilidade: "SQ" | "TI CO" | "TI RS";
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
const SEM_MANUAL_DESC = "Ainda sem procedimento escrito — ensina o Claude primeiro (passo a passo) para ele o poder fazer. Se for ativada, fica Bloqueada com \"Sem manual\".";
const temSalarios = (c: any) => c.salarios !== "Não tem";

export const TOCONLINE_PROCEDURES: ToconlineProcedure[] = [
  // ---- TI Simplificado (TI RS com regime de IVA) ----
  {
    id: "ti_rs_vendas", regime: "ti_rs", tarefa: "vendas", label: "Vendas",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado", filter: SUB_PAGE_CONFIG.TI_iva.filter,
    description: SEM_MANUAL_DESC,
    gestaoMensal: { obligationType: "contabilidade_TI_iva_vendas", label: "Gestão Mensal → TI Simplificado - Reg. IVA → Vendas" },
  },
  {
    id: "ti_rs_iva_lancar_compras", regime: "ti_rs", tarefa: "compras", label: "Compras",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado", filter: SUB_PAGE_CONFIG.TI_iva.filter,
    description: COMPRAS_DESC, docPath: "docs/toconline/ti-rs.md",
    gestaoMensal: { obligationType: "contabilidade_TI_iva_compras", label: "Gestão Mensal → TI Simplificado - Reg. IVA → Compras" },
  },
  {
    id: "ti_rs_salarios", regime: "ti_rs", tarefa: "salarios", label: "Salários",
    tipoContabilidade: "TI RS", regimeLabel: "TI Simplificado", filter: (c) => SUB_PAGE_CONFIG.TI_iva.filter(c) && temSalarios(c),
    description: SEM_MANUAL_DESC,
    gestaoMensal: { obligationType: "contabilidade_TI_iva_salários", label: "Gestão Mensal → TI Simplificado - Reg. IVA → Salários" },
  },
  // ---- TI Organizado (TI CO) ----
  {
    id: "ti_co_vendas", regime: "ti_co", tarefa: "vendas", label: "Vendas",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado",
    description: SEM_MANUAL_DESC,
    gestaoMensal: { obligationType: "contabilidade_organizada_vendas", label: "Gestão Mensal → TI Contabilidade Organizada → Vendas" },
  },
  {
    id: "ti_co_lancar_compras", regime: "ti_co", tarefa: "compras", label: "Compras",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado",
    description: COMPRAS_DESC, docPath: "docs/toconline/ti-co.md",
    gestaoMensal: { obligationType: "contabilidade_organizada_compras", label: "Gestão Mensal → TI Contabilidade Organizada → Compras" },
  },
  {
    id: "ti_co_salarios", regime: "ti_co", tarefa: "salarios", label: "Salários",
    tipoContabilidade: "TI CO", regimeLabel: "TI Organizado", filter: temSalarios,
    description: SEM_MANUAL_DESC,
    gestaoMensal: { obligationType: "contabilidade_organizada_salários", label: "Gestão Mensal → TI Contabilidade Organizada → Salários" },
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
    description: SEM_MANUAL_DESC,
    gestaoMensal: { obligationType: "contabilidade_empresas_salários", label: "Gestão Mensal → Empresas → Salários" },
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
