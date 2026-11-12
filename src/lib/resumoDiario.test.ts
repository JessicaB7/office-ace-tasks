import { describe, it, expect } from "vitest";
import {
  buildResumoDiario, isDiaUtil, isGestaoMensal, lisbonDay, lisbonHour, mapaUtilizadores, obrigacaoLabel,
  type RDColaborador,
} from "./resumoDiario";

const colabs: RDColaborador[] = [
  { id: "c-jess", name: "Jéssica Brandão", user_id: null, active: true },
  { id: "c-sor", name: "Soraia Almeida", user_id: "u-sor", active: true },
  { id: "c-ana", name: "Ana Fardilha", user_id: "u-ana", active: true },
  { id: "c-old", name: "Antiga", user_id: "u-old", active: false },
];
const clients = [{ id: "cl1", name: "Cliente Um" }, { id: "cl2", name: "Cliente Dois" }];
const DIA = "2026-11-12";

describe("datas de Lisboa", () => {
  it("lisbonDay usa o fuso de Lisboa (verão: 23:30 UTC já é o dia seguinte)", () => {
    expect(lisbonDay("2026-07-01T23:30:00Z")).toBe("2026-07-02");
    expect(lisbonDay("2026-11-12T23:30:00Z")).toBe("2026-11-12");
  });
  it("lisbonHour: 18:00 UTC é 19h no verão e 18h no inverno", () => {
    expect(lisbonHour(new Date("2026-07-01T18:00:00Z"))).toBe(19);
    expect(lisbonHour(new Date("2026-11-12T18:00:00Z"))).toBe(18);
  });
  it("isDiaUtil: segunda a sexta", () => {
    expect(isDiaUtil("2026-11-12")).toBe(true); // quinta
    expect(isDiaUtil("2026-11-14")).toBe(false); // sábado
    expect(isDiaUtil("2026-11-15")).toBe(false); // domingo
    expect(isDiaUtil("2026-11-16")).toBe(true); // segunda
  });
});

describe("rótulos", () => {
  it("distingue células da Gestão Mensal das obrigações", () => {
    expect(isGestaoMensal("contabilidade_TI_iva_compras")).toBe(true);
    expect(isGestaoMensal("contabilidade_empresas_depreciações")).toBe(true);
    expect(isGestaoMensal("contabilidade_TI_isento")).toBe(true);
    expect(isGestaoMensal("SAFT")).toBe(false);
  });
  it("rótulos legíveis", () => {
    expect(obrigacaoLabel("contabilidade_TI_iva_compras")).toBe("Compras (TI Reg. IVA)");
    expect(obrigacaoLabel("contabilidade_organizada_e_fatura")).toBe("E-Fatura (TI Organizada)");
    expect(obrigacaoLabel("contabilidade_TI_isento")).toBe("Contabilidade (TI Isento)");
    expect(obrigacaoLabel("SS_TI_DT")).toBe("SS declaração trimestral");
    expect(obrigacaoLabel("IVA_flex_P2")).toBe("IVA flexibilizado – parcela 2");
    expect(obrigacaoLabel("emissao_faturas_S3")).toBe("Emissão de faturas – semana 3");
    expect(obrigacaoLabel("novo_tipo")).toBe("Novo tipo");
  });
});

describe("mapaUtilizadores", () => {
  it("atribui a conta admin sem ficha à única ficha ativa sem user_id", () => {
    const m = mapaUtilizadores(colabs, ["u-admin"]);
    expect(m.get("u-admin")).toBe("c-jess");
    expect(m.get("u-sor")).toBe("c-sor");
  });
  it("não adivinha quando há mais de uma ficha sem conta", () => {
    const m = mapaUtilizadores([...colabs, { id: "c-x", name: "X", user_id: null, active: true }], ["u-admin"]);
    expect(m.has("u-admin")).toBe(false);
  });
});

