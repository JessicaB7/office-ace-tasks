// IRS (pessoas singulares) — escalões 2026 e tributação conjunta (art. 69.º CIRS, quociente conjugal).
// Regras puras, sem efeitos laterais: usadas nos dashboards TI Simplificado e TI Organizado.
import { DEDUCAO_ESPECIFICA_15 } from "./despesas15";

// Escalões IRS 2026 — método "taxa × rendimento − parcela a abater"
export const IRS_BRACKETS: { upTo: number; rate: number; abate: number }[] = [
  { upTo: 8342, rate: 0.125, abate: 0 },
  { upTo: 12587, rate: 0.157, abate: 266.94 },
  { upTo: 17838, rate: 0.212, abate: 959.26 },
  { upTo: 23089, rate: 0.241, abate: 1476.45 },
  { upTo: 29397, rate: 0.311, abate: 3092.77 },
  { upTo: 43090, rate: 0.349, abate: 4209.94 },
  { upTo: 46566, rate: 0.431, abate: 7743.27 },
  { upTo: 86634, rate: 0.446, abate: 8441.48 },
  { upTo: Infinity, rate: 0.48, abate: 11387.17 },
];

/** Coleta (IRS antes de deduções e retenções) para um rendimento coletável. */
export function calcIRS(rendimentoColectavel: number): number {
  if (!(rendimentoColectavel > 0)) return 0;
  for (const b of IRS_BRACKETS) {
    if (rendimentoColectavel <= b.upTo) return Math.max(0, rendimentoColectavel * b.rate - b.abate);
  }
  return 0;
}

/**
 * IRS líquido = coleta − deduções − retenções. As deduções só abatem até à coleta, por isso o
 * IRS a receber nunca excede a retenção na fonte + pagamentos por conta.
 */
export function irsLiquido(coleta: number, deducoes: number, retencoes: number): number {
  return Math.max(coleta - deducoes - retencoes, -retencoes);
}

/** Taxa da Segurança Social do trabalhador por conta de outrem (dedução específica da cat. A). */
export const TAXA_SS_TRABALHADOR = 0.11;

export type ConjugeTipoRendimento = "bruto_a" | "coletavel";

/**
 * Rendimento coletável do cônjuge.
 * - "bruto_a": rendimento bruto do trabalho dependente; tira-se a dedução específica
 *   = max(4.587,09 €, contribuições SS de 11%), sem passar o próprio rendimento.
 * - "coletavel": valor já coletável (ex.: TI com o coeficiente ou o resultado já aplicado).
 */
export function rendimentoColetavelConjuge(valor: number, tipo: ConjugeTipoRendimento): {
  coletavel: number;
  deducaoEspecifica: number;
} {
  const v = Math.max(0, Number(valor) || 0);
  if (tipo === "coletavel") return { coletavel: v, deducaoEspecifica: 0 };
  const deducaoEspecifica = Math.min(v, Math.max(DEDUCAO_ESPECIFICA_15, v * TAXA_SS_TRABALHADOR));
  return { coletavel: v - deducaoEspecifica, deducaoEspecifica };
}

export type IrsConjuntoInput = {
  /** Rendimento coletável do titular (já com coeficiente/resultado, benefícios e outros rendimentos). */
  rcTitular: number;
  /** Rendimentos isentos do titular (IRS Jovem, brutos) englobados só para determinar a taxa. */
  isentosTitular?: number;
  deducoesTitular: number;
  retencoesTitular: number;
  conjuge: {
    rendimento: number;
    tipo: ConjugeTipoRendimento;
    deducoes: number;
    retencoes: number;
  };
};

export type IrsConjuntoResult = {
  rcConjuge: number;
  deducaoEspecificaConjuge: number;
  rcTotal: number;
  /** Rendimento coletável ÷ 2 — é a este valor que se aplicam os escalões. */
  quociente: number;
  /** Rendimentos isentos englobados para a taxa (IRS Jovem). */
  isentos: number;
  /** Coleta = 2 × IRS((RC + isentos) ÷ 2) × RC ÷ (RC + isentos). */
  coleta: number;
  deducoes: number;
  retencoes: number;
  /** Positivo = a pagar; negativo = a receber. */
  liquido: number;
  separado: { titular: number; conjuge: number; total: number };
  /** separado − conjunto: positivo = o conjunto poupa este valor. */
  poupancaConjunto: number;
};

/** Rendimentos isentos englobados para a taxa: a coleta fica só com a parte do rendimento coletável. */
const coletaComIsentos = (importancia: number, coletavel: number, base: number): number =>
  base > 0 ? (importancia * coletavel) / base : 0;

export function calcIrsConjunto(input: IrsConjuntoInput): IrsConjuntoResult {
  const rcTitular = Math.max(0, input.rcTitular);
  const { coletavel: rcConjuge, deducaoEspecifica } = rendimentoColetavelConjuge(
    input.conjuge.rendimento,
    input.conjuge.tipo,
  );
  const dedT = Math.max(0, input.deducoesTitular);
  const retT = Math.max(0, input.retencoesTitular);
  const dedC = Math.max(0, input.conjuge.deducoes);
  const retC = Math.max(0, input.conjuge.retencoes);

  const isentos = Math.max(0, input.isentosTitular ?? 0);
  const rcTotal = rcTitular + rcConjuge;
  const base = rcTotal + isentos;
  const quociente = base / 2;
  const coleta = coletaComIsentos(2 * calcIRS(quociente), rcTotal, base);
  const deducoes = dedT + dedC;
  const retencoes = retT + retC;
  const liquido = irsLiquido(coleta, deducoes, retencoes);

  const sepTitular = irsLiquido(coletaComIsentos(calcIRS(rcTitular + isentos), rcTitular, rcTitular + isentos), dedT, retT);
  const sepConjuge = irsLiquido(calcIRS(rcConjuge), dedC, retC);
  const sepTotal = sepTitular + sepConjuge;

  return {
    rcConjuge,
    deducaoEspecificaConjuge: deducaoEspecifica,
    rcTotal,
    isentos,
    quociente,
    coleta,
    deducoes,
    retencoes,
    liquido,
    separado: { titular: sepTitular, conjuge: sepConjuge, total: sepTotal },
    poupancaConjunto: sepTotal - liquido,
  };
}
