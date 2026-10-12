/** Controlo interno das Obrigações Mensais: que obrigações cada cliente tem num
 * mês de referência e quando cada uma conta como feita — as mesmas regras dos
 * separadores de ObrigacoesView (filtros de cliente, meses trimestrais e
 * colunas status/extra_done). Puro, sem side effects. */

export interface ObrigacaoTask {
  /** Separador das Obrigações Mensais (id do subPage em ObrigacoesView). */
  group: string;
  label: string;
  /** `monthly_obligations.obligation_type` */
  type: string;
  /** "status" = coluna principal (status concluida); "extra" = segunda coluna (extra_done). */
  field: "status" | "extra";
  /** Valores para os filtros dentro da obrigação (ver OBRIGACAO_SUBFILTERS). */
  meta: Record<string, string>;
  /** Prazo legal ("YYYY-MM-DD"). */
  deadline: string;
}

/** Filtros que aparecem ao escolher uma obrigação: dimensão → valores possíveis. */
export const OBRIGACAO_SUBFILTERS: Record<string, { key: string; label: string; options: string[] }[]> = {
  SAFT: [{ key: "modo", label: "Modo", options: ["Automático", "Manual"] }],
  DMR: [
    { key: "dmr", label: "DMR", options: ["AT", "SS"] },
    { key: "fase", label: "Fase", options: ["Guia", "Pagamento"] },
  ],
  SS_TI: [{ key: "pagamento", label: "Forma de pagamento", options: ["Referência", "Débito Direto", "Sem forma de pagamento"] }],
  IVA: [{ key: "periodicidade", label: "Periodicidade", options: ["Mensal", "Trimestral"] }],
  IVA_recapitulativa: [{ key: "periodicidade", label: "Periodicidade", options: ["Mensal", "Trimestral"] }],
};

/** SAFT "A entregar" é o envio manual; "Automático" é automático. */
export const saftModo = (c: any) => (c.saft === "Automático" ? "Automático" : "Manual");
/** Forma de pagamento da SS TI, ou "Sem forma de pagamento". */
export const ssPagamento = (c: any) =>
  c.pag_seguranca_social === "Referência" || c.pag_seguranca_social === "Débito Direto" ? c.pag_seguranca_social : "Sem forma de pagamento";

export const OBRIGACAO_GROUPS: { id: string; label: string }[] = [
  { id: "SAFT", label: "SAFT" },
  { id: "salarios", label: "Salários" },
  { id: "DMR", label: "DMR" },
  { id: "SS_TI", label: "Segurança Social TI" },
  { id: "IVA", label: "IVA - Periódica" },
  { id: "IVA_recapitulativa", label: "IVA - Recapitulativa" },
  { id: "retencao_fonte", label: "Retenção na Fonte" },
];

const hasSalarios = (c: any) => !!c.salarios && c.salarios !== "Não tem";
const isTI = (c: any) => c.tipo_contabilidade === "TI RS" || c.tipo_contabilidade === "TI CO";

/** Mês 0-11 de "YYYY-MM-01". */
const monthIndex = (month: string) => Number(month.slice(5, 7)) - 1;
const isQuarterEnd = (month: string) => monthIndex(month) % 3 === 2;

/** Data "YYYY-MM-DD" do dia `day` do mês `monthIdx` (pode passar de 11 — avança o ano);
 * dias acima do fim do mês ficam no último dia. */
