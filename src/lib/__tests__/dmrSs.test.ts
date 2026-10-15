import { describe, it, expect } from "vitest";
import { parseDmrSsNotes, totalDividas, temDividas, dmrSsToTsv, parseEuro } from "../dmrSs";

describe("parseDmrSsNotes", () => {
  it("lê valor, prazo, referência, ficheiro e dívidas", () => {
    const d = parseDmrSsNotes("DMR SS 09/2026 — 1.243,58 € até 26/10/2026 — Ref. MB 21056/885705971 (DMR SS/Guia_DMR_SS_Leve_Petala_Unipessoal_Lda_09_2026.pdf) — Atraso 6.664,85 € · Coimas 0,00 € · Outros 0,00 € · Execução fiscal 3.304,87 € · acordo: Execução Fiscal Plano 7485/2026 com prestações em atraso 388,32 €");
    expect(d).toMatchObject({
      valor: 1243.58, data_limite: "2026-10-26", entidade: "21056", referencia: "885705971",
      ficheiro: "Guia_DMR_SS_Leve_Petala_Unipessoal_Lda_09_2026.pdf",
      atraso: 6664.85, coimas: 0, outros: 0, execucao_fiscal: 3304.87,
    });
    expect(d?.acordos).toContain("7485/2026");
  });

  it("lê a parte de trabalhador independente e referências com zeros à esquerda", () => {
    const d = parseDmrSsNotes("DMR SS 09/2026 — 977,69 € (entidade empregadora) até 26/10/2026 — Ref. MB 21431/035998970 (DMR SS/Guia_DMR_SS_X_09_2026.pdf) — Atenção: há também contribuições de trabalhador independente 1.379,35 € até 20/10/2026");
    expect(d?.valor).toBe(977.69);
    expect(d?.referencia).toBe("035998970");
    expect(d?.valor_ti).toBe(1379.35);
  });

  it("reconhece 'já entregue' e ignora textos de outros procedimentos", () => {
    expect(parseDmrSsNotes("DMR SS 09/2026 — já entregue (Pagamento marcado) — nada a fazer")?.ja_entregue).toBe(true);
    expect(parseDmrSsNotes("DMR AT 09/2026 — montante 10,00 €")).toBeNull();
    expect(parseDmrSsNotes(null)).toBeNull();
  });
});

describe("dívidas e exportação", () => {
  it("soma dívidas e deteta acordos", () => {
    expect(totalDividas({ atraso: 10, execucao_fiscal: 5.5, coimas: 1, outros: 0 })).toBe(16.5);
    expect(temDividas({ atraso: 0 })).toBe(false);
    expect(temDividas({ acordos: "Plano 1/2026" })).toBe(true);
  });

  it("gera TSV com cabeçalho e valores em formato português", () => {
    const tsv = dmrSsToTsv([{ cliente: "A Lda", nif: "500000000", estado: "Concluída", data: { valor: 1511.63, entidade: "21056", referencia: "885694031", data_limite: "2026-10-26" } }]);
    const [head, line] = tsv.split("\n");
    expect(head.split("\t")[0]).toBe("Cliente");
    expect(line.split("\t")).toEqual(expect.arrayContaining(["A Lda", "1511,63", "885694031", "26/10/2026"]));
  });

  it("parseEuro", () => expect(parseEuro("22.113,98")).toBe(22113.98));
});
