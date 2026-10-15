import { describe, it, expect } from "vitest";
import { associatedTasksFor, periodLabel } from "./associatedTasks";

describe("associatedTasks", () => {
  it("TI: e-Fatura + mapas de análise", () => {
    const t = associatedTasksFor("contabilidade_TI_iva_iva", { iva: "Trimestral" }, "2026-09-01");
    expect(t.map((x) => x.title)).toEqual([
      "Classificação das despesas no e-Fatura (3º trimestre 2026)",
      "Mapas de análise (3º trimestre 2026)",
    ]);
    expect(t[0].marker).toBe("Associada ao apuramento IVA 2026-09 · e-Fatura");
  });

  it("empresa: só mapas de análise; mensal usa o mês", () => {
    const t = associatedTasksFor("contabilidade_empresas_iva", { iva: "Mensal" }, "2026-09-01");
    expect(t.map((x) => x.kind)).toEqual(["mapas"]);
    expect(periodLabel({ iva: "Mensal" }, "2026-09-01")).toBe("setembro 2026");
  });

  it("outros tipos não têm tarefas associadas", () => {
    expect(associatedTasksFor("IVA", { iva: "Mensal" }, "2026-09-01")).toEqual([]);
  });
});
