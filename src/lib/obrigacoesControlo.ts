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
}

export const OBRIGACAO_GROUPS: { id: string; label: string }[] = [
  { id: "SAFT", label: "SAFT" },
  { id: "salarios", label: "Salários" },
  { id: "DMR", label: "DMR" },
  { id: "SS_TI", label: "Segurança Social TI" },
  { id: "IVA", label: "IVA - Periódica" },
  { id: "IVA_recapitulativa", label: "IVA - Recapitulativa" },
  { id: "retencao_fonte", label: "Retenção na Fonte" },
  { id: "emissao_faturas", label: "Emissão de Faturas" },
];

const hasSalarios = (c: any) => !!c.salarios && c.salarios !== "Não tem";
const isTI = (c: any) => c.tipo_contabilidade === "TI RS" || c.tipo_contabilidade === "TI CO";

/** Mês 0-11 de "YYYY-MM-01". */
const monthIndex = (month: string) => Number(month.slice(5, 7)) - 1;
const isQuarterEnd = (month: string) => monthIndex(month) % 3 === 2;

/** Obrigações do cliente no mês de referência (vazio se o contrato ainda não tinha começado). */
export const obrigacoesForClient = (c: any, month: string): ObrigacaoTask[] => {
  if (c.inicio_contrato && c.inicio_contrato.slice(0, 7) > month.slice(0, 7)) return [];
  const m = monthIndex(month);
  const out: ObrigacaoTask[] = [];
  const add = (group: string, label: string, type: string, field: "status" | "extra" = "status") =>
    out.push({ group, label, type, field });

  if (c.saft && c.saft !== "Não Aplicável") add("SAFT", "SAFT", "SAFT");
  if (hasSalarios(c)) {
    add("salarios", "Salários", "salarios");
    add("salarios", "Envio salários", "salarios", "extra");
    add("DMR", "DMR AT guia", "DMR_AT");
    add("DMR", "DMR AT pagam.", "DMR_AT", "extra");
    add("DMR", "DMR SS guia", "DMR_SS");
    add("DMR", "DMR SS pagam.", "DMR_SS", "extra");
  }
  if (isTI(c) && !hasSalarios(c) && c.seguranca_social !== "Isento") add("SS_TI", "SS TI", "SS_TI");
  // Declaração trimestral da SS: só em Janeiro, Abril, Julho e Outubro.
  if (isTI(c) && [0, 3, 6, 9].includes(m)) add("SS_TI", "SS declaração", "SS_TI_DT");
  if (c.iva === "Mensal" || (c.iva === "Trimestral" && isQuarterEnd(month))) add("IVA", "IVA entregue", "IVA");
  if (c.recapitulativa === "Mensal" || (c.recapitulativa === "Trimestral" && isQuarterEnd(month))) {
    add("IVA_recapitulativa", "Recapitulativa", "IVA_recapitulativa");
  }
  if (c.tipo_contabilidade === "SQ" || c.tipo_contabilidade === "TI CO") add("retencao_fonte", "Retenção fonte", "retencao_fonte");
  if (c.faturacao === "Emitir" && (c.faturacao_frequencia === "Mensal" || c.faturacao_frequencia === "Semanal")) {
    add("emissao_faturas", "Emissão faturas", "emissao_faturas");
  }
  return out;
};

export const isObrigacaoDone = (task: ObrigacaoTask, obl: any): boolean =>
  task.field === "status" ? obl?.status === "concluida" : obl?.extra_done === true;
