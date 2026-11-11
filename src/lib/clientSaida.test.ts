import { describe, expect, it } from "vitest";
import { ativoNoMes, monthOf, saidaProgresso, saidasPorMotivo, type Offboarding } from "./clientSaida";

describe("ativoNoMes", () => {
  it("cliente ativo sem saída tem obrigações em qualquer mês", () => {
    expect(ativoNoMes({ active: true }, "2027-03-01")).toBe(true);
  });
  it("cliente inativo não tem obrigações", () => {
    expect(ativoNoMes({ active: false }, "2026-01")).toBe(false);
  });
  it("cliente a sair tem obrigações até ao último mês, inclusive", () => {
    const c = { active: true, ultimo_mes_responsabilidade: "2026-11-01" };
    expect(ativoNoMes(c, "2026-10-01")).toBe(true);
    expect(ativoNoMes(c, "2026-11")).toBe(true);
    expect(ativoNoMes(c, "2026-12-01")).toBe(false);
  });
  it("monthOf usa mês 0–11", () => {
    expect(monthOf(2026, 0)).toBe("2026-01");
    expect(monthOf(2026, 11)).toBe("2026-12");
  });
});

const off = (p: Partial<Offboarding>): Offboarding => ({
  id: "x", client_id: "c", responsavel_id: null, data_aviso: null, ultimo_mes_responsabilidade: null,
  motivo_saida: null, motivo_detalhe: null, notas: null, completed_at: null, created_at: "", updated_at: "", ...p,
});

describe("saidas", () => {
  it("conta o progresso da checklist", () => {
    expect(saidaProgresso({ confirmacao_escrita: true, renuncia_cc: true, drive_arquivada: false })).toBe(2);
  });
  it("conta saídas concluídas por motivo nos últimos 12 meses", () => {
    const hoje = new Date(2026, 10, 11);
    const r = saidasPorMotivo([
      off({ motivo_saida: "preco", completed_at: "2026-10-01T10:00:00Z" }),
      off({ motivo_saida: "preco", completed_at: "2026-02-01T10:00:00Z" }),
      off({ motivo_saida: "servico", completed_at: "2025-10-01T10:00:00Z" }), // mais de 12 meses
      off({ motivo_saida: "outro", completed_at: null }), // não concluída
      off({ completed_at: "2026-09-01T10:00:00Z" }),
    ], hoje);
    expect(r).toEqual([
      { motivo: "preco", label: "Preço", n: 2 },
      { motivo: "sem_motivo", label: "Sem motivo", n: 1 },
    ]);
  });
});
