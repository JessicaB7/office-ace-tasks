/** Robot da análise financeira: junta os números que a app já mostra num resumo compacto
 * para a função `robot-analise` escrever o texto a enviar ao cliente. Cálculo puro, sem side effects. */
import type { FinancialAccount, FinancialEntry, FinancialSettings } from "@/hooks/useClientFinancials";
import { buildEntryMap, classMonthlyTotals, computeMapaExploracao, MONTHS_FULL } from "@/components/financial/financialMath";

const CLASSES: Record<string, string> = {
  "71": "Vendas",
  "72": "Prestações de serviços",
  "73": "Variações nos inventários da produção",
  "74": "Trabalhos para a própria entidade",
  "75": "Subsídios à exploração",
  "76": "Reversões",
  "78": "Outros rendimentos",
  "79": "Juros e rendimentos similares",
  "31": "Compras de mercadorias",
  "61": "Custo das mercadorias vendidas",
  "62": "Fornecimentos e serviços externos",
  "63": "Gastos com o pessoal",
  "64": "Depreciações",
  "65": "Perdas por imparidade",
  "67": "Provisões",
  "68": "Outros gastos",
  "69": "Gastos de financiamento",
};

const r2 = (n: number) => Math.round(n * 100) / 100 || 0; // sem -0
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export interface RobotResumo {
  regime: string;
  ano: number;
  periodo: string;
  ultimoMes: number;
  porTrimestre: { trimestre: string; rendimentos: number; gastos: number; resultado: number }[];
  porMes: { mes: string; rendimentos: number; gastos: number; resultado: number }[];
  rubricas: { conta: string; nome: string; total: number }[];
  totais: { rendimentos: number; gastos: number; resultado: number; margemPct: number | null };
  anoAnteriorMesmoPeriodo: { rendimentos: number; gastos: number; resultado: number } | null;
  ivaPorTrimestre: { trimestre: string; valor: number }[];
  segurancaSocialTrimestral?: { trimestre: string; valor: number }[];
  outrasDespesas?: { titulo: string; valor: number };
}

/** Último mês com algum valor de rendimentos ou gastos (0 = sem dados). */
function lastMonthWithData(rend: number[], gastos: number[]): number {
  for (let m = 12; m >= 1; m--) if (rend[m - 1] !== 0 || gastos[m - 1] !== 0) return m;
  return 0;
}

export function buildRobotResumo(args: {
  regime: string;
  year: number;
  accounts: FinancialAccount[];
  entries: FinancialEntry[];
  settings: FinancialSettings;
  prevEntries?: FinancialEntry[];
}): RobotResumo {
  const { regime, year, accounts, entries, settings, prevEntries } = args;
  const map = buildEntryMap(entries);
  const mapa = computeMapaExploracao(map, accounts, settings);
  // gastos/compras vêm negativos no mapa — no resumo vão positivos
  const gastos = mapa.gastos.map((g, i) => -(g + mapa.compras[i]));
  const last = lastMonthWithData(mapa.rendimentos, gastos);
  const months = Array.from({ length: last }, (_, i) => i);

  const porMes = months.map((i) => ({
    mes: MONTHS_FULL[i],
    rendimentos: r2(mapa.rendimentos[i]),
    gastos: r2(gastos[i]),
    resultado: r2(mapa.resultado[i]),
  }));

  const porTrimestre = [0, 1, 2, 3]
    .filter((q) => q * 3 < last)
    .map((q) => {
      const idx = [q * 3, q * 3 + 1, q * 3 + 2].filter((i) => i < last);
      const rend = sum(idx.map((i) => mapa.rendimentos[i]));
      const g = sum(idx.map((i) => gastos[i]));
      return { trimestre: `${q + 1}º trimestre`, rendimentos: r2(rend), gastos: r2(g), resultado: r2(rend - g) };
    });

  const classes = classMonthlyTotals(map, accounts, Object.keys(CLASSES));
  const rubricas = Object.entries(classes)
    .map(([conta, vals]) => ({ conta, nome: CLASSES[conta], total: r2(sum(vals)) }))
    .filter((r) => r.total !== 0);

  const totRend = sum(mapa.rendimentos.slice(0, last));
  const totGastos = sum(gastos.slice(0, last));
  const totRes = totRend - totGastos;

  let anoAnterior: RobotResumo["anoAnteriorMesmoPeriodo"] = null;
  if (prevEntries && prevEntries.length > 0 && last > 0) {
    const prev = computeMapaExploracao(buildEntryMap(prevEntries), accounts, settings);
    const pr = sum(prev.rendimentos.slice(0, last));
    const pg = -sum(prev.gastos.slice(0, last)) - sum(prev.compras.slice(0, last));
    if (pr !== 0 || pg !== 0) anoAnterior = { rendimentos: r2(pr), gastos: r2(pg), resultado: r2(pr - pg) };
  }

  const quarters = Math.ceil(last / 3);
  const iva = [settings.iva_q1, settings.iva_q2, settings.iva_q3, settings.iva_q4]
    .map((v, q) => ({ trimestre: `${q + 1}º trimestre`, valor: v }))
    .filter((x, q) => q < quarters && x.valor !== null && x.valor !== undefined)
    .map((x) => ({ trimestre: x.trimestre, valor: r2(Number(x.valor)) }));

  const resumo: RobotResumo = {
    regime,
    ano: year,
    periodo: last > 0 ? `janeiro a ${MONTHS_FULL[last - 1].toLowerCase()} de ${year}` : `${year} (sem dados)`,
    ultimoMes: last,
    porTrimestre,
    porMes,
    rubricas,
    totais: { rendimentos: r2(totRend), gastos: r2(totGastos), resultado: r2(totRes), margemPct: totRend ? r2((totRes / totRend) * 100) : null },
    anoAnteriorMesmoPeriodo: anoAnterior,
    ivaPorTrimestre: iva,
  };

  if (regime === "TI RS" || regime === "TI CO") {
    // SS manual: introduz-se o valor mensal; o trimestre é ×3
    const ss = [settings.ss_q1, settings.ss_q2, settings.ss_q3, settings.ss_q4]
      .map((v, q) => ({ trimestre: `${q + 1}º trimestre`, valor: r2(Number(v || 0) * 3) }))
      .filter((x, q) => q < quarters && x.valor > 0);
    if (ss.length) resumo.segurancaSocialTrimestral = ss;
    if (Number(settings.outras_despesas_valor) > 0) {
      resumo.outrasDespesas = { titulo: settings.outras_despesas_label || "Outras despesas", valor: r2(Number(settings.outras_despesas_valor)) };
    }
  }
  return resumo;
}
