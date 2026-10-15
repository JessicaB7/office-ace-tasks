import { describe, it, expect } from "vitest";
import { clientObligationsFor, obligationState, annualObligationsFor } from "./clientObligations";

describe("clientObligations", () => {
  it("SQ com IVA trimestral e salários", () => {
    const c = { tipo_contabilidade: "SQ", iva: "Trimestral", saft: "Automático", salarios: "Sim até dia 25", recapitulativa: "Não Aplicável" };
    const keys = clientObligationsFor(c, 2026, 7).map((o) => o.key);
    expect(keys).toEqual(["SAFT", "IVA", "retencao_fonte", "salarios", "DMR_AT", "DMR_SS"]);
    const ivaAgo = clientObligationsFor(c, 2026, 7).find((o) => o.key === "IVA")!;
    expect(ivaAgo.inPeriod).toBe(false);
    const ivaSet = clientObligationsFor(c, 2026, 8).find((o) => o.key === "IVA")!;
    expect(ivaSet.inPeriod).toBe(true);
    expect(ivaSet.prazo).toBe("20/11/2026");
  });

  it("TI simplificado isento de IVA sem salários", () => {
    const c = { tipo_contabilidade: "TI RS", iva: "Art.53º", seguranca_social: "Trimestral", saft: "Não Aplicável" };
    const obls = clientObligationsFor(c, 2026, 9);
    expect(obls.map((o) => o.key)).toEqual(["SS_TI", "SS_TI_DT"]);
    expect(obls[1].inPeriod).toBe(true);
    expect(obls[1].prazo).toBe("31/10/2026");
    expect(clientObligationsFor(c, 2026, 10)[1].prazo).toBe("31/01/2027");
  });

  it("IVA mensal no fim do ano", () => {
    const iva = clientObligationsFor({ tipo_contabilidade: "SQ", iva: "Mensal" }, 2026, 11).find((o) => o.key === "IVA")!;
    expect(iva.prazo).toBe("20/02/2027");
  });

  it("estados", () => {
    const [ret] = clientObligationsFor({ tipo_contabilidade: "SQ" }, 2026, 0);
    expect(obligationState(ret, { status: "concluida", extra_done: true })).toBe("nao_aplicavel");
    expect(obligationState(ret, undefined)).toBe("pendente");
    const dmr = clientObligationsFor({ tipo_contabilidade: "SQ", salarios: "Sim até dia 25" }, 2026, 0).find((o) => o.key === "DMR_AT")!;
    expect(obligationState(dmr, { status: "concluida", extra_done: false })).toBe("parcial");
    expect(obligationState(dmr, { status: "concluida", extra_done: true })).toBe("concluida");
  });

  it("anuais por regime", () => {
    expect(annualObligationsFor({ tipo_contabilidade: "SQ" })[0].label).toContain("Modelo 22");
    expect(annualObligationsFor({ tipo_contabilidade: "TI RS" })).toHaveLength(2);
  });
});
