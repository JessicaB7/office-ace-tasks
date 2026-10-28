import { describe, it, expect } from "vitest";
import { buildRobotResumo } from "./robotAnalise";
import type { FinancialAccount, FinancialEntry, FinancialSettings } from "@/hooks/useClientFinancials";

const acc = (code: string, section: FinancialAccount["section"]): FinancialAccount => ({ code, name: code, section, display_order: 0 });
const accounts = [acc("72", "vendas"), acc("62", "despesas"), acc("6221", "despesas"), acc("63", "pessoal")];
const e = (month: number, account_code: string, value: number): FinancialEntry => ({ client_id: "c", year: 2026, month, account_code, value });
const settings = { corporate_tax_rate: 0.16, ta_representacao: 0.1, ta_kms: 0.05, ta_nao_doc: 0.5 } as unknown as FinancialSettings;

describe("buildRobotResumo", () => {
  const r = buildRobotResumo({
    regime: "SQ", year: 2026, accounts, settings,
    entries: [e(1, "72", 1000), e(1, "62", 200), e(4, "72", 500), e(4, "6221", 50), e(4, "63", 300)],
    dashboard: {
      faturacao: 1500, resultado: 950,
      impostos: [{ imposto: "IVA", linhas: [{ descricao: "Total", valor: -7.344 }], porTrimestre: [-7.34, 3, 0, 0] }],
    },
  });

  it("período até ao último mês com dados e geral a partir do dashboard", () => {
    expect(r.periodo).toBe("janeiro a abril de 2026");
    expect(r.geral).toEqual({ faturacao: 1500, despesas: 550, resultado: 950, margemPct: 63.33 });
  });

  it("evolução por trimestre do Mapa de Exploração", () => {
    expect(r.evolucaoPorTrimestre).toEqual([
      { trimestre: "1º trimestre", faturacao: 1000, despesas: 200 },
      { trimestre: "2º trimestre", faturacao: 500, despesas: 350 },
    ]);
  });

  it("impostos cortados aos trimestres com dados", () => {
    expect(r.impostos[0].porTrimestre).toEqual([
      { trimestre: "1º trimestre", valor: -7.34 },
      { trimestre: "2º trimestre", valor: 3 },
    ]);
    expect(r.impostos[0].linhas[0].valor).toBe(-7.34);
  });
});

describe("buildRobotResumo — ano anterior", () => {
  const base = {
    regime: "TI RS", year: 2026, accounts, settings,
    entries: [e(1, "72", 1000), e(2, "72", 500)],
    dashboard: { faturacao: 1500, resultado: 1500, impostos: [] },
  };

  it("faturação do ano anterior no ano todo e no mesmo período", () => {
    const prev = [{ ...e(1, "72", 300), year: 2025 }, { ...e(2, "72", 200), year: 2025 }, { ...e(11, "72", 400), year: 2025 }];
    const r = buildRobotResumo({ ...base, entriesAnoAnterior: prev });
    expect(r.anoAnterior).toEqual({ ano: 2025, faturacaoAnual: 900, faturacaoMesmoPeriodo: 500 });
  });

  it("sem dados do ano anterior não há comparação", () => {
    expect(buildRobotResumo({ ...base, entriesAnoAnterior: [] }).anoAnterior).toBeUndefined();
    expect(buildRobotResumo(base).anoAnterior).toBeUndefined();
  });
});
