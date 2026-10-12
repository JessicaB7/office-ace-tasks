import { describe, it, expect } from "vitest";
import { obrigacoesForClient, isObrigacaoDone, saftModo, ssPagamento, deadlineFor } from "@/lib/obrigacoesControlo";

const labels = (c: any, m: string) => obrigacoesForClient(c, m).map((t) => t.label);

describe("obrigacoesForClient", () => {
  it("empresa com salários e IVA trimestral", () => {
    const c = { tipo_contabilidade: "SQ", saft: "A entregar", salarios: "Sim até dia 25", iva: "Trimestral", recapitulativa: "Não Aplicável" };
    expect(labels(c, "2026-08-01")).toEqual(["SAFT", "Salários", "Envio salários", "DMR AT guia", "DMR AT pagam.", "DMR SS guia", "DMR SS pagam.", "Retenção fonte"]);
    expect(labels(c, "2026-09-01")).toContain("IVA trimestral");
  });
  it("TI sem salários: SS mensal e declaração trimestral só em Jan/Abr/Jul/Out", () => {
    const c = { tipo_contabilidade: "TI RS", seguranca_social: "Trimestral", iva: "Art.53º" };
    expect(labels(c, "2026-09-01")).toEqual(["SS TI"]);
    expect(labels(c, "2026-10-01")).toEqual(["SS TI", "SS declaração"]);
  });
  it("TI isento de SS não tem pagamento SS", () => {
    expect(labels({ tipo_contabilidade: "TI RS", seguranca_social: "Isento" }, "2026-09-01")).toEqual([]);
  });
  it("antes do início do contrato não há obrigações", () => {
    expect(obrigacoesForClient({ tipo_contabilidade: "SQ", inicio_contrato: "2026-10-15" }, "2026-09-01")).toEqual([]);
  });
  it("status vs extra_done", () => {
    const [proc, envio] = obrigacoesForClient({ salarios: "Sim até dia 25" }, "2026-09-01");
    expect(isObrigacaoDone(proc, { status: "concluida" })).toBe(true);
    expect(isObrigacaoDone(envio, { status: "concluida", extra_done: false })).toBe(false);
    expect(isObrigacaoDone(envio, { extra_done: true })).toBe(true);
  });
});

describe("filtros dentro das obrigações", () => {
  it("SAFT automático vs manual", () => {
    expect(saftModo({ saft: "Automático" })).toBe("Automático");
    expect(saftModo({ saft: "A entregar" })).toBe("Manual");
  });
  it("forma de pagamento SS", () => {
    expect(ssPagamento({ pag_seguranca_social: "Débito Direto" })).toBe("Débito Direto");
    expect(ssPagamento({ pag_seguranca_social: "" })).toBe("Sem forma de pagamento");
  });
  it("DMR tem AT/SS e guia/pagamento", () => {
    const dmr = obrigacoesForClient({ salarios: "Sim até dia 25" }, "2026-09-01").filter((t) => t.group === "DMR");
    expect(dmr.map((t) => `${t.meta.dmr}-${t.meta.fase}`)).toEqual(["AT-Guia", "AT-Pagamento", "SS-Guia", "SS-Pagamento"]);
  });
});

describe("deadlineFor", () => {
  it("prazos mensais", () => {
    expect(deadlineFor({}, "SAFT", "status", "2026-09-01")).toBe("2026-10-05");
    expect(deadlineFor({}, "SAFT", "status", "2026-03-01")).toBe("2026-04-08");
    expect(deadlineFor({}, "DMR_AT", "status", "2026-09-01")).toBe("2026-10-10");
    expect(deadlineFor({}, "DMR_SS", "status", "2026-09-01")).toBe("2026-10-10");
    expect(deadlineFor({}, "DMR_SS", "extra", "2026-09-01")).toBe("2026-10-25");
    expect(deadlineFor({}, "DMR_AT", "extra", "2026-09-01")).toBe("2026-10-20");
    expect(deadlineFor({ salarios: "Sim até dia 25" }, "salarios", "status", "2026-09-01")).toBe("2026-10-25");
    expect(deadlineFor({ salarios: "Sim até ao fim do mês" }, "salarios", "status", "2026-09-01")).toBe("2026-10-31");
    expect(deadlineFor({}, "retencao_fonte", "status", "2026-12-01")).toBe("2027-01-20");
  });
  it("IVA e recapitulativa", () => {
    expect(deadlineFor({ iva: "Mensal" }, "IVA", "status", "2026-08-01")).toBe("2026-10-20");
    expect(deadlineFor({ iva: "Trimestral" }, "IVA", "status", "2026-09-01")).toBe("2026-11-20");
    expect(deadlineFor({ recapitulativa: "Mensal" }, "IVA_recapitulativa", "status", "2026-09-01")).toBe("2026-10-20");
    expect(deadlineFor({ recapitulativa: "Trimestral" }, "IVA_recapitulativa", "status", "2026-09-01")).toBe("2026-10-20");
  });
  it("declaração trimestral SS no último dia do mês", () => {
    expect(deadlineFor({}, "SS_TI_DT", "status", "2026-04-01")).toBe("2026-04-30");
    expect(deadlineFor({}, "SS_TI_DT", "status", "2026-10-01")).toBe("2026-10-31");
  });
});
