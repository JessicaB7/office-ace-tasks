import { describe, it, expect } from "vitest";
import { resolveManual, tiposSemManual, tiposDeObrigacaoConhecidos, type ObligationManual } from "@/lib/obligationManuals";

let n = 0;
const m = (match_prefix: string, tipo_contabilidade: string | null, titulo: string, ordem = 0): ObligationManual =>
  ({ id: String(++n), match_prefix, tipo_contabilidade, titulo, notion_url: `https://notion/${titulo}`, ordem });

// Igual ao seed da migração 20261111132000_obligation_manuals.sql
const SEED: ObligationManual[] = [
  m("contabilidade_empresas", "SQ", "Gestão mensal · Empresas"),
  m("contabilidade_organizada", "TI CO", "Manual · TI CO"),
  m("contabilidade_TI_", "TI RS", "Gestão mensal · TI RS"),
  m("", null, "Manual · Técnica de contabilidade", 999),
  ...["IVA", "DMR_", "SS_TI", "SAFT", "retencao_fonte", "salarios", "emissao_faturas"].flatMap((p) => [
    m(p, "SQ", "Obrigações fiscais · Empresas"),
    m(p, "TI CO", "Obrigações fiscais · TI CO"),
    m(p, "TI RS", "Obrigações fiscais · TI RS"),
  ]),
];

const titulo = (type: string, tipo: string | null) => resolveManual(SEED, type, tipo).manual?.titulo;

describe("resolveManual", () => {
  it("Gestão Mensal resolve para o manual do regime (tipos reais)", () => {
    expect(titulo("contabilidade_empresas_vendas", "SQ")).toBe("Gestão mensal · Empresas");
    expect(titulo("contabilidade_empresas", "SQ")).toBe("Gestão mensal · Empresas");
    expect(titulo("contabilidade_organizada_e_fatura", "TI CO")).toBe("Manual · TI CO");
    expect(titulo("contabilidade_TI_iva_compras", "TI RS")).toBe("Gestão mensal · TI RS");
    expect(titulo("contabilidade_TI_isento", "TI RS")).toBe("Gestão mensal · TI RS");
  });
  it("obrigações fiscais pelo regime do cliente", () => {
    expect(titulo("IVA", "SQ")).toBe("Obrigações fiscais · Empresas");
    expect(titulo("IVA_recapitulativa", "TI CO")).toBe("Obrigações fiscais · TI CO");
    expect(titulo("DMR_SS", "TI RS")).toBe("Obrigações fiscais · TI RS");
    expect(titulo("SS_TI_DT", "TI RS")).toBe("Obrigações fiscais · TI RS");
    expect(titulo("emissao_faturas_S2", "SQ")).toBe("Obrigações fiscais · Empresas");
  });
  it("sem manual específico cai no manual geral", () => {
    const r = resolveManual(SEED, "outra_coisa", "SQ");
    expect(r.manual?.titulo).toBe("Manual · Técnica de contabilidade");
    expect(r.especifico).toBe(false);
    // regime diferente do prefixo → não serve
    expect(resolveManual(SEED, "contabilidade_empresas_vendas", "TI RS").especifico).toBe(false);
  });
  it("o prefixo mais comprido ganha; em empate o do regime ganha ao genérico", () => {
    const list = [m("IVA", null, "IVA geral"), m("IVA_flex", null, "Flexibilização"), m("IVA", "SQ", "IVA empresas")];
    expect(resolveManual(list, "IVA_flex_P1", "SQ").manual?.titulo).toBe("Flexibilização");
    expect(resolveManual(list, "IVA", "SQ").manual?.titulo).toBe("IVA empresas");
    expect(resolveManual(list, "IVA", "TI RS").manual?.titulo).toBe("IVA geral");
  });
  it("sem nenhum manual devolve null", () => {
    expect(resolveManual([], "IVA", "SQ")).toEqual({ manual: null, especifico: false });
  });
});

describe("tiposSemManual", () => {
  it("com o seed, todos os tipos conhecidos têm manual específico", () => {
    expect(tiposSemManual(SEED)).toEqual([]);
    expect(tiposDeObrigacaoConhecidos().length).toBeGreaterThan(30);
  });
  it("só com o geral, todos ficam sinalizados", () => {
    const geral = [m("", null, "Geral")];
    expect(tiposSemManual(geral).length).toBe(tiposDeObrigacaoConhecidos().length);
  });
});
