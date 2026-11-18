import { describe, expect, test } from "vitest";
import {
  aumento,
  filtrarLinhas,
  montarLinhas,
  novaComPercentagem,
  preencherEmMassa,
  proximoJaneiro,
  resumir,
  type PropostaMensalidade,
} from "../mensalidadeAtualizacoes";

const cli = (id: string, o: Record<string, unknown> = {}) => ({
  id, name: `Cliente ${id}`, nif: `50000000${id}`, status: "ativo", tipo_contabilidade: "TI RS", mensalidade: 100, responsavel_id: "a", ...o,
});
const prop = (client_id: string, o: Partial<PropostaMensalidade> = {}): PropostaMensalidade => ({
  id: `p${client_id}`, client_id, mensalidade_atual: 100, mensalidade_nova: 110, a_partir_de: "2027-01-01",
  mensagem_enviada_em: null, estado: "pendente", estado_em: null, aplicada_em: null, notas: null, ...o,
});

describe("cálculos", () => {
  test("arredonda ao euro e calcula o aumento", () => {
    expect(novaComPercentagem(95, 5)).toBe(100);
    expect(novaComPercentagem(120, 3)).toBe(124);
    expect(aumento(100, 110)).toEqual({ valor: 10, pct: 10 });
    expect(aumento(0, 50)).toEqual({ valor: 50, pct: null });
    expect(aumento(100, null)).toBeNull();
  });
  test("campanha por omissão: janeiro do ano seguinte", () => {
    expect(proximoJaneiro("2026-11-18")).toBe("2027-01-01");
  });
});

describe("linhas, filtros e resumo", () => {
  const clients = [
    cli("1"),
    cli("2", { responsavel_id: "b", tipo_contabilidade: "SQ", mensalidade: 200 }),
    cli("3", { responsavel_id: null }),
    cli("4", { status: "inativo" }),
    cli("5", { mensalidade: 0 }),
  ];
  const propostas = [
    prop("1", { mensagem_enviada_em: "2026-11-18", estado: "aceite" }),
    prop("2", { mensalidade_atual: 200, mensalidade_nova: 220, estado: "recusado", mensagem_enviada_em: "2026-11-18" }),
    prop("3", { mensalidade_nova: 105 }),
    prop("1", { id: "outra", a_partir_de: "2026-01-01", mensalidade_nova: 999 }),
  ];
  const linhas = montarLinhas(clients, propostas, "2027-01-01");

  test("só clientes ativos e só propostas do mês escolhido", () => {
    expect(linhas.map((l) => l.client.id)).toEqual(["1", "2", "3", "5"]);
    expect(linhas.find((l) => l.client.id === "1")!.nova).toBe(110);
  });

  test("depois de aplicada mostra a mensalidade anterior (retrato)", () => {
    const l = montarLinhas([cli("1", { mensalidade: 110 })], [prop("1", { estado: "aceite", aplicada_em: "2027-01-01T00:15:00Z" })], "2027-01-01");
    expect(l[0].atual).toBe(100);
  });

  test("filtros", () => {
    expect(filtrarLinhas(linhas, { responsavel: "b" }).map((l) => l.client.id)).toEqual(["2"]);
    expect(filtrarLinhas(linhas, { responsavel: "none" }).map((l) => l.client.id)).toEqual(["3"]);
    expect(filtrarLinhas(linhas, { tipo: "SQ" }).map((l) => l.client.id)).toEqual(["2"]);
    expect(filtrarLinhas(linhas, { estado: "sem_proposta" }).map((l) => l.client.id)).toEqual(["5"]);
    expect(filtrarLinhas(linhas, { estado: "pendente" }).map((l) => l.client.id)).toEqual(["3"]);
    expect(filtrarLinhas(linhas, { soPorEnviar: true }).map((l) => l.client.id)).toEqual(["3"]);
    expect(filtrarLinhas(linhas, { pesquisa: "cliente 2" }).map((l) => l.client.id)).toEqual(["2"]);
    expect(filtrarLinhas(linhas, { pesquisa: "500000003" }).map((l) => l.client.id)).toEqual(["3"]);
  });

  test("resumo", () => {
    expect(resumir(linhas)).toEqual({
      total: 4, comProposta: 3, enviadas: 2, aceites: 1, recusados: 1, pendentes: 1,
      aumentoPotencial: 15, aumentoAceite: 10,
    });
  });

  test("preenchimento em massa só nas linhas sem valor e com mensalidade", () => {
    const l = montarLinhas([cli("1"), cli("6", { mensalidade: 80 }), cli("7", { mensalidade: 0 })], [prop("1")], "2027-01-01");
    expect(preencherEmMassa(l, 5)).toEqual([{ clientId: "6", nova: 84 }]);
  });
});
