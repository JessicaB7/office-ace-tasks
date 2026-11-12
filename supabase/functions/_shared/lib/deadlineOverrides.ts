/** Prorrogações de prazos fiscais num mês específico (tabela `fiscal_deadline_overrides`).
 * Cada prazo da app tem uma chave estável; sem prorrogação vale o dia normal. */

export const DEADLINE_KEYS = {
  SAFT: "SAFT",
  DMR_AT_GUIA: "DMR_AT_guia",
  DMR_SS_GUIA: "DMR_SS_guia",
  DMR_AT_PAG: "DMR_AT_pagamento",
  DMR_SS_PAG: "DMR_SS_pagamento",
  PEDIR_DOC: "pedir_documentacao",
  IVA_MENSAL: "IVA_mensal",
  IVA_TRIMESTRAL: "IVA_trimestral",
  RECAP_MENSAL: "recapitulativa_mensal",
  RECAP_TRIMESTRAL: "recapitulativa_trimestral",
  RETENCAO: "retencao_fonte",
  SS_TI_PAG: "SS_TI_pagamento",
  SALARIOS_PROC: "salarios_processamento",
  SS_TI_DT: "SS_TI_declaracao",
  IVA_OSS: "IVA_OSS",
} as const;

export interface DeadlineOverride {
  deadline_key: string;
  year: number;
  month: number; // 1–12
  day: number;
}

/** Função que devolve o dia efetivo do prazo `key` no mês `m0` (0–11) de `year`. */
export type DayResolver = (key: string, year: number, m0: number, defaultDay: number) => number;

export function makeDayResolver(overrides: DeadlineOverride[]): DayResolver {
  const map = new Map(overrides.map((o) => [`${o.deadline_key}|${o.year}|${o.month}`, o.day]));
  return (key, year, m0, defaultDay) => {
    const dim = new Date(year, m0 + 1, 0).getDate();
    const day = map.get(`${key}|${year}|${m0 + 1}`) ?? defaultDay;
    return Math.min(day, dim);
  };
}

/** Sem prorrogações: dia normal (limitado ao último dia do mês). */
export const defaultDayResolver: DayResolver = makeDayResolver([]);
