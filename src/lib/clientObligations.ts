/** Obrigações fiscais de um cliente, derivadas do enquadramento da ficha — a mesma
 * lógica de elegibilidade da vista de Obrigações (ObrigacoesView), mas para um só
 * cliente. Os tipos (`types`) são as chaves de `monthly_obligations.obligation_type`. */

import { DEADLINE_KEYS as K, defaultDayResolver, type DayResolver } from "./deadlineOverrides";

export type ObligationKind = "simples" | "guia_pagamento" | "retencao";

export interface ClientObligation {
  key: string;
  label: string;
  periodicidade: string;
  /** Prazo da obrigação referente ao mês `month0`/`year` (texto pronto a mostrar). */
  prazo: string;
  type: string;
  kind: ObligationKind;
  /** false quando a obrigação não tem registo neste mês (ex.: trimestral fora do fim do trimestre). */
  inPeriod: boolean;
}

export type ObligationState = "concluida" | "parcial" | "pendente" | "nao_aplicavel" | "fora_periodo";

export interface AnnualObligation {
  label: string;
  prazo: string;
}

const QEND = [2, 2, 2, 5, 5, 5, 8, 8, 8, 11, 11, 11];

const addMonths = (m: number, y: number, n: number) => {
  const total = m + n;
  return { m: ((total % 12) + 12) % 12, y: y + Math.floor(total / 12) };
};
const fmt = (day: number, m0: number, y: number) =>
  `${String(day).padStart(2, "0")}/${String(m0 + 1).padStart(2, "0")}/${y}`;
const lastDay = (m0: number, y: number) => new Date(y, m0 + 1, 0).getDate();

const hasSalarios = (c: any) => !!c.salarios && c.salarios !== "Não tem";
const isTI = (c: any) => c.tipo_contabilidade === "TI RS" || c.tipo_contabilidade === "TI CO";