const ymd = (year: number, monthIdx: number, day: number) => {
  const first = new Date(year, monthIdx, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const d = Math.min(day, last);
  return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

/** Prazo legal de uma obrigação para o mês de referência `month` — os mesmos prazos
 * dos separadores das Obrigações Mensais e do "O meu dia". */
export const deadlineFor = (c: any, type: string, field: "status" | "extra", month: string): string => {
  const y = Number(month.slice(0, 4));
  const m = monthIndex(month);
  const qEnd = m - (m % 3) + 2;
  switch (type) {
    case "SAFT": return ymd(y, m + 1, m + 1 === 3 ? 8 : 5); // em Abril o prazo é dia 8
    case "salarios": return c.salarios === "Sim até ao fim do mês" ? ymd(y, m + 1, 31) : ymd(y, m + 1, 25);
    // Guia até dia 10; pagamento AT até dia 20, pagamento SS até dia 25.
    case "DMR_AT": return ymd(y, m + 1, field === "status" ? 10 : 20);
    case "DMR_SS": return ymd(y, m + 1, field === "status" ? 10 : 25);
    case "SS_TI": return ymd(y, m + 1, 20);
    case "SS_TI_DT": return ymd(y, m, 31); // último dia do próprio mês (Jan/Abr/Jul/Out)
    case "IVA": return c.iva === "Trimestral" ? ymd(y, qEnd + 2, 20) : ymd(y, m + 2, 20);
    case "IVA_recapitulativa": return c.recapitulativa === "Trimestral" ? ymd(y, qEnd + 1, 20) : ymd(y, m + 1, 20);
    case "retencao_fonte": return ymd(y, m + 1, 20);
    default: return ymd(y, m + 1, 20);
  }
};

/** Obrigações do cliente no mês de referência (vazio se o contrato ainda não tinha começado). */
export const obrigacoesForClient = (c: any, month: string): ObrigacaoTask[] => {
  if (c.inicio_contrato && c.inicio_contrato.slice(0, 7) > month.slice(0, 7)) return [];
  const m = monthIndex(month);
  const out: ObrigacaoTask[] = [];
  const add = (group: string, label: string, type: string, field: "status" | "extra" = "status", meta: Record<string, string> = {}) =>
    out.push({ group, label, type, field, meta, deadline: deadlineFor(c, type, field, month) });

  if (c.saft && c.saft !== "Não Aplicável") add("SAFT", "SAFT", "SAFT", "status", { modo: saftModo(c) });
  if (hasSalarios(c)) {
    add("salarios", "Salários", "salarios");
    add("salarios", "Envio salários", "salarios", "extra");
    add("DMR", "DMR AT guia", "DMR_AT", "status", { dmr: "AT", fase: "Guia" });
    add("DMR", "DMR AT pagam.", "DMR_AT", "extra", { dmr: "AT", fase: "Pagamento" });
    add("DMR", "DMR SS guia", "DMR_SS", "status", { dmr: "SS", fase: "Guia" });
    add("DMR", "DMR SS pagam.", "DMR_SS", "extra", { dmr: "SS", fase: "Pagamento" });
  }
  if (isTI(c) && !hasSalarios(c) && c.seguranca_social !== "Isento") add("SS_TI", "SS TI", "SS_TI", "status", { pagamento: ssPagamento(c) });
  // Declaração trimestral da SS: só em Janeiro, Abril, Julho e Outubro.
  if (isTI(c) && [0, 3, 6, 9].includes(m)) add("SS_TI", "SS declaração", "SS_TI_DT", "status", { pagamento: ssPagamento(c) });
  if (c.iva === "Mensal" || (c.iva === "Trimestral" && isQuarterEnd(month))) {
    add("IVA", c.iva === "Mensal" ? "IVA mensal" : "IVA trimestral", "IVA", "status", { periodicidade: c.iva });
  }
  if (c.recapitulativa === "Mensal" || (c.recapitulativa === "Trimestral" && isQuarterEnd(month))) {
    add("IVA_recapitulativa", c.recapitulativa === "Mensal" ? "Recap. mensal" : "Recap. trimestral", "IVA_recapitulativa", "status", { periodicidade: c.recapitulativa });
  }
  if (c.tipo_contabilidade === "SQ" || c.tipo_contabilidade === "TI CO") add("retencao_fonte", "Retenção fonte", "retencao_fonte");
  return out;
};

export const isObrigacaoDone = (task: ObrigacaoTask, obl: any): boolean =>
  task.field === "status" ? obl?.status === "concluida" : obl?.extra_done === true;

/** "YYYY-MM-DD" de hoje (hora local). */
export const todayYmd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "dd/mm" de um "YYYY-MM-DD". */
export const fmtPrazo = (ymdStr: string) => `${ymdStr.slice(8, 10)}/${ymdStr.slice(5, 7)}`;
