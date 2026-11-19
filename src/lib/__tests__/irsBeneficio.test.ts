import { describe, expect, test } from "vitest";
import { calcIRS } from "../irs";
import { aplicarBeneficioIrs, LIMITE_IRS_JOVEM, lerSeletorBeneficio, valorSeletorBeneficio } from "../irsBeneficio";

describe("aplicarBeneficioIrs", () => {
  test("sem benefício = IRS sobre tudo", () => {
    const r = aplicarBeneficioIrs(20000, 1000, null);
    expect(r.coletavel).toBe(21000);
    expect(r.coleta).toBeCloseTo(calcIRS(21000), 6);
  });

  test("IRS Jovem: taxa determinada com os rendimentos isentos (englobamento)", () => {
    const r = aplicarBeneficioIrs(20000, 0, { tipo: "jovem", pct: 0.5 });
    expect(r.isento).toBe(10000);
    expect(r.coletavel).toBe(10000);
    expect(r.coleta).toBeCloseTo(calcIRS(20000) * 0.5, 6);
    expect(r.coleta).toBeGreaterThan(calcIRS(10000));
  });

  test("IRS Jovem: isenção limitada a 55 × IAS", () => {
    const r = aplicarBeneficioIrs(40000, 0, { tipo: "jovem", pct: 1 });
    expect(LIMITE_IRS_JOVEM).toBe(29542.15);
    expect(r.isento).toBe(LIMITE_IRS_JOVEM);
    expect(r.limitado).toBe(true);
    expect(r.coletavel).toBeCloseTo(40000 - 29542.15, 6);
    expect(r.coleta).toBeCloseTo(calcIRS(40000) * (40000 - 29542.15) / 40000, 6);
  });

  test("IRS Jovem: outros rendimentos não são isentos mas entram na taxa", () => {
    const r = aplicarBeneficioIrs(10000, 5000, { tipo: "jovem", pct: 0.75 });
    expect(r.isento).toBe(7500);
    expect(r.coletavel).toBe(7500);
    expect(r.baseTaxa).toBe(15000);
  });

  test("Programa Regressar: 50% excluído, sem limite nem englobamento", () => {
    const r = aplicarBeneficioIrs(80000, 0, { tipo: "regressar", pct: 0.5 });
    expect(r.isento).toBe(40000);
    expect(r.coleta).toBeCloseTo(calcIRS(40000), 6);
  });

  test("seletor", () => {
    expect(valorSeletorBeneficio({ tipo: "jovem", pct: 0 })).toBe("0");
    expect(lerSeletorBeneficio("regressar:0.5")).toEqual({ tipo: "regressar", pct: 0.5 });
    expect(lerSeletorBeneficio("0").pct).toBe(0);
  });
});
