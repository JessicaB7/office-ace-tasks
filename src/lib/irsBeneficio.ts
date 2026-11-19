// Benefícios de IRS sobre o rendimento do titular (TI RS e TI CO) — regra pura, sem efeitos laterais.
//
// IRS Jovem (art. 12.º-B CIRS, redação OE2025): isenção de 100% / 75% / 50% / 25% do rendimento BRUTO das categorias A e B
// (na cat. B simplificada: da faturação, antes do coeficiente), com o montante isento limitado a 55 × IAS por ano.
// O coeficiente aplica-se só à parte não isenta. Os rendimentos isentos (brutos) são englobados para determinar a taxa:
// taxa sobre (coletável + isento) e coleta = IRS(coletável + isento) × coletável ÷ (coletável + isento).
// Confirmado com uma liquidação real de 2025: faturação 29 265 € (campo 404, coef. 0,35), 50% → isento 14 632,50,
// coletável 5 121,37, base da taxa 19 753,87, «Imposto correspondente a rendimentos isentos» 2 495,76, coleta 873,51.
// Programa Regressar (art. 12.º-A CIRS): 50% excluído de tributação, sem limite e sem englobamento para a taxa.
import { calcIRS } from "./irs";

export const IAS_2026 = 537.13;
/** Limite anual do montante isento pelo IRS Jovem (55 × IAS). */
export const LIMITE_IRS_JOVEM = Math.round(55 * IAS_2026 * 100) / 100; // 29 542,15 €

export type TipoBeneficioIrs = "jovem" | "regressar";

export interface BeneficioIrs {
  tipo: TipoBeneficioIrs;
  /** Fração isenta (0, 0.25, 0.5, 0.75, 1). */
  pct: number;
}

export interface EntradaBeneficio {
  /** Rendimento bruto da atividade: faturação (simplificado) ou resultado (organizado). */
  bruto: number;
  /** Coeficiente do regime simplificado (1 no organizado). */
  coeficiente?: number;
  /** Acréscimo dos 15% de despesas (art. 31.º n.º 13) — segue a proporção não isenta. */
  acrescimo?: number;
  /** Outros rendimentos (não isentos). */
  outros?: number;
}

export interface ResultadoBeneficio {
  /** Montante bruto isento / excluído. */
  isento: number;
  /** O limite de 55 × IAS cortou a isenção. */
  limitado: boolean;
  /** Rendimento coletável da atividade (parte não isenta × coeficiente). */
  atividade: number;
  /** Acréscimo dos 15% depois do benefício. */
  acrescimo: number;
  /** Rendimento coletável total (atividade + acréscimo + outros). */
  coletavel: number;
  /** Rendimento para determinar a taxa (coletável + isentos englobados). */
  baseTaxa: number;
  /** Imposto correspondente aos rendimentos isentos (abate à importância apurada). */
  impostoIsentos: number;
  /** Coleta (IRS antes de deduções e retenções). */
  coleta: number;
}

export function aplicarBeneficioIrs(e: EntradaBeneficio, beneficio: BeneficioIrs | null | undefined): ResultadoBeneficio {
  const bruto = Math.max(0, e.bruto || 0);
  const coef = e.coeficiente ?? 1;
  const acrescimoBase = Math.max(0, e.acrescimo || 0);
  const outros = Math.max(0, e.outros || 0);
  const pct = beneficio ? Math.max(0, Math.min(1, Number(beneficio.pct) || 0)) : 0;
  const jovem = beneficio?.tipo !== "regressar";

  const semLimite = bruto * pct;
  const isento = jovem ? Math.min(semLimite, LIMITE_IRS_JOVEM) : semLimite;
  const fracNaoIsenta = bruto > 0 ? (bruto - isento) / bruto : 1;
  const atividade = (bruto - isento) * coef;
  const acrescimo = acrescimoBase * fracNaoIsenta;
  const coletavel = atividade + acrescimo + outros;
  const englobado = jovem && isento > 0 ? isento : 0;
  const baseTaxa = coletavel + englobado;
  const importancia = calcIRS(baseTaxa);
  const coleta = baseTaxa > 0 ? (importancia * coletavel) / baseTaxa : 0;
  return {
    isento,
    limitado: jovem && semLimite > LIMITE_IRS_JOVEM,
    atividade,
    acrescimo,
    coletavel,
    baseTaxa,
    impostoIsentos: importancia - coleta,
    coleta,
  };
}

/** Lê o benefício da ficha do cliente. */
export function beneficioDoCliente(c: { irs_isencao_pct?: number | string | null; irs_beneficio?: string | null } | null | undefined): BeneficioIrs {
  const pct = Number(c?.irs_isencao_pct ?? 0) || 0;
  return { tipo: c?.irs_beneficio === "regressar" ? "regressar" : "jovem", pct };
}

/** Valor do seletor ("0", "jovem:0.75", "regressar:0.5"). */
export const valorSeletorBeneficio = (b: BeneficioIrs): string => (b.pct > 0 ? `${b.tipo}:${b.pct}` : "0");

export function lerSeletorBeneficio(v: string): BeneficioIrs {
  const [tipo, pct] = v.split(":");
  if (!pct) return { tipo: "jovem", pct: 0 };
  return { tipo: tipo === "regressar" ? "regressar" : "jovem", pct: Math.max(0, Math.min(1, Number(pct) || 0)) };
}

export const OPCOES_BENEFICIO: { value: string; label: string }[] = [
  { value: "0", label: "Sem benefício" },
  { value: "jovem:1", label: "IRS Jovem — 100% (1.º ano)" },
  { value: "jovem:0.75", label: "IRS Jovem — 75% (2.º a 4.º ano)" },
  { value: "jovem:0.5", label: "IRS Jovem — 50% (5.º a 7.º ano)" },
  { value: "jovem:0.25", label: "IRS Jovem — 25% (8.º a 10.º ano)" },
  { value: "regressar:0.5", label: "Programa Regressar — 50%" },
];

/** Texto curto para os rótulos («IRS Jovem 75%», «Regressar 50%»). */
export const rotuloBeneficio = (b: BeneficioIrs): string =>
  `${b.tipo === "regressar" ? "Programa Regressar" : "IRS Jovem"} ${(b.pct * 100).toLocaleString("pt-PT")}%`;
