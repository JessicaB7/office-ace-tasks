import { describe, expect, it } from "vitest";
import { calcDespesas15, isCoeficienteSujeito15 } from "./despesas15";

describe("calcDespesas15 (art. 31.º n.os 13/14 CIRS)", () => {
  it("só se aplica aos coeficientes 0,75 e 0,35", () => {
    expect(isCoeficienteSujeito15(0.75)).toBe(true);
    expect(isCoeficienteSujeito15(0.35)).toBe(true);
    expect(isCoeficienteSujeito15(0.15)).toBe(false);
    expect(isCoeficienteSujeito15(0.95)).toBe(false);
    const r = calcDespesas15({ rendimentoBruto: 100000, coeficiente: 0.15, segurancaSocial: 0, despesasAtividade: 0 });
    expect(r.aplicavel).toBe(false);
    expect(r.acrescimo).toBe(0);
  });

  it("até 30.580,60 € a dedução de 4.587,09 € cobre os 15%", () => {
    const r = calcDespesas15({ rendimentoBruto: 30580.6, coeficiente: 0.75, segurancaSocial: 0, despesasAtividade: 0 });
    expect(r.exigido).toBe(4587.09);
    expect(r.justificado).toBe(4587.09);
    expect(r.cumpre).toBe(true);
    expect(r.acrescimo).toBe(0);
    const acima = calcDespesas15({ rendimentoBruto: 30600, coeficiente: 0.75, segurancaSocial: 0, despesasAtividade: 0 });
    expect(acima.cumpre).toBe(false);
    expect(acima.acrescimo).toBe(2.91);
  });

  it("acima disso, sem despesas, a diferença é acrescida", () => {
    const r = calcDespesas15({ rendimentoBruto: 50000, coeficiente: 0.75, segurancaSocial: 0, despesasAtividade: 0 });
    expect(r.exigido).toBe(7500);
    expect(r.emFalta).toBe(2912.91);
    expect(r.acrescimo).toBe(2912.91);
    expect(r.cumpre).toBe(false);
  });

  it("usa a SS quando superior a 4.587,09 € e soma despesas e extra", () => {
    const r = calcDespesas15({
      rendimentoBruto: 60000,
      coeficiente: 0.75,
      segurancaSocial: 5000,
      despesasAtividade: 2500,
      despesasExtra: 1000,
    });
    expect(r.deducaoEspecifica).toBe(5000);
    expect(r.deducaoEspecificaOrigem).toBe("ss");
    expect(r.justificado).toBe(8500);
    expect(r.exigido).toBe(9000);
    expect(r.acrescimo).toBe(500);
  });

  it("cumpre quando as despesas chegam aos 15%", () => {
    const r = calcDespesas15({ rendimentoBruto: 40000, coeficiente: 0.35, segurancaSocial: 2000, despesasAtividade: 3000 });
    expect(r.deducaoEspecificaOrigem).toBe("fixa");
    expect(r.justificado).toBe(7587.09);
    expect(r.cumpre).toBe(true);
    expect(r.acrescimo).toBe(0);
  });

  it("ignora valores negativos", () => {
    const r = calcDespesas15({ rendimentoBruto: 40000, coeficiente: 0.75, segurancaSocial: -10, despesasAtividade: -500, despesasExtra: -1 });
    expect(r.despesas).toBe(0);
    expect(r.acrescimo).toBe(1412.91);
  });
});
