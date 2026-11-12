/** Ligação das obrigações (monthly_obligations.obligation_type) aos manuais do Notion
 * (tabela obligation_manuals). Puro, sem side effects. */

import { SUB_PAGE_CONFIG, obligationTypesFor } from "./contabilidadesConfig.ts";

export interface ObligationManual {
  id: string;
  match_prefix: string;
  tipo_contabilidade: string | null;
  titulo: string;
  notion_url: string;
  ordem: number;
  updated_at?: string;
}

export interface ManualResolvido {
  manual: ObligationManual | null;
  /** false quando só o manual geral (prefixo vazio) se aplica. */
  especifico: boolean;
}

/**
 * Regra: o `match_prefix` mais comprido que seja início do tipo de obrigação, com
 * `tipo_contabilidade` igual ao do cliente ou vazio (qualquer regime). Em empate, o do
 * regime ganha ao genérico e depois conta a `ordem`.
 */
export function resolveManual(
  manuals: ObligationManual[],
  obligationType: string,
  tipoContabilidade: string | null | undefined,
): ManualResolvido {
  const candidatos = manuals
    .filter((m) => obligationType.startsWith(m.match_prefix ?? ""))
    .filter((m) => !m.tipo_contabilidade || m.tipo_contabilidade === tipoContabilidade)
    .sort(
      (a, b) =>
        (b.match_prefix ?? "").length - (a.match_prefix ?? "").length ||
        Number(!!b.tipo_contabilidade) - Number(!!a.tipo_contabilidade) ||
        (a.ordem ?? 0) - (b.ordem ?? 0),
    );
  const manual = candidatos[0] ?? null;
  return { manual, especifico: !!manual && (manual.match_prefix ?? "") !== "" };
}

export const TIPOS_CONTABILIDADE = ["SQ", "TI CO", "TI RS"] as const;

/** Regime de cada separador da Gestão Mensal. */
export const REGIME_TIPO: Record<string, string> = {
  TI_isento: "TI RS",
  TI_iva: "TI RS",
  organizada: "TI CO",
  empresas: "SQ",
};

/** Tipos de obrigação usados pela app, por regime (Gestão Mensal + Obrigações Mensais). */
export function tiposDeObrigacaoConhecidos(): { type: string; tipo: string }[] {
  const out: { type: string; tipo: string }[] = [];
  for (const [key, cfg] of Object.entries(SUB_PAGE_CONFIG)) {
    const tipo = REGIME_TIPO[key];
    if (!tipo) continue;
    obligationTypesFor(key, cfg).forEach((type) => out.push({ type, tipo }));
  }
  const comuns = ["SAFT", "salarios", "DMR_AT", "DMR_SS", "IVA", "IVA_recapitulativa", "IVA_OSS", "IVA_flex_P1", "emissao_faturas"];
  for (const tipo of TIPOS_CONTABILIDADE) {
    comuns.forEach((type) => out.push({ type, tipo }));
    if (tipo !== "SQ") ["SS_TI", "SS_TI_DT"].forEach((type) => out.push({ type, tipo }));
    if (tipo !== "TI RS") out.push({ type: "retencao_fonte", tipo });
  }
  return out;
}

/** Combinações tipo de obrigação × regime que só têm o manual geral. */
export function tiposSemManual(manuals: ObligationManual[], combos = tiposDeObrigacaoConhecidos()) {
  return combos.filter((c) => !resolveManual(manuals, c.type, c.tipo).especifico);
}
