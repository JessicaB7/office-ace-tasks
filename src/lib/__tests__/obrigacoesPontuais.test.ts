import { describe, expect, test } from "vitest";
import {
  PONTUAL_TABS,
  ativoNoAno,
  clienteConcluido,
  contarPontuais,
  elegivel,
  mapaObrigacoes,
  pontualNotaType,
  pontualReferenceMonth,
  pontualTab,
  prazoData,
  prazoLabel,
  prazoUltrapassado,
} from "../obrigacoesPontuais";

const ti = { tipo_contabilidade: "TI RS", active: true };
const co = { tipo_contabilidade: "TI CO", active: true };
const sq = { tipo_contabilidade: "SQ", active: true };

describe("separadores e elegibilidade", () => {
  test("pagamentos por conta separados por TI e empresas", () => {
    const ppcTi = pontualTab("ppc_ti");
    const ppcEmp = pontualTab("ppc_empresas");
    expect(elegivel(ti, ppcTi, 2026)).toBe(true);
    expect(elegivel(co, ppcTi, 2026)).toBe(true);
    expect(elegivel(sq, ppcTi, 2026)).toBe(false);
    expect(elegivel(sq, ppcEmp, 2026)).toBe(true);
    expect(elegivel(ti, ppcEmp, 2026)).toBe(false);
  });
  test("entidade contratante para todos; SS só na contabilidade organizada", () => {
    for (const c of [ti, co, sq]) expect(elegivel(c, pontualTab("entidade_contratante"), 2026)).toBe(true);
    expect(elegivel(co, pontualTab("ss_co"), 2026)).toBe(true);
    expect(elegivel(ti, pontualTab("ss_co"), 2026)).toBe(false);
    expect(elegivel(sq, pontualTab("ss_co"), 2026)).toBe(false);
  });
  test("separador desconhecido cai no primeiro", () => {
    expect(pontualTab("xpto").id).toBe(PONTUAL_TABS[0].id);
  });
});

describe("ativoNoAno", () => {
  test("inativo, início depois do ano e saída antes do ano ficam de fora", () => {
    expect(ativoNoAno({ active: false }, 2026)).toBe(false);
    expect(ativoNoAno({ active: true, inicio_contrato: "2027-01-01" }, 2026)).toBe(false);
    expect(ativoNoAno({ active: true, inicio_contrato: "2026-12-19" }, 2026)).toBe(true);
    expect(ativoNoAno({ active: true, ultimo_mes_responsabilidade: "2025-12-01" }, 2026)).toBe(false);
    expect(ativoNoAno({ active: true, ultimo_mes_responsabilidade: "2026-03-01" }, 2026)).toBe(true);
  });
});

describe("prazos", () => {
  const [p1, , p3] = pontualTab("ppc_ti").colunas;
  const e1 = pontualTab("ppc_empresas").colunas[0];
  test("IRS dia 20, IRC dia 15", () => {
    expect(prazoData(p1, 2026)).toBe("2026-07-20");
    expect(prazoData(p3, 2026)).toBe("2026-12-20");
    expect(prazoData(e1, 2026)).toBe("2026-07-15");
    expect(prazoLabel(p1)).toBe("Até 20 jul");
  });
  test("ultrapassado só depois do dia-limite; análises anuais sem prazo", () => {
    expect(prazoUltrapassado(p1, 2026, "2026-07-20")).toBe(false);
    expect(prazoUltrapassado(p1, 2026, "2026-07-21")).toBe(true);
    const ec = pontualTab("entidade_contratante").colunas[0];
    expect(prazoData(ec, 2026)).toBeNull();
    expect(prazoLabel(ec)).toBe("Análise anual");
    expect(prazoUltrapassado(ec, 2026, "2026-12-31")).toBe(false);
  });
});

describe("registos e contagem", () => {
  test("referência anual e nota na 1.ª coluna", () => {
    expect(pontualReferenceMonth(2026)).toBe("2026-01-01");
    expect(pontualNotaType(pontualTab("ppc_ti"))).toBe("pontual_ppc_1");
  });
  test("conta clientes concluídos e tarefas feitas", () => {
    const tab = pontualTab("ppc_ti");
    const mapa = mapaObrigacoes([
      { client_id: "a", obligation_type: "pontual_ppc_1", status: "concluida" },
      { client_id: "a", obligation_type: "pontual_ppc_2", status: "concluida" },
      { client_id: "a", obligation_type: "pontual_ppc_3", status: "concluida" },
      { client_id: "b", obligation_type: "pontual_ppc_1", status: "concluida" },
      { client_id: "b", obligation_type: "pontual_ppc_2", status: "pendente" },
    ]);
    expect(clienteConcluido("a", tab, mapa)).toBe(true);
    expect(clienteConcluido("b", tab, mapa)).toBe(false);
    expect(contarPontuais(["a", "b", "c"], tab, mapa)).toEqual({ clientes: 3, concluidos: 1, tarefas: 9, feitas: 4 });
  });
});
