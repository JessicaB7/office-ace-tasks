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
