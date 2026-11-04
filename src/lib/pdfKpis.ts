/** Rubricas que só aparecem no PDF dos mapas de análise quando têm valor. */
export const RUBRICAS_OPCIONAIS_PDF = ["Gastos com mercadorias", "Depreciações"];

const temValor = (v: number | number[]) =>
  (Array.isArray(v) ? v : [v]).some((x) => Math.abs(x || 0) > 0.005);

/** No PDF (exporting = true) retira "Gastos com mercadorias" e "Depreciações" quando estão a zero. */
export const filtrarRubricasPdf = <T extends { label: string }>(
  itens: T[],
  exporting: boolean,
  valor: (item: T) => number | number[],
): T[] =>
  exporting ? itens.filter((k) => !RUBRICAS_OPCIONAIS_PDF.includes(k.label) || temValor(valor(k))) : itens;

/** Colunas da grelha de KPIs no PDF, para os cartões ocuparem a largura toda. */
export const colunasPdf = (exporting: boolean, n: number) =>
  exporting ? { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` } : undefined;
