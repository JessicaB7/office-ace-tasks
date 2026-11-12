import { describe, it, expect } from "vitest";
import { pedidosDocumentosPendentes, filtrarTimeline, type TimelineEntry } from "@/lib/clientContacts";
import { agruparErros, motivoNormalizado } from "@/lib/toconlineErros";
import { trimestreAtual, fimTrimestre, contagemMapas } from "@/lib/mapasTrimestrais";

describe("pedidosDocumentosPendentes", () => {
  const c = (client_id: string, tipo: string, data: string) => ({ client_id, tipo, data });
  it("pedido há mais de 5 dias sem contacto posterior", () => {
    const list = [
      c("A", "pedido_documentos", "2026-11-01"),
      c("B", "pedido_documentos", "2026-11-01"), c("B", "chamada", "2026-11-03"),
      c("C", "pedido_documentos", "2026-11-10"),
      c("D", "email", "2026-10-01"),
    ];
    expect(pedidosDocumentosPendentes(list, "2026-11-12").map((x) => x.client_id)).toEqual(["A"]);
  });
});

describe("filtrarTimeline", () => {
  const e = (tipo: string, resumo: string): TimelineEntry =>
    ({ origem: "contacto", id: resumo, quando: "2026-11-01", tipo, titulo: null, resumo, autor: "Ana", seguimento_em: null, created_by: null });
  it("filtra por tipo e pesquisa", () => {
    const list = [e("chamada", "Falámos do IVA"), e("email", "Enviei a guia")];
    expect(filtrarTimeline(list, "all", "iva").length).toBe(1);
    expect(filtrarTimeline(list, "email", "").length).toBe(1);
    expect(filtrarTimeline(list, "all", "ana").length).toBe(2);
  });
});

describe("agruparErros", () => {
  it("junta o mesmo procedimento com o mesmo motivo", () => {
    const g = agruparErros([
      { procedure_id: "p1", result_notes: "Sem acesso ao e-Fatura  " },
      { procedure_id: "p1", result_notes: "sem acesso ao e-fatura" },
      { procedure_id: "p2", result_notes: "Sem acesso ao e-Fatura" },
      { procedure_id: "p1", result_notes: null },
    ]);
    expect(g.map((x) => x.jobs.length)).toEqual([2, 1, 1]);
    expect(motivoNormalizado("Falhou a 12/10/2026")).toBe(motivoNormalizado("Falhou a 13/10/2026"));
  });
});

describe("mapas trimestrais", () => {
  it("trimestre já terminado mais recente", () => {
    expect(trimestreAtual(new Date(2026, 10, 12))).toEqual({ year: 2026, q: 3 });
    expect(trimestreAtual(new Date(2026, 1, 1))).toEqual({ year: 2025, q: 4 });
  });
  it("fim do trimestre e contagens", () => {
    expect(fimTrimestre(2026, 3)).toBe("2026-09-30");
    expect(fimTrimestre(2026, 1)).toBe("2026-03-31");
    expect(contagemMapas([{ mapa_q3_enviado: true }, { mapa_q3_enviado: false, relatorio_q3_entregue: true }, {}], 3))
      .toEqual({ total: 3, enviados: 1, relatorios: 1, porEnviar: 2 });
  });
});