/** Obrigações mensais/trimestrais aplicáveis ao cliente, com o prazo do mês indicado. */
export function clientObligationsFor(c: any, year: number, month0: number, dayFor: DayResolver = defaultDayResolver): ClientObligation[] {
  const list: ClientObligation[] = [];
  // Prazo com eventual prorrogação nesse mês
  const at = (key: string, day: number, d: { m: number; y: number }) => fmt(dayFor(key, d.y, d.m, day), d.m, d.y);
  const next = addMonths(month0, year, 1);
  const isQEnd = QEND[month0] === month0;
  const afterQ = (n: number) => addMonths(QEND[month0], year, n);

  if (c.saft && c.saft !== "Não Aplicável") {
    list.push({
      key: "SAFT", label: "SAF-T (faturação)", periodicidade: `Mensal · ${c.saft}`,
      prazo: at(K.SAFT, next.m === 3 ? 8 : 5, next), type: "SAFT", kind: "simples", inPeriod: true,
    });
  }

  if (c.faturacao === "Emitir") {
    const freq = c.faturacao_frequencia || "—";
    list.push({
      key: "emissao_faturas", label: "Emissão de faturas", periodicidade: freq,
      prazo: freq === "Semanal" ? "Sexta-feira" : "—", type: "emissao_faturas", kind: "simples", inPeriod: true,
    });
  }

  if (c.iva === "Mensal" || c.iva === "Trimestral") {
    const d = c.iva === "Mensal" ? addMonths(month0, year, 2) : afterQ(2);
    list.push({
      key: "IVA", label: "IVA – Declaração periódica", periodicidade: c.iva,
      prazo: at(c.iva === "Mensal" ? K.IVA_MENSAL : K.IVA_TRIMESTRAL, 20, d), type: "IVA", kind: "simples", inPeriod: c.iva === "Mensal" || isQEnd,
    });
  }

  if (c.iva_oss === "Sim") {
    const d = afterQ(1);
    list.push({
      key: "IVA_OSS", label: "IVA – OSS", periodicidade: "Trimestral",
      prazo: at(K.IVA_OSS, 15, d), type: "IVA_OSS", kind: "simples", inPeriod: isQEnd,
    });
  }

  if (c.recapitulativa === "Mensal" || c.recapitulativa === "Trimestral") {
    const d = c.recapitulativa === "Mensal" ? next : afterQ(1);
    list.push({
      key: "IVA_recapitulativa", label: "IVA – Declaração recapitulativa", periodicidade: c.recapitulativa,
      prazo: at(c.recapitulativa === "Mensal" ? K.RECAP_MENSAL : K.RECAP_TRIMESTRAL, 20, d), type: "IVA_recapitulativa", kind: "simples",
      inPeriod: c.recapitulativa === "Mensal" || isQEnd,
    });
  }

  if (c.tipo_contabilidade === "SQ" || c.tipo_contabilidade === "TI CO") {
    list.push({
      key: "retencao_fonte", label: "Retenções na fonte", periodicidade: "Mensal",
      prazo: at(K.RETENCAO, 20, next), type: "retencao_fonte", kind: "retencao", inPeriod: true,
    });
  }

  if (hasSalarios(c)) {
    const prazo = c.salarios === "Sim até dia 25"
      ? at(K.SALARIOS_PROC, 25, { m: month0, y: year })
      : fmt(lastDay(month0, year), month0, year);
    list.push({
      key: "salarios", label: "Processamento de salários", periodicidade: `Mensal · ${c.salarios}`,
      prazo, type: "salarios", kind: "guia_pagamento", inPeriod: true,
    });
    list.push({
      key: "DMR_AT", label: "DMR AT", periodicidade: "Mensal",
      prazo: `guia ${at(K.DMR_AT_GUIA, 10, next)} · pag. ${at(K.DMR_AT_PAG, 20, next)}`,
      type: "DMR_AT", kind: "guia_pagamento", inPeriod: true,
    });
    list.push({
      key: "DMR_SS", label: "DMR Segurança Social", periodicidade: "Mensal",
      prazo: `guia ${at(K.DMR_SS_GUIA, 10, next)} · pag. ${at(K.DMR_SS_PAG, 25, next)}`,
      type: "DMR_SS", kind: "guia_pagamento", inPeriod: true,
    });
  }

  if (isTI(c)) {
    if (!hasSalarios(c) && c.seguranca_social !== "Isento") {
      list.push({
        key: "SS_TI", label: "Segurança Social – pagamento", periodicidade: `Mensal${c.pag_seguranca_social ? ` · ${c.pag_seguranca_social}` : ""}`,
        prazo: at(K.SS_TI_PAG, 20, next), type: "SS_TI", kind: "simples", inPeriod: true,
      });
    }
    // Declaração trimestral: entregue em Jan/Abr/Jul/Out (registo nesse mês), até ao último dia.
    const dtMonth = [0, 3, 6, 9].includes(month0);
    const dt = dtMonth ? { m: month0, y: year } : addMonths(month0 - (month0 % 3), year, 3);
    list.push({
      key: "SS_TI_DT", label: "Segurança Social – declaração trimestral",
      periodicidade: `Trimestral${c.seguranca_social ? ` · ${c.seguranca_social}` : ""}`,
      prazo: at(K.SS_TI_DT, 31, dt), type: "SS_TI_DT", kind: "simples", inPeriod: dtMonth,
    });
  }

  return list;
}

/** Estado de uma obrigação a partir do registo do mês (ou undefined se não houver). */
export function obligationState(o: ClientObligation, record: any | undefined): ObligationState {
  if (!record) return o.inPeriod ? "pendente" : "fora_periodo";
  const done = record.status === "concluida";
  const extra = record.extra_done === true;
  switch (o.kind) {
    case "retencao":
      return done ? (extra ? "nao_aplicavel" : "concluida") : "pendente";
    case "guia_pagamento":
      // guia/processamento = status; pagamento = extra_done
      return done && extra ? "concluida" : done || extra ? "parcial" : "pendente";
    default:
      return done ? "concluida" : "pendente";
  }
}

/** Obrigações anuais do regime (informativas, sem registo mensal). */
export function annualObligationsFor(c: any): AnnualObligation[] {
  switch (c.tipo_contabilidade) {
    case "SQ":
      return [
        { label: "Modelo 22 (IRC)", prazo: "Até 31 de maio" },
        { label: "IES / Declaração anual", prazo: "Até 15 de julho" },
        { label: "Pagamentos por conta IRC (se aplicável)", prazo: "15 de julho, setembro e dezembro" },
      ];
    case "TI CO":
      return [
        { label: "IRS Modelo 3 (Anexo C)", prazo: "1 de abril a 30 de junho" },
        { label: "IES / Declaração anual", prazo: "Até 15 de julho" },
        { label: "Pagamentos por conta IRS (se aplicável)", prazo: "20 de julho, setembro e dezembro" },
      ];
    case "TI RS":
      return [
        { label: "IRS Modelo 3 (Anexo B)", prazo: "1 de abril a 30 de junho" },
        { label: "Pagamentos por conta IRS (se aplicável)", prazo: "20 de julho, setembro e dezembro" },
      ];
    default:
      return [];
  }
}
