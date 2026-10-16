import { describe, it, expect } from "vitest";
import { buildRobotResumo } from "./robotAnalise";
import type { FinancialAccount, FinancialEntry, FinancialSettings } from "@/hooks/useClientFinancials";

const acc = (code: string, section: FinancialAccount["section"]): FinancialAccount => ({ code, name: code, section, display_order: 0 });
const accounts = [acc("72", "vendas"), acc("62", "despesas"), acc("6221", "despesas"), acc("63", "pessoal")];
const e = (month: number, account_code: string, value: number): FinancialEntry => ({ client_id: "c", year: 2026, month, account_code, value });
const settings = { corporate_tax_rate: 0.16, ta_representacao: 0.1, ta_kms: 0.05, ta_nao_doc: 0.5, iva_q1: -7.34, iva_q2: null, iva_q3: null, iva_q4: null,
  ss_q1: 0, ss_q2: 0, ss_q3: 0, ss_q4: 0, outras_despesas_valor: 0, outras_despesas_label: "" } as unknown as FinancialSettings;

describe("buildRobotResumo", () => {
  it("resume até ao último mês com dados, por trimestre e por rubrica", () => {
    const r = buildRobotResumo({
      regime: "SQ", year: 2026, accounts, settings,
      entries: [e(1, "72", 1000), e(1, "62", 200), e(4, "72", 500), e(4, "6221", 50), e(4, "63", 300)],
      prevEntries: [{ ...e(2, "72", 800), year: 2025 }],
    });
    expect(r.ultimoMes).toBe(4);
    expect(r.periodo).toBe("janeiro a abril de 2026");
    expect(r.porTrimestre).toEqual([
      { trimestre: "1º trimestre", rendimentos: 1000, gastos: 200, resultado: 800 },
      { trimestre: "2º trimestre", rendimentos: 500, gastos: 350, resultado: 150 },
    ]);
    expect(r.totais).toEqual({ rendimentos: 1500, gastos: 550, resultado: 950, margemPct: 63.33 });
    expect(r.rubricas.find((x) => x.conta === "62")?.total).toBe(250);
    expect(r.anoAnteriorMesmoPeriodo).toEqual({ rendimentos: 800, gastos: 0, resultado: 800 });
    expect(r.ivaPorTrimestre).toEqual([{ trimestre: "1º trimestre", valor: -7.34 }]);
    expect(r.segurancaSocialTrimestral).toBeUndefined();
  });

  it("TI: SS trimestral = valor mensal × 3", () => {
    const r = buildRobotResumo({ regime: "TI RS", year: 2026, accounts, settings: { ...settings, ss_q1: 100 }, entries: [e(2, "72", 1000)] });
    expect(r.segurancaSocialTrimestral).toEqual([{ trimestre: "1º trimestre", valor: 300 }]);
  });
});
