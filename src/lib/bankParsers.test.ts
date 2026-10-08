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

describe("Millennium Cartão de Crédito", () => {
  test("pagamento centralizado: uma conta, saldos batem", () => {
    const text = [
      "Extrato de: 2026/09/01 a 2026/09/30 Conta a Debitar: 45582688238 MILLENNIUM BCP",
      "Tipo de Operação: Cartão de Crédito Data do Débito: 2026/10/20",
      "Saldo em Dívida à Data do Créditos Débitos Saldo em Dívida à Data",
      "Extrato Anterior do Extrato Atual",
      "1 485.49 1 423.44 1 437.95 1 500.00",
      "Capital Juros Comissões/Despesas Impostos Total Pago",
      "1 401.41 19.80 1.38 0.85 1 423.44",
      "09/30 09/30 DEBITO JUROS 19.80",
      "09/30 09/30 IMPOSTO DO SELO - JUROS 0.79",
      "PAGAMENTO CENTRALIZADO",
      "Extrato Anterior do Extrato Atual",
      "0.00 1 519.33 1 519.33 0.00",
      "09/01 09/02 COMPRA 8820 SP TRACK FIELD VIS 1 511.83",
      "STORE LISBOA",
      "Banco Comercial Português, S.A., Sede: Praça D. João I, 28, 4000-295 Porto",
      "09/11 09/14 CRED. 8820 SP TRACK FIELD VIS 94.50",
      "09/07 09/07 IMPOSTO DO SELO 0.03",
      "09/30 09/30 TRANSF P/CONTA EMPR 1 417.36",
    ].join("\n");
    const p = parseBankText(text, "Millennium");
    expect(p.bank).toBe("Millennium Cartão");
    expect(p.saldoInicial).toBe(-1485.49);
    expect(p.saldoFinal).toBe(-1500);
    expect(p.transactions.map((t) => [t.descricao, t.movimento])).toEqual([
      ["PAGAMENTO CARTÃO DE CRÉDITO", 1423.44],
      ["COMPRA 8820 SP TRACK FIELD STORE LISBOA", -1511.83],
      ["IMPOSTO DO SELO", -0.03],
      ["CRED. 8820 SP TRACK FIELD", 94.5],
      ["DEBITO JUROS", -19.8],
      ["IMPOSTO DO SELO - JUROS", -0.79],
    ]);
    expect(p.transactions[1].dataValor.getDate()).toBe(2);
    const soma = p.transactions.reduce((s, t) => s + t.movimento, 0);
    expect(+(p.saldoInicial! + soma).toFixed(2)).toBe(p.saldoFinal);
  });
});
