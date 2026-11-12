import { describe, it, expect } from "vitest";
import { computeFecho, semaforoDe, diasAte, mesReferenciaPadrao } from "@/lib/fechoMes";
import { makeDayResolver } from "@/lib/deadlineOverrides";
import { deadlineFor } from "@/lib/obrigacoesControlo";

const empresa = (id: string, resp: string | null) => ({
  id, name: id, active: true, responsavel_id: resp, tipo_contabilidade: "SQ",
  saft: "A entregar", salarios: "Não tem", iva: "Mensal", recapitulativa: "Não Aplicável",
});

describe("semaforoDe", () => {
  it("verde com ≥90% ou nada pendente ou prazo a mais de 7 dias", () => {
    expect(semaforoDe(100, null, "2026-11-10")).toBe("verde");
    expect(semaforoDe(92, "2026-11-10", "2026-11-12")).toBe("verde");
    expect(semaforoDe(10, "2026-11-20", "2026-11-12")).toBe("verde");
  });
  it("amarelo entre 3 e 7 dias com pendentes", () => {
    expect(semaforoDe(50, "2026-11-15", "2026-11-12")).toBe("amarelo");
    expect(semaforoDe(50, "2026-11-19", "2026-11-12")).toBe("amarelo");
  });
  it("vermelho a menos de 3 dias ou em atraso", () => {
    expect(semaforoDe(50, "2026-11-14", "2026-11-12")).toBe("vermelho");
    expect(semaforoDe(50, "2026-11-01", "2026-11-12")).toBe("vermelho");
  });
  it("diasAte", () => {
    expect(diasAte("2026-11-12", "2026-11-20")).toBe(8);
    expect(diasAte("2026-03-28", "2026-03-30")).toBe(2); // mudança de hora
  });
});

describe("computeFecho", () => {
  const clients = [empresa("A", "c1"), empresa("B", "c1"), empresa("C", "c2"), { ...empresa("D", "c2"), active: false },
    { ...empresa("E", "c2"), ultimo_mes_responsabilidade: "2026-09-01" }];
  const obligations = [
    { client_id: "A", obligation_type: "SAFT", reference_month: "2026-10-01", status: "concluida" },
    { client_id: "A", obligation_type: "IVA", reference_month: "2026-10-01", status: "concluida" },
    { client_id: "A", obligation_type: "retencao_fonte", reference_month: "2026-10-01", status: "concluida" },
    { client_id: "B", obligation_type: "SAFT", reference_month: "2026-10-01", status: "concluida" },
    { client_id: "C", obligation_type: "SAFT", reference_month: "2026-09-01", status: "concluida" }, // outro mês
  ];
  const r = computeFecho(clients, obligations, "2026-10-01", "2026-11-12");

  it("conta só clientes ativos no mês (inativos e saídas anteriores ficam de fora)", () => {
    expect(r.total.total).toBe(9); // 3 clientes × (SAFT, IVA, Retenção)
    expect(r.total.feitas).toBe(4);
  });
  it("por responsável, com % e semáforo", () => {
    const c1 = r.porResponsavel.find((g) => g.key === "c1")!;
    expect(c1.total).toBe(6);
    expect(c1.feitas).toBe(4);
    expect(c1.pct).toBe(67);
    // pendentes de B: IVA (20/12) e retenção (20/11) → 8 dias → verde
    expect(c1.proximoPrazo).toBe("2026-11-20");
    expect(c1.semaforo).toBe("verde");
    const c2 = r.porResponsavel.find((g) => g.key === "c2")!;
    expect(c2.pct).toBe(0);
    expect(c2.proximoPrazo).toBe("2026-11-05"); // SAFT de outubro, já passou
    expect(c2.semaforo).toBe("vermelho");
  });
  it("por tipo de obrigação, com a lista do que falta", () => {
    const saft = r.porObrigacao.find((g) => g.key === "SAFT")!;
    expect(saft.total).toBe(3);
    expect(saft.emFalta.map((f) => f.client.id)).toEqual(["C"]);
    expect(r.porObrigacao.find((g) => g.key === "DMR")).toBeUndefined();
  });
  it("aplica as prorrogações dos prazos", () => {
    const dayFor = makeDayResolver([{ deadline_key: "SAFT", year: 2026, month: 11, day: 12 }]);
    expect(deadlineFor(empresa("X", null), "SAFT", "status", "2026-10-01", dayFor)).toBe("2026-11-12");
    expect(deadlineFor(empresa("X", null), "SAFT", "status", "2026-10-01")).toBe("2026-11-05");
    const r2 = computeFecho(clients, obligations, "2026-10-01", "2026-11-09", dayFor);
    expect(r2.porObrigacao.find((g) => g.key === "SAFT")!.proximoPrazo).toBe("2026-11-12");
  });
});

describe("mesReferenciaPadrao", () => {
  it("é o mês anterior", () => {
    expect(mesReferenciaPadrao(new Date(2026, 10, 12))).toBe("2026-10-01");
    expect(mesReferenciaPadrao(new Date(2026, 0, 5))).toBe("2025-12-01");
  });
});