describe("buildResumoDiario", () => {
  const base = {
    dia: DIA, collaborators: colabs, adminUserIds: ["u-admin"], clients,
    tarefasConcluidas: [], tarefasAbertas: [], obrigacoes: [], contactos: [],
  };

  it("inclui colaboradores ativos sem registos e exclui inativos sem nada", () => {
    const r = buildResumoDiario(base);
    expect(r.colaboradores.map((c) => c.nome)).toEqual(["Ana Fardilha", "Jéssica Brandão", "Soraia Almeida"]);
    expect(r.colaboradores.every((c) => c.totalFeito === 0)).toBe(true);
  });

  it("agrega tarefas, gestão mensal, obrigações e contactos do dia", () => {
    const r = buildResumoDiario({
      ...base,
      tarefasConcluidas: [
        { id: "t1", title: "Enviar IRS", status: "concluida", due_date: DIA, collaborator_id: "c-sor", client_id: "cl1", updated_at: "2026-11-12T10:00:00Z" },
        { id: "t2", title: "Ontem", status: "concluida", due_date: DIA, collaborator_id: "c-sor", client_id: null, updated_at: "2026-11-11T10:00:00Z" },
        { id: "t3", title: "Com completed_at", status: "concluida", due_date: null, collaborator_id: "c-ana", client_id: null, updated_at: "2026-11-12T10:00:00Z", completed_at: "2026-11-10T10:00:00Z" },
      ],
      obrigacoes: [
        { client_id: "cl1", obligation_type: "contabilidade_TI_iva_compras", reference_month: "2026-10-01", completed_at: "2026-11-12T09:00:00Z", completed_by: "u-sor" },
        { client_id: "cl1", obligation_type: "contabilidade_TI_iva_vendas", reference_month: "2026-10-01", completed_at: "2026-11-12T09:05:00Z", completed_by: "u-sor" },
        { client_id: "cl2", obligation_type: "SAFT", reference_month: "2026-10-01", completed_at: "2026-11-12T11:00:00Z", completed_by: "u-admin" },
        { client_id: "cl2", obligation_type: "IVA", reference_month: "2026-09-01", completed_at: "2026-11-11T11:00:00Z", completed_by: "u-admin" },
        { client_id: "cl2", obligation_type: "DMR_AT", reference_month: "2026-10-01", completed_at: "2026-11-12T11:00:00Z", completed_by: "u-desconhecido" },
      ],
      contactos: [
        { client_id: "cl2", collaborator_id: "c-ana", created_by: "u-ana", tipo: "chamada", created_at: "2026-11-12T15:00:00Z" },
        { client_id: "cl1", collaborator_id: null, created_by: "u-sor", tipo: "email", created_at: "2026-11-12T16:00:00Z" },
      ],
    });
    const sor = r.colaboradores.find((c) => c.id === "c-sor")!;
    expect(sor.tarefas).toEqual([{ titulo: "Enviar IRS", cliente: "Cliente Um" }]);
    expect(sor.gestaoMensal).toEqual([{ cliente: "Cliente Um", itens: ["Compras (TI Reg. IVA) out.", "Vendas (TI Reg. IVA) out."] }]);
    expect(sor.contactos).toEqual([{ cliente: "Cliente Um", tipo: "email" }]);
    expect(sor.totalFeito).toBe(4);

    const jess = r.colaboradores.find((c) => c.id === "c-jess")!;
    expect(jess.obrigacoes).toEqual([{ cliente: "Cliente Dois", itens: ["SAFT out."] }]);

    const ana = r.colaboradores.find((c) => c.id === "c-ana")!;
    expect(ana.tarefas).toEqual([]); // concluída a 10/11 (completed_at tem prioridade)
    expect(ana.contactos).toHaveLength(1);

    const nid = r.colaboradores[r.colaboradores.length - 1];
    expect(nid.nome).toMatch(/não identificado/);
    expect(nid.obrigacoes[0].itens).toEqual(["DMR AT out."]);

    expect(r.totais).toEqual({ tarefas: 1, gestaoMensal: 2, obrigacoes: 2, contactos: 2, emAtraso: 0 });
  });

  it("conta tarefas em atraso (prazo até hoje) e limita a lista", () => {
    const abertas = Array.from({ length: 12 }, (_, i) => ({
      id: `a${i}`, title: `T${i}`, status: i === 0 ? "em_progresso" : "pendente",
      due_date: i === 0 ? DIA : `2026-11-0${(i % 9) + 1}`, collaborator_id: "c-ana", client_id: "cl1", updated_at: "2026-11-01T00:00:00Z",
    }));
    abertas.push({ id: "fut", title: "Futura", status: "pendente", due_date: "2026-11-13", collaborator_id: "c-ana", client_id: null, updated_at: "" });
    abertas.push({ id: "canc", title: "Cancelada", status: "cancelada", due_date: "2026-11-01", collaborator_id: "c-ana", client_id: null, updated_at: "" });
    const r = buildResumoDiario({ ...base, tarefasAbertas: abertas, maxAtrasoListadas: 5 });
    const ana = r.colaboradores.find((c) => c.id === "c-ana")!;
    expect(ana.totalEmAtraso).toBe(12);
    expect(ana.emAtraso).toHaveLength(5);
    expect(ana.emAtraso[0].prazo).toBe("01/11");
    expect(ana.totalFeito).toBe(0);
    expect(r.totais.emAtraso).toBe(12);
  });
});
