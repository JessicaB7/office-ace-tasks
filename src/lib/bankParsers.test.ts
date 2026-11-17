import { describe, expect, test } from "vitest";
import { fixMojibake, parseBankText, pdfSemTexto } from "./bankParsers";

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

describe("Crédito Agrícola", () => {
  test("datas ISO, descritivo em duas linhas, rodapés e sinal pelo saldo", () => {
    const text = [
      "Internet: www.creditoagricola.pt",
      "Data Mov. Data Valor Descritivo",
      "Débito Crédito Valor",
      "Saldo em 30-06-2026 404,12",
      "2026-07-01 2026-07-01 IPS/R3168510523-ANA PAULA TESTA 30,00 434,12",
      "A Transportar 434,12",
      "Agradecemos que qualquer reclamação sobre a informação constante deste documento",
      "Transporte 434,12",
      "2026-07-01 2026-07-01 Trf crédito intrab benef diferentes ANABELA",
      "CRISTINA SIMÕES PAULINO 33,00 467,12",
      "2026-07-07 2026-07-07 Trf imediata JESSICA BRANDAO LDA 184,50 282,62",
      "2026-07-07 2026-07-07 Transferência imediata SEPA + 1,04 281,58",
      "2026-07-11 2026-07-10 Manutenção de conta 20,80 260,78",
      "Saldo em 31-07-2026 260,78",
    ].join("\n");
    const p = parseBankText(text);
    expect(p.bank).toBe("Crédito Agrícola");
    expect(p.transactions.map((t) => t.movimento)).toEqual([30, 33, -184.5, -1.04, -20.8]);
    expect(p.transactions[1].descricao).toBe("Trf crédito intrab benef diferentes ANABELA CRISTINA SIMÕES PAULINO");
    expect(p.transactions[4].dataValor.getDate()).toBe(10);
    expect(p.saldoInicial).toBe(404.12);
    expect(p.saldoFinal).toBe(260.78);
  });
});

describe("Bankinter", () => {
  test("contas à ordem: ano do saldo inicial, descritivo em 2 linhas, ignora conta corrente", () => {
    const text = [
      "Extracto N° 327/203296715/02/26 EMPRESA TESTE LDA",
      "NIB: 0269 0327 00203296715 77 IBAN: PT50 0269 0327 0020 3296 7157 7 SWIFT/BIC: BKBKPTPL",
      "Pag. 2 de 3",
      "CONTAS À ORDEM",
      "Data Descritivo Data Movimento Saldo",
      "Valor Cred. / Deb.",
      "Saldo em 2026/02/01 50.429,59",
      "02/02 Comissao imobilizacao 327203296749 2026-01-01 a 01/02 -7,59 50.422,00",
      "2026-01-31",
      "02/02 Trf a credito sepa+ - acbf - p-bankinter- 02/02 3.000,00 53.422,00",
      "19/02 Juros devedores 02/02 203,20 53.625,20",
      "23/02 Trf a credito sepa+ - centro de reciclagem de - po 23/02 629,20 54.254,40",
      "cf2602206",
      "27/02 Transferências imediatas - ordenados - salarios fevereiro 27/02 -9.764,56 44.489,84",
      "Saldo em 2026/02/28 44.489,84",
      "CONTAS CORRENTES BANCÁRIAS",
      "Encargos e Despesas",
      "02/02 Comissao imobilizacao 327203296749 2026-01-01 a 01/02 0 -7,59",
      "www.bankinter.pt",
      "Bankinter, S.A. - Sede: Paseo de la Castellana",
    ].join("\n");
    const p = parseBankText(text);
    expect(p.bank).toBe("Bankinter");
    expect(p.transactions.map((t) => t.movimento)).toEqual([-7.59, 3000, 203.2, 629.2, -9764.56]);
    expect(p.transactions[0].descricao).toBe("Comissao imobilizacao 327203296749 2026-01-01 a 2026-01-31");
    expect(p.transactions[3].descricao).toBe("Trf a credito sepa+ - centro de reciclagem de - po cf2602206");
    expect(p.transactions[2].dataMov.getDate()).toBe(19);
    expect(p.transactions[2].dataValor.getDate()).toBe(2);
    expect(p.transactions[0].dataMov.getFullYear()).toBe(2026);
    expect(p.saldoInicial).toBe(50429.59);
    expect(p.saldoFinal).toBe(44489.84);
    const soma = p.transactions.reduce((s, t) => s + t.movimento, 0);
    expect(+(p.saldoInicial! + soma).toFixed(2)).toBe(p.saldoFinal);
  });
});

describe("pdfSemTexto", () => {
  test("deteta PDF só com imagem (2ª via) e aceita PDF com texto", () => {
    expect(pdfSemTexto("2ªVIA\n2ªVIA\n2ªVIA", 3)).toBe(true);
    expect(pdfSemTexto("Saldo em 2026/02/01 50.429,59\n02/02 Comissao imobilizacao 327203296749 01/02 -7,59 50.422,00", 1)).toBe(false);
  });
});
