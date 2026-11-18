// Obrigações pontuais (anuais): pagamentos por conta (TI e empresas), análise da entidade contratante
// e análise da Segurança Social na contabilidade organizada. Regras puras, sem efeitos laterais.
// Registos em `monthly_obligations` com reference_month = 1 de janeiro do ano.
import { ativoNoMes } from "./clientSaida";

export type PontualTabId = "ppc_ti" | "ppc_empresas" | "entidade_contratante" | "ss_co";

export interface PontualColuna {
  type: string;
  label: string;
  /** Prazo legal (mês 1–12 e dia); sem prazo = análise anual. */
  prazo?: { mes: number; dia: number };
}

export interface PontualTab {
  id: PontualTabId;
  label: string;
  descricao: string;
  /** Tipos de contabilidade abrangidos. */
  tipos: string[];
  colunas: PontualColuna[];
}

export const PONTUAL_PPC_TYPES = ["pontual_ppc_1", "pontual_ppc_2", "pontual_ppc_3"] as const;

const ppcColunas = (dia: number): PontualColuna[] => [
  { type: "pontual_ppc_1", label: "1.º pagamento", prazo: { mes: 7, dia } },
  { type: "pontual_ppc_2", label: "2.º pagamento", prazo: { mes: 9, dia } },
  { type: "pontual_ppc_3", label: "3.º pagamento", prazo: { mes: 12, dia } },
];

export const PONTUAL_TABS: PontualTab[] = [
  {
    id: "ppc_ti",
    label: "Pagamentos por conta — TI",
    descricao: "Pagamentos por conta de IRS (se aplicável): até 20 de julho, setembro e dezembro.",
    tipos: ["TI RS", "TI CO"],
    colunas: ppcColunas(20),
  },
  {
    id: "ppc_empresas",
    label: "Pagamentos por conta — Empresas",
    descricao: "Pagamentos por conta de IRC (se aplicável): até 15 de julho, setembro e dezembro.",
    tipos: ["SQ"],
    colunas: ppcColunas(15),
  },
  {
    id: "entidade_contratante",
    label: "Entidade contratante",
    descricao: "Análise anual da entidade contratante (Segurança Social) — todos os clientes.",
    tipos: ["SQ", "TI CO", "TI RS"],
    colunas: [{ type: "pontual_entidade_contratante", label: "Análise feita" }],
  },
  {
    id: "ss_co",
    label: "SS contabilidade organizada",
    descricao: "Análise anual da Segurança Social dos trabalhadores independentes com contabilidade organizada.",
    tipos: ["TI CO"],
    colunas: [{ type: "pontual_ss_co", label: "Análise feita" }],
  },
];

export const pontualTab = (id: string | null | undefined): PontualTab =>
  PONTUAL_TABS.find((t) => t.id === id) ?? PONTUAL_TABS[0];

/** Mês de referência dos registos do ano. */
export const pontualReferenceMonth = (ano: number) => `${ano}-01-01`;

/** Tipo onde se guarda a nota do cliente no separador (a da 1.ª coluna). */
export const pontualNotaType = (tab: PontualTab) => tab.colunas[0].type;

type ClientLike = {
  tipo_contabilidade?: string | null;
  active?: boolean | null;
  ultimo_mes_responsabilidade?: string | null;
  inicio_contrato?: string | null;
};

/** O cliente está na carteira em algum mês do ano (começou até dezembro e não saiu antes de janeiro). */
export function ativoNoAno(c: ClientLike, ano: number): boolean {
  if (c.inicio_contrato && c.inicio_contrato.slice(0, 4) > String(ano)) return false;
  return ativoNoMes(c, `${ano}-01`);
}

export function elegivel(c: ClientLike, tab: PontualTab, ano: number): boolean {
  return tab.tipos.includes(c.tipo_contabilidade ?? "") && ativoNoAno(c, ano);
}

/** Data-limite (YYYY-MM-DD) de uma coluna no ano, ou null. */
export function prazoData(col: PontualColuna, ano: number): string | null {
  if (!col.prazo) return null;
  return `${ano}-${String(col.prazo.mes).padStart(2, "0")}-${String(col.prazo.dia).padStart(2, "0")}`;
}

export const prazoLabel = (col: PontualColuna) => {
  if (!col.prazo) return "Análise anual";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `Até ${col.prazo.dia} ${meses[col.prazo.mes - 1]}`;
};

/** Prazo ultrapassado (hoje depois da data-limite). `hoje` em YYYY-MM-DD. */
export function prazoUltrapassado(col: PontualColuna, ano: number, hoje: string): boolean {
  const d = prazoData(col, ano);
  return !!d && hoje > d;
}

type Obl = { client_id: string; obligation_type: string; status?: string | null };

export const isFeito = (o: Obl | undefined | null) => o?.status === "concluida";

/** Mapa tipo → cliente → registo. */
export function mapaObrigacoes<T extends Obl>(obls: T[]): Record<string, Record<string, T>> {
  const m: Record<string, Record<string, T>> = {};
  for (const o of obls) (m[o.obligation_type] ??= {})[o.client_id] = o;
  return m;
}

/** Cliente com tudo feito no separador. */
export function clienteConcluido(
  clientId: string,
  tab: PontualTab,
  mapa: Record<string, Record<string, Obl>>,
): boolean {
  return tab.colunas.every((col) => isFeito(mapa[col.type]?.[clientId]));
}

/** Contagem do separador: clientes concluídos de Y, tarefas feitas de N. */
export function contarPontuais(
  clientIds: string[],
  tab: PontualTab,
  mapa: Record<string, Record<string, Obl>>,
) {
  let tarefas = 0;
  let feitas = 0;
  let concluidos = 0;
  for (const id of clientIds) {
    let todas = true;
    for (const col of tab.colunas) {
      tarefas++;
      if (isFeito(mapa[col.type]?.[id])) feitas++;
      else todas = false;
    }
    if (todas) concluidos++;
  }
  return { clientes: clientIds.length, concluidos, tarefas, feitas };
}
