import { describe, expect, test } from "vitest";
import { calcIRS, calcIrsConjunto, irsLiquido, rendimentoColetavelConjuge } from "../irs";

const r2 = (n: number) => Math.round(n * 100) / 100;

describe("calcIRS (escalões 2026)", () => {
  test("1.º escalão e escalão intermédio", () => {
    expect(calcIRS(0)).toBe(0);
    expect(r2(calcIRS(8000))).toBe(1000);
    expect(r2(calcIRS(20000))).toBe(r2(20000 * 0.241 - 1476.45));
  });
});

describe("irsLiquido", () => {
  test("o reembolso nunca passa das retenções", () => {
    expect(irsLiquido(100, 500, 300)).toBe(-300);
    expect(irsLiquido(1000, 250, 300)).toBe(450);
  });
});

describe("rendimentoColetavelConjuge", () => {
  test("cat. A: dedução específica mínima 4.587,09 €", () => {
    const r = rendimentoColetavelConjuge(20000, "bruto_a");
    expect(r.deducaoEspecifica).toBe(4587.09);
    expect(r2(r.coletavel)).toBe(15412.91);
  });
  test("cat. A: 11% de SS quando é maior", () => {
    const r = rendimentoColetavelConjuge(50000, "bruto_a");
    expect(r.deducaoEspecifica).toBe(5500);
    expect(r.coletavel).toBe(44500);
  });
  test("cat. A: rendimento baixo fica a zero (sem negativo)", () => {
    expect(rendimentoColetavelConjuge(3000, "bruto_a").coletavel).toBe(0);
  });
  test("valor já coletável usa-se tal como está", () => {
    expect(rendimentoColetavelConjuge(12000, "coletavel")).toEqual({ coletavel: 12000, deducaoEspecifica: 0 });
  });
});

describe("calcIrsConjunto (quociente conjugal)", () => {
  test("rendimentos desiguais: conjunto = 2 × IRS(RC/2) e poupa face ao separado", () => {
    const r = calcIrsConjunto({
      rcTitular: 41569.57,
      deducoesTitular: 250,
      retencoesTitular: 103.77,
      conjuge: { rendimento: 15000, tipo: "coletavel", deducoes: 250, retencoes: 1200 },
    });
    expect(r.rcTotal).toBeCloseTo(56569.57, 2);
    expect(r.quociente).toBeCloseTo(28284.785, 3);
    expect(r.coleta).toBeCloseTo(2 * (28284.785 * 0.311 - 3092.77), 2);
    expect(r.deducoes).toBe(500);
    expect(r.retencoes).toBeCloseTo(1303.77, 2);
    expect(r.liquido).toBeCloseTo(r.coleta - 500 - 1303.77, 2);
    expect(r.separado.titular).toBeCloseTo(calcIRS(41569.57) - 250 - 103.77, 2);
    expect(r.separado.conjuge).toBeCloseTo(calcIRS(15000) - 250 - 1200, 2);
    expect(r.poupancaConjunto).toBeGreaterThan(0);
    expect(r.poupancaConjunto).toBeCloseTo(r.separado.total - r.liquido, 2);
  });

  test("rendimentos iguais: conjunto igual ao separado", () => {
    const r = calcIrsConjunto({
      rcTitular: 20000,
      deducoesTitular: 250,
      retencoesTitular: 1000,
      conjuge: { rendimento: 20000, tipo: "coletavel", deducoes: 250, retencoes: 1000 },
    });
    expect(r.poupancaConjunto).toBeCloseTo(0, 2);
  });

  test("cônjuge com salário bruto: aplica a dedução específica e o reembolso fica limitado às retenções", () => {
    const r = calcIrsConjunto({
      rcTitular: 0,
      deducoesTitular: 250,
      retencoesTitular: 0,
      conjuge: { rendimento: 4000, tipo: "bruto_a", deducoes: 250, retencoes: 150 },
    });
    expect(r.rcConjuge).toBe(0);
    expect(r.coleta).toBe(0);
    expect(r.liquido).toBe(-150);
  });
});
