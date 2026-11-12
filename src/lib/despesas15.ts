/**
 * Regime simplificado (IRS, categoria B) — art. 31.º, n.os 13 e 14, do CIRS.
 *
 * Nos rendimentos com coeficiente 0,75 (prestações de serviços do art. 151.º) e 0,35,
 * a dedução implícita só é aceite na íntegra se o contribuinte justificar despesas de,
 * pelo menos, 15% dos rendimentos brutos dessas atividades. Se ficar aquém, a diferença
 * é acrescida ao rendimento tributável.
 *
 * Contam para os 15%: a dedução específica de 4.104 € (ou, se superior, as contribuições
 * obrigatórias para a Segurança Social), despesas com pessoal, rendas, despesas da atividade
 * comunicadas no e-Fatura, 1,5% do VPT de imóveis afetos, etc.
 */

export const DESPESAS_15_PCT = 0.15;
export const DEDUCAO_ESPECIFICA_15 = 4104;
const COEFS_SUJEITOS = [0.75, 0.35];

export type Despesas15Input = {
  /** Rendimento bruto das atividades com coeficiente 0,75 / 0,35. */
  rendimentoBruto: number;
  coeficiente: number;
  /** Contribuições obrigatórias para a Segurança Social pagas no ano. */
  segurancaSocial: number;
  /** Despesas da atividade já registadas (FSE, compras, pessoal, outras despesas). */
  despesasAtividade: number;
  /** Despesas justificadas extra introduzidas à mão (e-Fatura, rendas, 1,5% VPT...). */
  despesasExtra?: number;
};

export type Despesas15Result = {
  aplicavel: boolean;
  /** 15% do rendimento bruto. */
  exigido: number;
  /** max(4.104 €, SS). */
  deducaoEspecifica: number;
  deducaoEspecificaOrigem: "fixa" | "ss";
  /** Despesas da atividade + extra. */
  despesas: number;
  /** deducaoEspecifica + despesas. */
  justificado: number;
  /** max(0, exigido − justificado). */
  emFalta: number;
  /** Valor acrescido ao rendimento tributável (= emFalta quando aplicável). */
  acrescimo: number;
  cumpre: boolean;
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const pos = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);

export function isCoeficienteSujeito15(coeficiente: number): boolean {
  return COEFS_SUJEITOS.some((c) => Math.abs(c - Number(coeficiente)) < 1e-9);
}

export function calcDespesas15(input: Despesas15Input): Despesas15Result {
  const bruto = pos(input.rendimentoBruto);
  const ss = pos(input.segurancaSocial);
  const deducaoEspecifica = Math.max(DEDUCAO_ESPECIFICA_15, ss);
  const despesas = pos(input.despesasAtividade) + pos(input.despesasExtra ?? 0);
  const justificado = deducaoEspecifica + despesas;
  const exigido = bruto * DESPESAS_15_PCT;
  const aplicavel = isCoeficienteSujeito15(input.coeficiente) && bruto > 0;
  const emFalta = aplicavel ? Math.max(0, exigido - justificado) : 0;
  return {
    aplicavel,
    exigido: r2(exigido),
    deducaoEspecifica: r2(deducaoEspecifica),
    deducaoEspecificaOrigem: ss > DEDUCAO_ESPECIFICA_15 ? "ss" : "fixa",
    despesas: r2(despesas),
    justificado: r2(justificado),
    emFalta: r2(emFalta),
    acrescimo: r2(emFalta),
    cumpre: emFalta <= 0.005,
  };
}
