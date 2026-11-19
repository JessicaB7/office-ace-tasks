// Benefícios de IRS sobre o rendimento do titular (TI RS e TI CO) — regra pura, sem efeitos laterais.
//
// IRS Jovem (art. 12.º-B CIRS, redação OE2025): isenção de 100% / 75% / 50% / 25% do rendimento das categorias A e B,
// com o montante isento limitado a 55 × IAS por ano; os rendimentos isentos são englobados para determinar a taxa dos
// restantes (coleta = IRS(total) × não isento ÷ total — taxa média).
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

export interface ResultadoBeneficio {
  /** Rendimento da atividade (antes do benefício). */
  rendimento: number;
  /** Montante isento / excluído. */
  isento: number;
  /** O limite de 55 × IAS cortou a isenção. */
  limitado: boolean;
  /** Rendimento coletável que paga IRS (atividade não isenta + outros rendimentos). */
  coletavel: number;
  /** Rendimento usado para a taxa (com os isentos, no IRS Jovem). */
  baseTaxa: number;
  /** Coleta (IRS antes de deduções e retenções). */
  coleta: number;
}

export function aplicarBeneficioIrs(
  rendimentoAtividade: number,
  outrosRendimentos: number,
  beneficio: BeneficioIrs | null | undefined,
): ResultadoBeneficio {
  const rendimento = Math.max(0, rendimentoAtividade || 0);
  const outros = Math.max(0, outrosRendimentos || 0);
  const pct = Math.max(0, Math.min(1, Number(beneficio?.pct) || 0));

  if (!beneficio || pct === 0) {
    const coletavel = rendimento + outros;
    return { rendimento, isento: 0, limitado: false, coletavel, baseTaxa: coletavel, coleta: calcIRS(coletavel) };
  }

  if (beneficio.tipo === "regressar") {
    const isento = rendimento * pct;
    const coletavel = rendimento - isento + outros;
    return { rendimento, isento, limitado: false, coletavel, baseTaxa: coletavel, coleta: calcIRS(coletavel) };
  }

  // IRS Jovem
  const semLimite = rendimento * pct;
  const isento = Math.min(semLimite, LIMITE_IRS_JOVEM);
  const baseTaxa = rendimento + outros;
  const coletavel = baseTaxa - isento;
  const coleta = baseTaxa > 0 ? (calcIRS(baseTaxa) * coletavel) / baseTaxa : 0;
  return { rendimento, isento, limitado: semLimite > LIMITE_IRS_JOVEM, coletavel, baseTaxa, coleta };
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
