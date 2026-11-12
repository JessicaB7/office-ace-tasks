import { describe, it, expect } from "vitest";
import {
  proximosPrazos,
  calcularRisco,
  calcularEquipa,
  calcularPassagem,
  calcularDinheiro,
  contaNoMes,
  mensalidadeNoInicioDe,
  tarefaEmAtraso,
  shiftMes,
  type ClienteCtl,
} from "./controlo";
import { computeFecho } from "./fechoMes";

const TODAY = "2026-11-12";

const cli = (o: Record<string, unknown> = {}): ClienteCtl => ({
  id: "c1",
  name: "Cliente",
  active: true,
  status: "ativo",
  tipo_contabilidade: "TI RS",
  mensalidade: 50,
  responsavel_id: "a",
  divida_at: "sem_divida",
  divida_ss: "sem_divida",
  ...o,
});

describe("utilitários", () => {
  it("shiftMes atravessa o ano", () => {
    expect(shiftMes("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMes("2026-11-01", 2)).toBe("2027-01-01");
  });
  it("tarefaEmAtraso ignora concluídas, canceladas e as de hoje", () => {
    expect(tarefaEmAtraso({ status: "pendente", due_date: "2026-11-11" }, TODAY)).toBe(true);
    expect(tarefaEmAtraso({ status: "pendente", due_date: TODAY }, TODAY)).toBe(false);
    expect(tarefaEmAtraso({ status: "concluida", due_date: "2026-11-01" }, TODAY)).toBe(false);
    expect(tarefaEmAtraso({ status: "cancelada", due_date: "2026-11-01" }, TODAY)).toBe(false);
  });
});

describe("proximosPrazos", () => {
  it("junta meses de referência e conta clientes com pendentes por prazo", () => {
    const a = cli({ id: "a1", name: "Ana", tipo_contabilidade: "TI CO", iva: "Trimestral", seguranca_social: "Isento" });
    const b = cli({ id: "b1", name: "Bruno", tipo_contabilidade: "TI CO", iva: "Mensal", seguranca_social: "Isento" });
    const obls = [
      // Retenção de outubro do Bruno feita
      { reference_month: "2026-10-01", client_id: "b1", obligation_type: "retencao_fonte", status: "concluida" },
    ];
    const r = proximosPrazos([a, b], obls, ["2026-09-01", "2026-10-01"], TODAY);
    expect(r[0].deadline).toBe("2026-11-20");
    const nomes = r[0].clientes.map((c) => c.client.name);
    // Ana: IVA trimestral de set + retenção out; Bruno: IVA mensal de set (retenção feita)
    expect(nomes).toEqual(["Ana", "Bruno"]);
    expect(r[0].clientes.find((c) => c.client.name === "Bruno")!.tasks.map((t) => t.type)).toEqual(["IVA"]);
    expect(r.length).toBeLessThanOrEqual(3);
  });
  it("ignora prazos já passados", () => {
    const a = cli({ id: "a1", tipo_contabilidade: "SQ", saft: "A entregar" });
    const r = proximosPrazos([a], [], ["2026-10-01"], TODAY);
    expect(r.every((p) => p.deadline >= TODAY)).toBe(true);
    expect(r.some((p) => p.labels.includes("SAFT"))).toBe(false); // SAFT de outubro venceu a 05/11
  });
});

describe("calcularRisco", () => {
  it("pontua e ordena os casos mais graves", () => {
    const clients = [
      cli({ id: "1", name: "Só saída", status: "a_sair" }),
      cli({ id: "2", name: "Dívidas", divida_at: "com_divida", divida_ss: "com_divida" }),
      cli({ id: "3", name: "Pedidos", }),
      cli({ id: "4", name: "Tranquilo", divida_at: "por_verificar" }),
      cli({ id: "5", name: "Inativo", active: false, status: "inativo", divida_at: "com_divida" }),
    ];
    const pedidos = [
      { id: "x", obligation_type: "t", client_id: "3", pedido_cliente_em: "2026-11-01", status: "pendente" },
      { id: "x", obligation_type: "t", client_id: "3", pedido_cliente_em: "2026-11-02", status: "pendente" },
      { id: "x", obligation_type: "t", client_id: "3", pedido_cliente_em: "2026-11-10", status: "pendente" }, // só 2 dias: não conta
      { id: "x", obligation_type: "t", client_id: "1", pedido_cliente_em: "2026-10-01", status: "concluida" }, // concluída: não conta
    ];
    const tasks = [{ id: "x", obligation_type: "t", client_id: "1", status: "pendente", due_date: "2026-09-01" }];
    const r = calcularRisco(clients, tasks, pedidos, TODAY);
    expect(r.clientes.map((x) => x.client.name)).toEqual(["Dívidas", "Só saída", "Pedidos"]);
    expect(r.clientes[0].pontos).toBe(6);
    // saída 2 + 1 tarefa + 1 por ter mais de 30 dias de atraso; empata com «Pedidos» mas tem 2 motivos
    expect(r.clientes[1].pontos).toBe(4);
    expect(r.clientes[2].pontos).toBe(4);
    expect(r.clientes[1].motivos.map((m) => m.tipo)).toEqual(["tarefas", "saida"]);
    expect(r.porMotivo.pedidos[0].pedidos).toHaveLength(2);
    expect(r.porMotivo.divida_at).toHaveLength(1);
  });
  it("limita os pontos de pedidos e tarefas", () => {
    const pedidos = Array.from({ length: 5 }, () => ({ id: "x", obligation_type: "t", client_id: "1", pedido_cliente_em: "2026-10-01", status: "pendente" }));
    const tasks = Array.from({ length: 9 }, () => ({ id: "x", obligation_type: "t", client_id: "1", status: "pendente", due_date: "2026-11-10" }));
    const r = calcularRisco([cli({ id: "1" })], tasks, pedidos, TODAY);
    expect(r.clientes[0].pontos).toBe(6 + 4);
  });
});

describe("calcularEquipa", () => {
  it("carga ponderada SQ=3, TI CO=2, TI RS=1 só com clientes ativos", () => {
    const collabs = [{ id: "a", name: "Ana", active: true }, { id: "b", name: "Bia", active: true }, { id: "z", name: "Sem nada", active: true }];
    const clients = [
      cli({ id: "1", tipo_contabilidade: "SQ" }),
      cli({ id: "2", tipo_contabilidade: "TI CO" }),
      cli({ id: "3", tipo_contabilidade: "TI RS" }),
      cli({ id: "4", tipo_contabilidade: "SQ", status: "a_sair" }),
      cli({ id: "5", tipo_contabilidade: "TI RS", responsavel_id: "b" }),
    ];
    const tasks = [{ id: "t1", collaborator_id: "b", status: "pendente", due_date: "2026-11-01" }];
    const fecho = computeFecho([], [], "2026-10-01", TODAY);
    const r = calcularEquipa(collabs, clients, tasks, fecho, TODAY);
    expect(r.map((l) => l.collaborator.name)).toEqual(["Ana", "Bia"]);
    expect(r[0].carga).toBe(6);
    expect(r[0].clientes).toHaveLength(3);
    expect(r[1].tarefasAtraso).toHaveLength(1);
    expect(r[0].pct).toBeNull();
  });
});

describe("calcularPassagem", () => {
  const audit = [
    { campo: "responsavel_id", registo_id: "1", registo_nome: "A", valor_antigo: "Jéssica Brandão", valor_novo: "Ana Fardilha", alterado_em: "2026-11-05T10:00:00Z" },
    { campo: "responsavel_id", registo_id: "2", registo_nome: "B", valor_antigo: "Jéssica Brandão", valor_novo: "Soraia Almeida", alterado_em: "2026-10-20T10:00:00Z" }, // antes do início
    { campo: "responsavel_id", registo_id: "3", registo_nome: "C", valor_antigo: "Ana Fardilha", valor_novo: "Soraia Almeida", alterado_em: "2026-11-06T10:00:00Z" }, // não vem da admin
    { campo: "responsavel_id", registo_id: "4", registo_nome: "D", valor_antigo: "Jéssica Brandão", valor_novo: "Ana Fardilha", alterado_em: "2026-11-07T10:00:00Z" }, // voltou à admin
    { campo: "mensalidade", registo_id: "5", valor_antigo: "Jéssica Brandão", valor_novo: "x", alterado_em: "2026-11-07T10:00:00Z" },
  ];
  it("conta só passagens da admin desde a data e ainda fora da admin", () => {
    const clients = [cli({ id: "1", name: "A", responsavel_id: "ana" }), cli({ id: "4", name: "D", responsavel_id: "jess" })];
    const r = calcularPassagem(audit, clients, "jess", TODAY);
    expect(r.feitos.map((f) => f.clientId)).toEqual(["1"]);
    expect(r.meta).toBe(25);
    expect(r.diasRestantes).toBe(49);
  });
});

describe("dinheiro", () => {
  it("contaNoMes usa início de contrato e último mês", () => {
    expect(contaNoMes(cli({ inicio_contrato: "2026-12-01" }), "2026-11-01")).toBe(false);
    expect(contaNoMes(cli({ inicio_contrato: "2026-11-15" }), "2026-11-01")).toBe(true);
    expect(contaNoMes(cli({ status: "inativo", active: false, ultimo_mes_responsabilidade: "2026-10-01" }), "2026-10-01")).toBe(true);
    expect(contaNoMes(cli({ status: "a_sair", ultimo_mes_responsabilidade: "2026-10-01" }), "2026-11-01")).toBe(false);
    expect(contaNoMes(cli({ status: "inativo", active: false }), "2026-11-01")).toBe(false);
  });
  it("mensalidadeNoInicioDe recua alterações feitas no mês", () => {
    const audit = [
      { registo_id: "1", campo: "mensalidade", valor_antigo: "40", valor_novo: "45", alterado_em: "2026-11-03T09:00:00Z" },
      { registo_id: "1", campo: "mensalidade", valor_antigo: "45", valor_novo: "60", alterado_em: "2026-11-09T09:00:00Z" },
      { registo_id: "1", campo: "mensalidade", valor_antigo: "30", valor_novo: "40", alterado_em: "2026-10-03T09:00:00Z" },
    ];
    expect(mensalidadeNoInicioDe(cli({ id: "1", mensalidade: 60 }), "2026-11-01", audit)).toBe(40);
    expect(mensalidadeNoInicioDe(cli({ id: "2", mensalidade: 60 }), "2026-11-01", audit)).toBe(60);
  });
  it("total, variação, novos, saídas e média por tipo", () => {
    const clients = [
      cli({ id: "1", mensalidade: 100, tipo_contabilidade: "SQ", inicio_contrato: "2025-01-01" }),
      cli({ id: "2", mensalidade: 200, tipo_contabilidade: "SQ", inicio_contrato: "2026-11-01" }), // novo
      cli({ id: "3", mensalidade: 50, inicio_contrato: "2025-01-01", status: "inativo", active: false, ultimo_mes_responsabilidade: "2026-10-01" }), // saída
      cli({ id: "4", mensalidade: 60, inicio_contrato: "2025-01-01" }), // subiu de 40 para 60
      cli({ id: "5", mensalidade: 30, inicio_contrato: "2025-01-01" }),
    ];
    const audit = [{ registo_id: "4", campo: "mensalidade", valor_antigo: "40", valor_novo: "60", alterado_em: "2026-11-05T09:00:00Z" }];
    const d = calcularDinheiro(clients, audit, "2026-11-01");
    expect(d.total).toBe(390);
    expect(d.totalAnterior).toBe(100 + 50 + 40 + 30);
    expect(d.variacao).toBe(170);
    expect(d.novos.map((c) => c.id)).toEqual(["2"]);
    expect(d.ganho).toBe(200);
    expect(d.saidas.map((s) => s.client.id)).toEqual(["3"]);
    expect(d.perdido).toBe(50);
    expect(d.alteracoes).toEqual([{ client: clients[3], antes: 40, depois: 60 }]);
    const sq = d.mediaPorTipo.find((m) => m.tipo === "SQ")!;
    expect(sq.media).toBe(150);
    expect(sq.abaixo.map((c) => c.id)).toEqual(["1"]);
    const rs = d.mediaPorTipo.find((m) => m.tipo === "TI RS")!;
    expect(rs.n).toBe(2);
    expect(rs.abaixo.map((c) => c.id)).toEqual(["5"]);
    // variação = ganho − perdido + alterações
    expect(d.variacao).toBe(d.ganho - d.perdido + d.alteracoes.reduce((s, a) => s + a.depois - a.antes, 0));
  });
});
