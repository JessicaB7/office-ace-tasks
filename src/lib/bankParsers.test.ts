import { describe, expect, test } from "vitest";
import { fixMojibake, parseBankText } from "./bankParsers";

describe("fixMojibake", () => {
  test("repara UTF-8 lido como Windows-1252", () => {
    expect(fixMojibake("COMISSÃƒO DE PRESTAÃ‡ÃƒO")).toBe("COMISSÃO DE PRESTAÇÃO");
    expect(fixMojibake("DEPÃ“SITO EM DINHEIRO")).toBe("DEPÓSITO EM DINHEIRO");
    expect(fixMojibake("Pagamento CartÃ£o de CrÃ©dito")).toBe("Pagamento Cartão de Crédito");
  });
  test("não altera texto correto", () => {
    expect(fixMojibake("MANUTENÇÃO DE CONTA")).toBe("MANUTENÇÃO DE CONTA");
    expect(fixMojibake("Ã€ ordem")).toBe("À ordem");
  });
});

describe("Abanca", () => {
  test("layout com Data e Data Valor", () => {
    const text = [
      "IBAN PT50 0170 3779 0304 0017 9609 8 Periodo da informação: 01-07-2026 31-07-2026",
      "Data Data Valor Descrição Montante Saldo Divisa",
      "01-07-2026 01-07-2026 DD.COMP. PORTUGUESA DE SEGUROS DE SAUDE, SA.BCOM -66,56 1.742,55",
      "07-07-2026 07-07-2026 COMISSÃƒO DE GESTÃƒO3779 000522 -3,48 1.739,07",
      "29-07-2026 28-07-2026 Pagamento CartÃ£o de CrÃ©dito 45091 8722 -149,56 1.589,51",
    ].join("\n");
    const p = parseBankText(text, "Abanca");
    expect(p.transactions.map((t) => t.descricao)).toEqual([
      "DD.COMP. PORTUGUESA DE SEGUROS DE SAUDE, SA.BCOM",
      "COMISSÃO DE GESTÃO3779 000522",
      "Pagamento Cartão de Crédito 45091 8722",
    ]);
    expect(p.transactions[2].dataValor.getDate()).toBe(28);
    expect(p.saldoInicial).toBe(1809.11);
    expect(p.saldoFinal).toBe(1589.51);
  });
  test("layout antigo só com uma data", () => {
    const p = parseBankText("abanca\n02-06-2026 LOUSAMAIA LDA 1.200,00 3.200,00", "Abanca");
    expect(p.transactions[0].descricao).toBe("LOUSAMAIA LDA");
    expect(p.transactions[0].movimento).toBe(1200);
  });
});

describe("Millennium", () => {
  test("saldo devedor com o sinal no fim (\"1 859.34 -\")", () => {
    const text = [
      "EXTRATO DE 2026/09/01 A 2026/09/30",
      "SALDO INICIAL 594.81",
      "9.25 9.25 DD AT - AUTORIDAD AT202600000002 PT96113924 2 454.15 1 859.34 -",
      "9.25 9.25 COM.INTERVENCAO S/COBRANCA 2.50 1 861.84 -",
      "9.28 9.28 TRF. P/O UNICRE S.A. 695.63 1 166.21 -",
      "9.30 9.30 CREDITO TPA BCP 1364234 MOV N 43 1 400.00 233.79",
      "SALDO FINAL 233.79",
    ].join("\n");
    const p = parseBankText(text, "Millennium");
    expect(p.transactions.map((t) => t.movimento)).toEqual([-2454.15, -2.5, 695.63, 1400]);
    expect(p.transactions[0].descricao).toBe("DD AT - AUTORIDAD AT202600000002 PT96113924");
    expect(p.saldoFinal).toBe(233.79);
    expect(parseBankText("EXTRATO DE 2026/09/01\nSALDO INICIAL 10.00\nSALDO FINAL 57.67 -", "Millennium").saldoFinal).toBe(-57.67);
  });
});
