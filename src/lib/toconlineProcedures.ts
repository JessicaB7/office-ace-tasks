// Procedimentos TOConline que podem ser ativados na Fila. Cada procedimento está
// descrito passo a passo em docs/toconline/<regime>.md (o manual que o Claude
// segue no TOConline pelo Claude in Chrome).
import empresasDoc from "../../docs/toconline/empresas.md?raw";

export type ToconlineJobStatus = "pendente" | "em_curso" | "concluida" | "bloqueada" | "erro" | "cancelada";

export interface ToconlineProcedure {
  id: string;
  label: string;
  /** Regime a que se aplica (valor de clients.tipo_contabilidade). */
  tipoContabilidade: "SQ" | "TI CO" | "TI RS";
  regimeLabel: string;
  description: string;
  /** Ficheiro do manual em docs/toconline/ */
  docPath: string;
  /** Obrigação da Gestão Mensal que fica feita quando a tarefa é concluída. */
  gestaoMensal?: { obligationType: string; label: string };
}

export const TOCONLINE_PROCEDURES: ToconlineProcedure[] = [
  {
    id: "empresas_importar_vendas",
    label: "Importar as vendas",
    tipoContabilidade: "SQ",
    regimeLabel: "Empresas",
    description: "Verifica o SAF-T do mês (se o programa de faturação for externo), gera as sugestões de vendas e finaliza-as (nunca recibos RC).",
    docPath: "docs/toconline/empresas.md",
    gestaoMensal: { obligationType: "contabilidade_empresas_vendas", label: "Gestão Mensal → Empresas → Vendas" },
  },
];

export const procedureById = (id: string) => TOCONLINE_PROCEDURES.find((p) => p.id === id);

/** Manuais por regime (texto markdown), para a página "Procedimentos". */
export const TOCONLINE_DOCS: { regimeLabel: string; path: string; content: string }[] = [
  { regimeLabel: "Empresas (SQ)", path: "docs/toconline/empresas.md", content: empresasDoc },
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
