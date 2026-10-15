import { describe, it, expect } from "vitest";
import { makeDayResolver, defaultDayResolver } from "./deadlineOverrides";

describe("deadlineOverrides", () => {
  it("aplica a prorrogação só no mês indicado", () => {
    const r = makeDayResolver([{ deadline_key: "IVA_mensal", year: 2026, month: 10, day: 27 }]);
    expect(r("IVA_mensal", 2026, 9, 20)).toBe(27);
    expect(r("IVA_mensal", 2026, 10, 20)).toBe(20);
    expect(r("SAFT", 2026, 9, 5)).toBe(5);
  });

  it("limita ao último dia do mês", () => {
    expect(defaultDayResolver("SS_TI_declaracao", 2026, 3, 31)).toBe(30);
  });
});
