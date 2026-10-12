import { describe, it, expect } from "vitest";
import { obrigacoesForClient, isObrigacaoDone } from "@/lib/obrigacoesControlo";

const labels = (c: any, m: string) => obrigacoesForClient(c, m).map((t) => t.label);

describe("obrigacoesForClient", () => {
  it("empresa com salários e IVA trimestral", () => {
    const c = { tipo_contabilidade: "SQ", saft: "A entregar", salarios: "Sim até dia 25", iva: "Trimestral", recapitulativa: "Não Aplicável" };
    expect(labels(c, "2026-08-01")).toEqual(["SAFT", "Salários", "Envio salários", "DMR AT guia", "DMR AT pagam.", "DMR SS guia", "DMR SS pagam.", "Retenção fonte"]);
    expect(labels(c, "2026-09-01")).toContain("IVA entregue");
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
