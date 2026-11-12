import { describe, it, expect } from "vitest";
import { diasAEspera, pedidoAtrasado, temPedido, contarPedidos, fmtPedido, pedidoLabel, hojeISO, candidatosParaColunas, celulasAPedir } from "@/lib/pedidosCliente";

const hoje = new Date(2026, 10, 12, 9, 30); // 12/11/2026

describe("pedidos ao cliente", () => {
  it("conta os dias à espera (calendário, sem negativos)", () => {
    expect(diasAEspera("2026-11-12", hoje)).toBe(0);
    expect(diasAEspera("2026-11-08", hoje)).toBe(4);
    expect(diasAEspera("2026-10-31", hoje)).toBe(12);
    expect(diasAEspera("2026-11-20", hoje)).toBe(0);
  });

  it("avisa só com mais de 5 dias", () => {
    expect(pedidoAtrasado("2026-11-07", hoje)).toBe(false); // 5 dias
    expect(pedidoAtrasado("2026-11-06", hoje)).toBe(true); // 6 dias
  });

  it("uma célula concluída já não tem pedido", () => {
    expect(temPedido({ status: "pendente", pedido_cliente_em: "2026-11-12" })).toBe(true);
    expect(temPedido({ status: "concluida", pedido_cliente_em: "2026-11-12" })).toBe(false);
    expect(temPedido({ status: "pendente", pedido_cliente_em: null })).toBe(false);
    expect(temPedido(undefined)).toBe(false);
  });

  it("conta pedidos à espera e atrasados", () => {
    const r = contarPedidos([
      { status: "pendente", pedido_cliente_em: "2026-11-12" },
      { status: "em_andamento", pedido_cliente_em: "2026-11-01" },
      { status: "concluida", pedido_cliente_em: "2026-11-01" },
      { status: "pendente" },
      undefined,
    ], hoje);
    expect(r).toEqual({ total: 2, atrasados: 1 });
  });

  it("formata a data do pedido", () => {
    expect(fmtPedido("2026-11-08")).toBe("08/11");
    expect(pedidoLabel("2026-11-12")).toBe("⏳ pedido 12/11");
    expect(hojeISO(hoje)).toBe("2026-11-12");
  });

  it("pedir documentos: filtra clientes e células pelas colunas escolhidas", () => {
    const cands = [
      { id: "a", name: "Ana", porFazer: { 0: null, 1: "2026-11-01" } },
      { id: "b", name: "Bruno", porFazer: { 1: null } },
      { id: "c", name: "Carla", porFazer: {} },
    ];
    expect(candidatosParaColunas(cands, [0]).map((c) => c.id)).toEqual(["a"]);
    expect(candidatosParaColunas(cands, [0, 1]).map((c) => c.id)).toEqual(["a", "b"]);
    expect(candidatosParaColunas(cands, []).length).toBe(0);
    expect(celulasAPedir(cands, ["a", "b", "c"], [0, 1])).toEqual([
      { clientId: "a", col: 0 }, { clientId: "a", col: 1 }, { clientId: "b", col: 1 },
    ]);
    expect(celulasAPedir(cands, ["b"], [0])).toEqual([]);
  });
});
