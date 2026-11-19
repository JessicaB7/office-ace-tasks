// «Retenção na fonte e pagamentos por conta» do IRS (TI RS e TI CO) — regra pura, sem efeitos laterais.
// Base: conta 241 do balancete (2414 retenções + outras subcontas, ex. pagamentos por conta), o maior entre a soma
// dos trimestres importados e o acumulado do último balancete; sem 241, o valor manual.
// Acresce sempre o valor de pagamentos por conta pagos que não estão lançados no TOConline (`ppc_pagos_fora_toc`).

export interface RetencoesIrs {
  /** Valor vindo da conta 241 (0 se não houver balancete). */
  conta241: number;
  /** Valor manual usado quando não há 241. */
  manual: number;
  /** Pagamentos por conta pagos fora do TOConline. */
  ppcForaToc: number;
  /** Total que abate ao IRS (e limita o reembolso). */
  total: number;
  source: "auto" | "manual";
  /** Soma das subcontas 241 que não são 2414 (pagamentos por conta já lançados, provavelmente). */
  outras241: number;
  /** Há pagamentos por conta manuais e o balancete já tem outras subcontas da 241 → risco de contar a dobrar. */
  avisoDuplicado: boolean;
}

/** `entries`: mapa "mês:conta" → valor (como o da análise financeira). */
export function calcRetencoesIrs(
  entries: Map<string, number>,
  settings: { ret_241_acum?: number | string | null; irs_retencoes?: number | string | null; ppc_pagos_fora_toc?: number | string | null } | null | undefined,
): RetencoesIrs {
  let soma241 = 0;
  let outras241 = 0;
  for (const [key, val] of entries.entries()) {
    const code = key.split(":")[1] ?? "";
    if (!code.startsWith("241")) continue;
    soma241 += Math.abs(val);
    if (!code.startsWith("2414")) outras241 += Math.abs(val);
  }
  const conta241 = Math.max(soma241, Number(settings?.ret_241_acum ?? 0) || 0);
  const manual = Number(settings?.irs_retencoes ?? 0) || 0;
  const ppcForaToc = Math.max(0, Number(settings?.ppc_pagos_fora_toc ?? 0) || 0);
  const source = conta241 > 0 ? "auto" : "manual";
  const base = source === "auto" ? conta241 : manual;
  return {
    conta241,
    manual,
    ppcForaToc,
    total: base + ppcForaToc,
    source,
    outras241,
    avisoDuplicado: ppcForaToc > 0 && outras241 > 0.005,
  };
}
