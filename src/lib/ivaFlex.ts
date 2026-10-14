// IVA trimestral com flexibilização: o IVA do trimestre paga-se em parcelas, cada uma até dia 25.
// 3 parcelas, exceto no 3º trimestre, que tem só 2. O plano vive no mês de fim de trimestre
// (registo "IVA" com extra_done = Flexibilização; parcelas pagas em IVA_flex_P1..P3).

/** Data limite de cada parcela (dia 25), por trimestre (0 = 1º): [mês 0-11, anos a somar]. */
const PARCELA_PRAZOS: Record<number, [number, number][]> = {
  0: [[4, 0], [5, 0], [6, 0]],    // 1º trimestre: 25/05, 25/06, 25/07
  1: [[8, 0], [9, 0], [10, 0]],   // 2º trimestre: 25/09, 25/10, 25/11
  2: [[10, 0], [11, 0]],          // 3º trimestre: 25/11, 25/12
  3: [[1, 1], [2, 1], [3, 1]],    // 4º trimestre: 25/02, 25/03, 25/04 do ano seguinte
};

/** Parcelas do trimestre a que pertence o mês (0-11). */
export const parcelasDoTrimestre = (month0: number) => (Math.floor(month0 / 3) === 2 ? [1, 2] : [1, 2, 3]);

/** Data limite "25/MM/AAAA" da parcela p do trimestre do mês (0-11), ou null se não estiver definida. */
export const parcelaPrazo = (month0: number, year: number, p: number) => {
  const d = PARCELA_PRAZOS[Math.floor(month0 / 3)]?.[p - 1];
  return d ? `25/${String(d[0] + 1).padStart(2, "0")}/${year + d[1]}` : null;
};

const QUARTER_LABELS = ["1º trim.", "2º trim.", "3º trim.", "4º trim."];

export interface ParcelaDevida {
  /** Mês de fim do trimestre (YYYY-MM-01) — onde vive o plano e o método de pagamento. */
  quarterEndMonth: string;
  parcela: number;
  totalParcelas: number;
  /** Ex.: "Parcela 2/3 do 2º trim. 2026 (até 25/10/2026)". */
  label: string;
}

/** Parcelas (de qualquer trimestre) cuja data limite cai no mês indicado (0-11). */
export function parcelasDevidasEm(year: number, month0: number): ParcelaDevida[] {
  const out: ParcelaDevida[] = [];
  for (const [qStr, prazos] of Object.entries(PARCELA_PRAZOS)) {
    const q = Number(qStr);
    prazos.forEach(([m, addYears], i) => {
      if (m !== month0) return;
      const qYear = year - addYears;
      const qEnd = q * 3 + 2;
      out.push({
        quarterEndMonth: `${qYear}-${String(qEnd + 1).padStart(2, "0")}-01`,
        parcela: i + 1,
        totalParcelas: prazos.length,
        label: `Parcela ${i + 1}/${prazos.length} do ${QUARTER_LABELS[q]} ${qYear} (até 25/${String(m + 1).padStart(2, "0")}/${year})`,
      });
    });
  }
  return out;
}

export type MetodoPagamentoIva = "Referência" | "Débito direto";
export const METODOS_PAGAMENTO_IVA: MetodoPagamentoIva[] = ["Referência", "Débito direto"];

/** Lê o método escrito à mão na coluna "Método de Pagamento" (ex.: "referencia", "debito direto"). */
export function metodoPagamentoIva(notes: string | null | undefined): MetodoPagamentoIva | null {
  const s = (notes || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\bref/.test(s)) return "Referência";
  if (/\bdeb/.test(s)) return "Débito direto";
  return null;
}
