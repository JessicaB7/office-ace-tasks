import { describe, expect, test } from "vitest";
import { calcIRS } from "../irs";
import { aplicarBeneficioIrs, LIMITE_IRS_JOVEM, lerSeletorBeneficio, valorSeletorBeneficio } from "../irsBeneficio";

describe("aplicarBeneficioIrs", () => {
  test("sem benefício = IRS sobre faturação × coeficiente + outros", () => {
    const r = aplicarBeneficioIrs({ bruto: 20000, coeficiente: 0.75, outros: 1000 }, null);
    expect(r.coletavel).toBe(16000);
    expect(r.coleta).toBeCloseTo(calcIRS(16000), 6);
  });

  test("IRS Jovem igual à liquidação real de 2025 (29 265 €, campo 404, 50%)", () => {
    const r = aplicarBeneficioIrs({ bruto: 29265, coeficiente: 0.35 }, { tipo: "jovem", pct: 0.5 });
    expect(r.isento).toBe(14632.5);
    expect(r.coletavel).toBeCloseTo(5121.375, 6);
    expect(r.baseTaxa).toBeCloseTo(19753.875, 6);
    // a AT: (importância − parcela) × coletável ÷ base = coleta; o resto é o «imposto dos rendimentos isentos»
    expect(r.coleta).toBeCloseTo(calcIRS(19753.875) * 5121.375 / 19753.875, 6);
    expect(r.impostoIsentos + r.coleta).toBeCloseTo(calcIRS(19753.875), 6);
  });

  test("IRS Jovem: isenção sobre a faturação limitada a 55 × IAS", () => {
    const r = aplicarBeneficioIrs({ bruto: 50000, coeficiente: 0.75 }, { tipo: "jovem", pct: 1 });
    expect(LIMITE_IRS_JOVEM).toBe(29542.15);
    expect(r.isento).toBe(LIMITE_IRS_JOVEM);
    expect(r.limitado).toBe(true);
    expect(r.coletavel).toBeCloseTo((50000 - 29542.15) * 0.75, 6);
    expect(r.baseTaxa).toBeCloseTo((50000 - 29542.15) * 0.75 + 29542.15, 6);
  });

  test("IRS Jovem: acréscimo dos 15% na proporção não isenta e outros rendimentos sem isenção", () => {
    const r = aplicarBeneficioIrs({ bruto: 10000, coeficiente: 0.75, acrescimo: 400, outros: 1000 }, { tipo: "jovem", pct: 0.75 });
    expect(r.isento).toBe(7500);
    expect(r.atividade).toBe(1875);
    expect(r.acrescimo).toBe(100);
    expect(r.coletavel).toBe(2975);
    expect(r.baseTaxa).toBe(10475);
  });

  test("Programa Regressar: 50% excluído, sem limite nem englobamento", () => {
    const r = aplicarBeneficioIrs({ bruto: 80000, coeficiente: 0.75 }, { tipo: "regressar", pct: 0.5 });
    expect(r.isento).toBe(40000);
    expect(r.coletavel).toBe(30000);
    expect(r.coleta).toBeCloseTo(calcIRS(30000), 6);
  });

  test("seletor", () => {
    expect(valorSeletorBeneficio({ tipo: "jovem", pct: 0 })).toBe("0");
    expect(lerSeletorBeneficio("regressar:0.5")).toEqual({ tipo: "regressar", pct: 0.5 });
    expect(lerSeletorBeneficio("0").pct).toBe(0);
  });
});
