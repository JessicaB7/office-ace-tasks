import { describe, it, expect } from "vitest";
import { parcelasDevidasEm, parcelaPrazo, parcelasDoTrimestre, metodoPagamentoIva } from "./ivaFlex";

describe("ivaFlex", () => {
  it("3º trimestre só tem 2 parcelas", () => {
    expect(parcelasDoTrimestre(8)).toEqual([1, 2]);
    expect(parcelasDoTrimestre(5)).toEqual([1, 2, 3]);
  });

  it("datas limite por trimestre (4º trimestre no ano seguinte)", () => {
    expect(parcelaPrazo(5, 2026, 1)).toBe("25/09/2026");
    expect(parcelaPrazo(8, 2026, 2)).toBe("25/12/2026");
    expect(parcelaPrazo(11, 2026, 3)).toBe("25/04/2027");
    expect(parcelaPrazo(2, 2026, 1)).toBe("25/05/2026");
    expect(parcelaPrazo(2, 2026, 3)).toBe("25/07/2026");
  });

  it("parcelas que vencem num mês", () => {
    expect(parcelasDevidasEm(2026, 9).map((p) => [p.quarterEndMonth, p.parcela])).toEqual([["2026-06-01", 2]]);
    expect(parcelasDevidasEm(2026, 10).map((p) => [p.quarterEndMonth, p.parcela])).toEqual([["2026-06-01", 3], ["2026-09-01", 1]]);
    expect(parcelasDevidasEm(2027, 1).map((p) => [p.quarterEndMonth, p.parcela])).toEqual([["2026-12-01", 1]]);
    expect(parcelasDevidasEm(2026, 0)).toEqual([]);
    expect(parcelasDevidasEm(2026, 4).map((p) => [p.quarterEndMonth, p.parcela])).toEqual([["2026-03-01", 1]]);
  });

  it("lê o método escrito à mão", () => {
    expect(metodoPagamentoIva("referencia")).toBe("Referência");
    expect(metodoPagamentoIva("Débito direto")).toBe("Débito direto");
    expect(metodoPagamentoIva("debio direo")).toBe("Débito direto");
    expect(metodoPagamentoIva("CHECK")).toBeNull();
  });
});
