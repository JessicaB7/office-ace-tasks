import { describe, it, expect } from "vitest";
import { isColumnApplicable, isColumnOffMonth, columnLabel, isObligationSatisfied, ivaObligationTypeFor } from "@/lib/contabilidadesConfig";

describe("isColumnApplicable — IVA", () => {
  it("IVA mensal aplica-se todos os meses", () => {
    expect(isColumnApplicable({ iva: "Mensal" }, "IVA", "2026-08-01")).toBe(true);
    expect(isColumnApplicable({ iva: "Mensal" }, "IVA", "2026-09-01")).toBe(true);
  });
  it("IVA trimestral só no último mês do trimestre", () => {
    expect(isColumnApplicable({ iva: "Trimestral" }, "IVA", "2026-08-01")).toBe(false);
    expect(isColumnApplicable({ iva: "Trimestral" }, "IVA", "2026-09-01")).toBe(true);
    expect(isColumnApplicable({ iva: "Trimestral" }, "IVA", "2026-12-01")).toBe(true);
    expect(isColumnOffMonth({ iva: "Trimestral" }, "IVA", "2026-10-01")).toBe(true);
    expect(isColumnOffMonth({ iva: "Trimestral" }, "IVA", "2026-12-01")).toBe(false);
  });
  it("isentos não têm IVA", () => {
    expect(isColumnApplicable({ iva: "Art.53º" }, "IVA", "2026-09-01")).toBe(false);
    expect(isColumnOffMonth({ iva: "Art.53º" }, "IVA", "2026-09-01")).toBe(false);
    expect(isObligationSatisfied({ iva: "Art.53º" }, "IVA", undefined, "2026-09-01")).toBe(true);
  });
  it("nome da tarefa no trimestral é Apuramento IVA", () => {
    expect(columnLabel({ iva: "Trimestral" }, "IVA")).toBe("Apuramento IVA");
    expect(columnLabel({ iva: "Mensal" }, "IVA")).toBe("IVA");
    expect(columnLabel({ iva: "Mensal" }, "Vendas")).toBe("Vendas");
  });
  it("Salários continua não aplicável quando não tem", () => {
    expect(isColumnApplicable({ salarios: "Não tem" }, "Salários", "2026-09-01")).toBe(false);
  });
});

describe("isColumnApplicable — Depreciações", () => {
  it("só existe a partir de janeiro de 2027", () => {
    expect(isColumnApplicable({}, "Depreciações", "2026-12-01")).toBe(false);
    expect(isColumnOffMonth({}, "Depreciações", "2026-09-01")).toBe(true);
    expect(isColumnApplicable({}, "Depreciações", "2027-01-01")).toBe(true);
    expect(isColumnOffMonth({}, "Depreciações", "2027-02-01")).toBe(false);
  });
});

describe("ivaObligationTypeFor — ligação ao IVA Periódica", () => {
  it("usa a tarefa IVA do regime do cliente", () => {
    expect(ivaObligationTypeFor({ tipo_contabilidade: "TI RS", iva: "Mensal" })).toBe("contabilidade_TI_iva_iva");
    expect(ivaObligationTypeFor({ tipo_contabilidade: "TI CO", iva: "Trimestral" })).toBe("contabilidade_organizada_iva");
    expect(ivaObligationTypeFor({ tipo_contabilidade: "SQ", iva: "Mensal" })).toBe("contabilidade_empresas_iva");
  });
  it("TI Simplificado isento não tem tarefa IVA", () => {
    expect(ivaObligationTypeFor({ tipo_contabilidade: "TI RS", iva: "Art.53º" })).toBeNull();
  });
});
