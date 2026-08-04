import type { FinancialAccount, FinancialEntry, FinancialSettings } from "@/hooks/useClientFinancials";

export const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function buildEntryMap(entries: FinancialEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(`${e.month}:${e.account_code}`, Number(e.value));
  return m;
}

export function getValue(map: Map<string, number>, month: number, code: string): number {
  return map.get(`${month}:${code}`) ?? 0;
}

export function sumSectionMonth(map: Map<string, number>, accounts: FinancialAccount[], section: FinancialAccount["section"], month: number): number {
  let total = 0;
  for (const a of accounts) if (a.section === section) total += getValue(map, month, a.code);
  return total;
}

export function sumAccountYear(map: Map<string, number>, code: string): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) total += getValue(map, m, code);
  return total;
}

export function sumSectionYear(map: Map<string, number>, accounts: FinancialAccount[], section: FinancialAccount["section"]): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) total += sumSectionMonth(map, accounts, section, m);
  return total;
}

// Classes SNC (primeiro dígito do código)
function classOf(code: string): string {
  if (code.length >= 2 && /^\d+$/.test(code)) {
    if (code.startsWith("31")) return "31";
    return code.substring(0, 2);
  }
  return "";
}

export function classMonthlyTotals(map: Map<string, number>, accounts: FinancialAccount[], targetClasses: string[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const cls of targetClasses) out[cls] = Array(12).fill(0);
  for (const a of accounts) {
    const cls = classOf(a.code);
    if (!out[cls]) continue;
    for (let m = 1; m <= 12; m++) out[cls][m - 1] += getValue(map, m, a.code);
  }
  return out;
}

export type MapaExploracao = {
  rendimentos: number[]; // per month
  gastos: number[]; // negative
  compras: number[]; // negative
  resultado: number[];
  resultadoAcumulado: number[];
  impostoEstimado: number[];
  ta: number[];
  rlp: number[];
  totalRendimentos: number;
  totalGastos: number;
  totalCompras: number;
  totalResultado: number;
  totalImposto: number;
  totalTA: number;
  totalRLP: number;
};

export function computeMapaExploracao(
  map: Map<string, number>,
  accounts: FinancialAccount[],
  settings: FinancialSettings
): MapaExploracao {
  const rendimentos = Array(12).fill(0);
  const gastos = Array(12).fill(0);
  const compras = Array(12).fill(0);
  const ta = Array(12).fill(0);

  for (const a of accounts) {
    const cls = classOf(a.code);
    for (let m = 1; m <= 12; m++) {
      const v = getValue(map, m, a.code);
      if (["71","72","73","74","75","76","78","79"].includes(cls)) rendimentos[m - 1] += v;
      else if (["61","62","63","64","65","67","68","69"].includes(cls)) gastos[m - 1] -= v;
      else if (cls === "31") compras[m - 1] -= v;
    }
  }
  // Tributações autónomas
  for (let m = 1; m <= 12; m++) {
    ta[m - 1] =
      getValue(map, m, "6266") * settings.ta_representacao +
      getValue(map, m, "6315") * settings.ta_kms +
      getValue(map, m, "6888") * settings.ta_nao_doc;
  }
  const resultado = rendimentos.map((r, i) => r + gastos[i] + compras[i]);
  const resultadoAcumulado: number[] = [];
  let acc = 0;
  for (const v of resultado) { acc += v; resultadoAcumulado.push(acc); }
  const impostoEstimado = resultado.map((r) => -Math.max(0, r) * settings.corporate_tax_rate);
  const rlp = resultado.map((r, i) => r + impostoEstimado[i] - ta[i]);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  return {
    rendimentos, gastos, compras, resultado, resultadoAcumulado, impostoEstimado, ta, rlp,
    totalRendimentos: sum(rendimentos),
    totalGastos: sum(gastos),
    totalCompras: sum(compras),
    totalResultado: sum(resultado),
    totalImposto: sum(impostoEstimado),
    totalTA: sum(ta),
    totalRLP: sum(rlp),
  };
}

export function fmt(n: number, opts?: { showZero?: boolean; signed?: boolean }): string {
  if (!n && !opts?.showZero) return "—";
  const v = Math.round(n * 100) / 100;
  const abs = Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v < 0) return `(${abs})`;
  return abs;
}

export function fmtEur(n: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n || 0);
}

export function fmtPct(n: number): string {
  if (!isFinite(n)) return "—";
  return (n * 100).toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

export function quarter(month: number): number {
  return Math.ceil(month / 3);
}

export function quarterSums(monthly: number[]): number[] {
  const q = [0, 0, 0, 0];
  for (let i = 0; i < 12; i++) q[Math.floor(i / 3)] += monthly[i];
  return q;
}

export const VAT_DUE_DATES = ["A pagar até 25/05", "A pagar até 25/08", "A pagar até 25/11", "A pagar até 25/02 ano seguinte"];

/** Soma um grupo de contas por prefixo (evita duplicar pai + filhos). */
export function sumGroupMonth(
  map: Map<string, number>,
  accounts: FinancialAccount[],
  prefix: string,
  month: number,
): number {
  const parent = getValue(map, month, prefix);
  if (parent !== 0) return parent;
  let total = 0;
  for (const a of accounts) {
    if (a.code !== prefix && a.code.startsWith(prefix)) total += getValue(map, month, a.code);
  }
  return total;
}
