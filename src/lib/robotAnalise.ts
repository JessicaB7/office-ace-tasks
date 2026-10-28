/** Robot da análise financeira: junta os números que a app mostra num resumo compacto para a
 * função `robot-analise` escrever o texto a enviar ao cliente. Os totais e os impostos vêm do
 * dashboard do regime (os mesmos valores que estão no ecrã); a evolução vem do Mapa de Exploração.
 * Cálculo puro, sem side effects. */
import type { FinancialAccount, FinancialEntry, FinancialSettings } from "@/hooks/useClientFinancials";
import { buildEntryMap, computeMapaExploracao, MONTHS_FULL } from "@/components/financial/financialMath";

const r2 = (n: number) => Math.round(n * 100) / 100 || 0; // sem -0
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

/** Um imposto tal como o dashboard o mostra: linhas do cálculo e, se houver, valor por trimestre. */
export interface RobotImposto {
  imposto: string;
  linhas: { descricao: string; valor: number }[];
  /** Valores dos 4 trimestres (o resumo corta aos trimestres com dados). */
  porTrimestre?: number[];
  nota?: string;
}

/** O que cada dashboard passa ao robot. */
export interface RobotDashboard {
  faturacao: number;
  resultado: number;
  /** Despesas a mostrar; por defeito faturação − resultado. */
  despesas?: number;
  impostos: RobotImposto[];
}

export interface RobotResumo {
  regime: string;
  ano: number;
  periodo: string;
  ultimoMes: number;
  geral: { faturacao: number; despesas: number; resultado: number; margemPct: number | null };
  evolucaoPorTrimestre: { trimestre: string; faturacao: number; despesas: number }[];
  faturacaoPorMes: { mes: string; faturacao: number }[];
  impostos: { imposto: string; linhas: { descricao: string; valor: number }[]; porTrimestre?: { trimestre: string; valor: number }[]; nota?: string }[];
  /** Faturação do ano anterior (se houver dados na app): no ano todo e no mesmo período. */
  anoAnterior?: { ano: number; faturacaoAnual: number; faturacaoMesmoPeriodo: number };
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
  dashboard: RobotDashboard;
  /** Lançamentos do ano anterior, para comparar a faturação (opcional). */
  entriesAnoAnterior?: FinancialEntry[];
}): RobotResumo {
  const { regime, year, accounts, entries, settings, dashboard, entriesAnoAnterior } = args;
  const mapa = computeMapaExploracao(buildEntryMap(entries), accounts, settings);
  // gastos/compras vêm negativos no mapa — no resumo vão positivos
  const gastos = mapa.gastos.map((g, i) => -(g + mapa.compras[i]));
  const last = lastMonthWithData(mapa.rendimentos, gastos);
  const quarters = Math.ceil(last / 3);

  const evolucaoPorTrimestre = Array.from({ length: quarters }, (_, q) => {
    const idx = [q * 3, q * 3 + 1, q * 3 + 2].filter((i) => i < last);
    return {
      trimestre: `${q + 1}º trimestre`,
      faturacao: r2(sum(idx.map((i) => mapa.rendimentos[i]))),
      despesas: r2(sum(idx.map((i) => gastos[i]))),
    };
  });

  const faturacao = r2(dashboard.faturacao);
  const resultado = r2(dashboard.resultado);

  const rendAnterior = entriesAnoAnterior?.length
    ? computeMapaExploracao(buildEntryMap(entriesAnoAnterior), accounts, settings).rendimentos
    : null;
  const anoAnterior = rendAnterior && sum(rendAnterior) !== 0
    ? { ano: year - 1, faturacaoAnual: r2(sum(rendAnterior)), faturacaoMesmoPeriodo: r2(sum(rendAnterior.slice(0, last))) }
    : undefined;

  return {
    regime,
    ano: year,
    periodo: last > 0 ? `janeiro a ${MONTHS_FULL[last - 1].toLowerCase()} de ${year}` : `${year} (sem dados)`,
    ultimoMes: last,
    geral: {
      faturacao,
      despesas: r2(dashboard.despesas ?? faturacao - resultado),
      resultado,
      margemPct: faturacao ? r2((resultado / faturacao) * 100) : null,
    },
    evolucaoPorTrimestre,
    faturacaoPorMes: Array.from({ length: last }, (_, i) => ({ mes: MONTHS_FULL[i], faturacao: r2(mapa.rendimentos[i]) })),
    impostos: dashboard.impostos.map((imp) => ({
      imposto: imp.imposto,
      linhas: imp.linhas.map((l) => ({ descricao: l.descricao, valor: r2(l.valor) })),
      ...(imp.porTrimestre
        ? { porTrimestre: imp.porTrimestre.slice(0, quarters).map((v, q) => ({ trimestre: `${q + 1}º trimestre`, valor: r2(v) })) }
        : {}),
      ...(imp.nota ? { nota: imp.nota } : {}),
    })),
    ...(anoAnterior ? { anoAnterior } : {}),
  };
}
