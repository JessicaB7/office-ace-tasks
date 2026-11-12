import { describe, it, expect } from "vitest";
import {
  calcularCarteira,
  comUltimoMes,
  contaNoMes,
  entraNoMes,
  estadoCarteira,
  evolucaoAnual,
  inativosSemData,
  mensalidadeNoInicioDe,
  mensalidadeNoMes,
  saiNoMes,
  shiftMes,
  type ClienteCarteira,
} from "./carteira";

const cli = (o: Record<string, unknown> = {}): ClienteCarteira => ({
  id: "c1",
  name: "Cliente",
  active: true,
  status: "ativo",
  tipo_contabilidade: "TI RS",
  mensalidade: 50,
  responsavel_id: "a",
  ...o,
});

describe("regras base", () => {
  it("shiftMes atravessa o ano", () => {
    expect(shiftMes("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMes("2026-11-01", 2)).toBe("2027-01-01");
  });

  it("contaNoMes usa início de contrato e último mês; inclui «a sair»", () => {
    expect(contaNoMes(cli({ inicio_contrato: "2026-12-19" }), "2026-11-01")).toBe(false);
    expect(contaNoMes(cli({ inicio_contrato: "2026-11-15" }), "2026-11-01")).toBe(true);
    expect(contaNoMes(cli({ status: "a_sair" }), "2026-11-01")).toBe(true);
    expect(contaNoMes(cli({ status: "inativo", active: false, ultimo_mes_responsabilidade: "2026-10-01" }), "2026-10-01")).toBe(true);
    expect(contaNoMes(cli({ status: "a_sair", ultimo_mes_responsabilidade: "2026-10-01" }), "2026-11-01")).toBe(false);
    expect(contaNoMes(cli({ status: "inativo", active: false }), "2026-11-01")).toBe(false);
  });

  it("entradas pelo início de contrato; saídas pelo último mês = mês anterior", () => {
    expect(entraNoMes(cli({ inicio_contrato: "2026-11-15" }), "2026-11-01")).toBe(true);
    expect(entraNoMes(cli({ inicio_contrato: "2026-10-31" }), "2026-11-01")).toBe(false);
    expect(saiNoMes(cli({ ultimo_mes_responsabilidade: "2026-10-01" }), "2026-11-01")).toBe(true);
    expect(saiNoMes(cli({ ultimo_mes_responsabilidade: "2026-11-01" }), "2026-11-01")).toBe(false);
    // inativo sem data: não é saída de nenhum mês
    expect(saiNoMes(cli({ status: "inativo", active: false, updated_at: "2026-11-03" }), "2026-11-01")).toBe(false);
  });

  it("comUltimoMes usa a ficha, depois o processo de saída, depois a conclusão", () => {
    const clients = [
      cli({ id: "1", ultimo_mes_responsabilidade: "2026-09-01" }),
      cli({ id: "2" }),
      cli({ id: "3", status: "inativo", active: false }),
      cli({ id: "4", status: "inativo", active: false }),
    ];
    const r = comUltimoMes(clients, [
      { client_id: "1", ultimo_mes_responsabilidade: "2026-12-01" },
      { client_id: "2", ultimo_mes_responsabilidade: "2026-11-01" },
      { client_id: "3", completed_at: "2026-10-20T10:00:00Z" },
    ]);
    expect(r.map((c) => c.ultimo_mes_responsabilidade)).toEqual(["2026-09-01", "2026-11-01", "2026-10-01", undefined]);
    expect(r.map((c) => c.ultimo_mes_origem)).toEqual(["cliente", "saida", "saida_concluida", undefined]);
    expect(clients[1].ultimo_mes_responsabilidade).toBeUndefined(); // não altera o original
    expect(inativosSemData(r).map((c) => c.id)).toEqual(["4"]);
  });

  it("mensalidade do mês recua alterações feitas depois", () => {
    const audit = [
      { registo_id: "1", campo: "mensalidade", valor_antigo: "40", alterado_em: "2026-11-03T09:00:00Z" },
      { registo_id: "1", campo: "mensalidade", valor_antigo: "45", alterado_em: "2026-11-09T09:00:00Z" },
      { registo_id: "1", campo: "mensalidade", valor_antigo: "30", alterado_em: "2026-10-03T09:00:00Z" },
    ];
    const c = cli({ id: "1", mensalidade: 60 });
    expect(mensalidadeNoInicioDe(c, "2026-11-01", audit)).toBe(40);
    expect(mensalidadeNoMes(c, "2026-10-01", audit)).toBe(40);
    expect(mensalidadeNoMes(c, "2026-09-01", audit)).toBe(30);
    expect(mensalidadeNoMes(c, "2026-11-01", audit)).toBe(60);
    expect(mensalidadeNoMes(cli({ id: "2", mensalidade: 60 }), "2026-10-01", audit)).toBe(60);
  });
});

describe("calcularCarteira", () => {
  const clients = [
    cli({ id: "1", mensalidade: 100, tipo_contabilidade: "SQ", inicio_contrato: "2025-01-01" }),
    cli({ id: "2", mensalidade: 200, tipo_contabilidade: "SQ", inicio_contrato: "2026-11-01" }), // entrada
    cli({ id: "3", mensalidade: 50, inicio_contrato: "2025-01-01", status: "inativo", active: false, ultimo_mes_responsabilidade: "2026-10-01" }), // saída
    cli({ id: "4", mensalidade: 60, inicio_contrato: "2025-01-01" }), // subiu de 40 para 60
    cli({ id: "5", mensalidade: 30, inicio_contrato: "2025-01-01", status: "a_sair" }),
    cli({ id: "6", mensalidade: 100, inicio_contrato: "2026-12-19" }), // ainda não começou
    cli({ id: "7", mensalidade: 80, status: "inativo", active: false }), // inativo sem data
  ];
  const audit = [{ registo_id: "4", campo: "mensalidade", valor_antigo: "40", alterado_em: "2026-11-05T09:00:00Z" }];

  it("total, variação, entradas, saídas e alterações", () => {
    const d = calcularCarteira(clients, audit, "2026-11-01");
    expect(d.clientes.map((c) => c.id)).toEqual(["1", "2", "4", "5"]);
    expect(d.total).toBe(390);
    expect(d.totalAnterior).toBe(100 + 50 + 40 + 30);
    expect(d.variacao).toBe(170);
    expect(d.entradas.map((c) => c.id)).toEqual(["2"]);
    expect(d.ganho).toBe(200);
    expect(d.saidas.map((s) => s.client.id)).toEqual(["3"]);
    expect(d.perdido).toBe(50);
    expect(d.alteracoes).toEqual([{ client: clients[3], antes: 40, depois: 60 }]);
    // variação = ganho − perdido + alterações
    expect(d.variacao).toBe(d.ganho - d.perdido + d.alteracoes.reduce((s, a) => s + a.depois - a.antes, 0));
  });

  it("média geral e por tipo, abaixo da média e carteira por tipo", () => {
    const d = calcularCarteira(clients, audit, "2026-11-01");
    expect(d.media).toBe(390 / 4);
    expect(d.abaixoMedia.map((c) => c.id)).toEqual(["4", "5"]);
    const sq = d.porTipo.find((m) => m.tipo === "SQ")!;
    expect(sq.media).toBe(150);
    expect(sq.valor).toBe(300);
    expect(sq.abaixo.map((c) => c.id)).toEqual(["1"]);
    const rs = d.porTipo.find((m) => m.tipo === "TI RS")!;
    expect(rs.n).toBe(2);
    expect(rs.abaixo.map((c) => c.id)).toEqual(["5"]);
    expect(d.porTipo.reduce((s, t) => s + t.valor, 0)).toBe(d.total);
    expect(d.porTipo.reduce((s, t) => s + t.clientes.length, 0)).toBe(d.clientes.length);
  });

  it("um mês passado usa a mensalidade desse mês", () => {
    const d = calcularCarteira(clients, audit, "2026-10-01");
    expect(d.total).toBe(100 + 50 + 40 + 30);
    expect(d.entradas).toHaveLength(0);
  });
});

describe("evolucaoAnual e estado", () => {
  it("12 pontos com as mesmas regras; meses futuros sem avenças", () => {
    const clients = [
      cli({ id: "1", mensalidade: 100, inicio_contrato: "2026-03-10" }),
      cli({ id: "2", mensalidade: 50, inicio_contrato: "2025-01-01", status: "inativo", active: false, ultimo_mes_responsabilidade: "2026-05-01" }),
    ];
    const e = evolucaoAnual(clients, [], 2026, "2026-11-01");
    expect(e).toHaveLength(12);
    expect(e[2]).toEqual({ mes: "2026-03-01", entradas: 1, saidas: 0, avencas: 150 });
    expect(e[5]).toEqual({ mes: "2026-06-01", entradas: 0, saidas: 1, avencas: 100 });
    expect(e[11].avencas).toBeNull();
    const total = calcularCarteira(clients, [], "2026-06-01");
    expect(total.saidas).toHaveLength(e[5].saidas);
  });

  it("estado pela ficha e valor em risco", () => {
    const s = estadoCarteira([cli({ id: "1" }), cli({ id: "2", status: "a_sair", mensalidade: 70 }), cli({ id: "3", status: null, active: false })]);
    expect([s.ativos.length, s.aSair.length, s.inativos.length]).toEqual([1, 1, 1]);
    expect(s.valorEmRisco).toBe(70);
  });
});
