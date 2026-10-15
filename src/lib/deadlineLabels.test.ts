import { describe, it, expect } from "vitest";
import { referenceLabel, relativeDeadline, shortDate } from "./deadlineLabels";

describe("deadlineLabels", () => {
  it("período de referência", () => {
    expect(referenceLabel(9, 2026, 1, false)).toBe("Referente a setembro");
    expect(referenceLabel(0, 2027, 1, false)).toBe("Referente a dezembro 2026");
    expect(referenceLabel(1, 2027, 2, true)).toBe("Referente ao 4º trimestre 2026");
    expect(referenceLabel(4, 2026, 2, true)).toBe("Referente ao 1º trimestre");
    expect(referenceLabel(9, 2026, 3, true)).toBe("Referente ao 3º trimestre");
  });

  it("data curta", () => {
    expect(shortDate(new Date(2026, 9, 20))).toBe("ter, 20 out");
  });

  it("quanto falta", () => {
    const today = new Date(2026, 9, 15, 22, 0);
    expect(relativeDeadline(new Date(2026, 9, 15), today, false)).toEqual({ label: "Termina hoje", tone: "urgente" });
    expect(relativeDeadline(new Date(2026, 9, 16), today, false).label).toBe("Termina amanhã");
    expect(relativeDeadline(new Date(2026, 9, 20), today, false)).toEqual({ label: "Faltam 5 dias", tone: "proximo" });
    expect(relativeDeadline(new Date(2026, 9, 13), today, false)).toEqual({ label: "Terminou há 2 dias", tone: "atrasado" });
    expect(relativeDeadline(new Date(2026, 9, 13), today, true).tone).toBe("concluido");
  });
});
