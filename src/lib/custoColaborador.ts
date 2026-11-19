// Custo e lucro por colaborador (Colaboradores, admin) — regras puras, sem efeitos laterais.
// Custo mensal para a empresa = salário bruto × 14 ÷ 12 (subsídios de férias e de Natal) × (1 + TSU 23,75%)
// + subsídio de alimentação mensal. Lucro = avenças geridas no mês (carteira.ts) − custo mensal.

export const TSU_EMPREGADOR = 0.2375;

export interface CustoColaboradorInput {
  salario_bruto?: number | string | null;
  subsidio_alimentacao?: number | string | null;
}

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) && x > 0 ? x : 0;
};

/** Custo mensal médio (14 meses repartidos por 12, com a TSU da entidade patronal). */
export function custoMensal(c: CustoColaboradorInput | null | undefined): number {
  const bruto = n(c?.salario_bruto);
  return (bruto * 14) / 12 * (1 + TSU_EMPREGADOR) + n(c?.subsidio_alimentacao);
}

export interface LucroColaborador {
  key: string;
  clientes: number;
  avencas: number;
  custo: number;
  /** Sem salário registado (custo 0). */
  semCusto: boolean;
  lucro: number;
  /** Lucro ÷ avenças (null sem avenças). */
  margem: number | null;
}

/**
 * Junta as avenças por responsável (`avencasPorColaborador`) com o custo de cada colaborador.
 * Inclui colaboradores com custo mas sem clientes (lucro negativo). «none» = clientes sem responsável (sem custo).
 */
export function lucroPorColaborador(
  avencas: { key: string; clientes: unknown[]; valor: number }[],
  custos: Map<string, CustoColaboradorInput>,
  colaboradoresAtivos: string[] = [],
): LucroColaborador[] {
  const chaves = new Set<string>([...avencas.map((a) => a.key), ...colaboradoresAtivos]);
  return [...chaves]
    .map((key) => {
      const a = avencas.find((x) => x.key === key);
      const valor = a?.valor ?? 0;
      const custo = key === "none" ? 0 : custoMensal(custos.get(key));
      const lucro = valor - custo;
      return { key, clientes: a?.clientes.length ?? 0, avencas: valor, custo, semCusto: custo === 0, lucro, margem: valor > 0 ? lucro / valor : null };
    })
    .sort((x, y) => y.lucro - x.lucro);
}

export function totalLucro(linhas: LucroColaborador[]) {
  const avencas = linhas.reduce((s, l) => s + l.avencas, 0);
  const custo = linhas.reduce((s, l) => s + l.custo, 0);
  return { clientes: linhas.reduce((s, l) => s + l.clientes, 0), avencas, custo, lucro: avencas - custo, margem: avencas > 0 ? (avencas - custo) / avencas : null };
}
