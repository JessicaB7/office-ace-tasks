// Parses a Portuguese "Mapa de Exploração" PDF and extracts monthly values by account code.
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

const ptNumber = (s: string): number | null => {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return null;
  // negative if has minus or parentheses
  let negative = false;
  let v = t;
  if (v.startsWith("-")) { negative = true; v = v.slice(1); }
  if (v.startsWith("(") && v.endsWith(")")) { negative = true; v = v.slice(1, -1); }
  // remove thousand separators ".", convert decimal "," to "."
  v = v.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return negative ? -n : n;
};

export interface ImportedEntry { month: number; account_code: string; value: number; }

export interface MapaParseResult { entries: ImportedEntry[]; nif: string | null; }

export interface MapaAccountInfo { code: string; section: string; }

const findNif = (text: string): string | null => {
  const labelled = text.match(/(?:NIF|N\.?\s*I\.?\s*F\.?|NIPC|Contribuinte)[^0-9]{0,15}(\d[\d\s.]{7,12}\d)/i);
  const raw = labelled?.[1] ?? text.match(/\b([125-9]\d{8})\b/)?.[1] ?? null;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
};

// Secções cujo mapa mostra valores negativos por convenção (despesas/compras/pessoal).
// Uma linha com esse código que apareça POSITIVA no PDF é uma exceção (ex.: devolução/
// correção) e deve reduzir o total, não somar — por isso invertemos o sinal em vez de
// converter para valor absoluto. Rendimentos (vendas) já vêm positivos no PDF.
const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const monthFromLabel = (s: string): number | null => {
  const i = MONTH_NAMES.indexOf(s.trim().toLowerCase());
  return i >= 0 ? i + 1 : null;
};

const SIGN_FLIPPED_SECTIONS = new Set(["despesas", "compras", "pessoal", "pessoal_socios", "pessoal_colab"]);

export async function parseMapaPdf(file: File, accountsInfo: MapaAccountInfo[]): Promise<MapaParseResult> {
  const knownCodes = new Set(accountsInfo.map((a) => a.code));
  const sectionByCode = new Map(accountsInfo.map((a) => [a.code, a.section]));
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  const entries: ImportedEntry[] = [];
  let nif: string | null = null;
  // dedupe by code+month — keep first (signed) value found per cell
  const seen = new Set<string>();

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    type Item = { str: string; x: number; y: number };
    const items: Item[] = content.items.map((it: any) => ({
      str: String(it.str || ""),
      x: it.transform[4],
      y: Math.round(it.transform[5]),
    })).filter((it: Item) => it.str.trim().length > 0);

    if (!nif) nif = findNif(items.map((it) => it.str).join(" "));

    // Group by Y row (tolerance 2px)
    const rows = new Map<number, Item[]>();
    for (const it of items) {
      let key = it.y;
      // snap to existing key within ±2
      for (const k of rows.keys()) { if (Math.abs(k - it.y) <= 2) { key = k; break; } }
      const arr = rows.get(key) || [];
      arr.push(it);
      rows.set(key, arr);
    }

    // Cabeçalho "Conta | Descrição | Janeiro | … | Total": o mapa pode ter só parte do ano
    // (ex.: Janeiro a Setembro), por isso as colunas mapeiam-se pelos nomes dos meses.
    let columns: (number | null)[] | null = null;
    for (const arr of rows.values()) {
      const labels = [...arr].sort((a, b) => a.x - b.x).map((it) => it.str.trim());
      if (labels.filter((l) => monthFromLabel(l)).length >= 1 && labels.some((l) => /^total$/i.test(l))) {
        columns = labels.filter((l) => monthFromLabel(l) || /^total$/i.test(l)).map(monthFromLabel);
        break;
      }
    }

    for (const arr of rows.values()) {
      arr.sort((a, b) => a.x - b.x);
      if (arr.length < 3) continue;
      const code = arr[0].str.trim();
      if (!knownCodes.has(code)) continue;

      // Find sequence of 12 numeric values after the description
      const nums: { v: number; x: number }[] = [];
      for (let i = 1; i < arr.length; i++) {
        const n = ptNumber(arr[i].str);
        if (n !== null) nums.push({ v: n, x: arr[i].x });
      }
      let monthly: { v: number; month: number }[];
      if (columns && nums.length === columns.length) {
        monthly = nums.flatMap((n, i) => (columns![i] ? [{ v: n.v, month: columns![i]! }] : []));
      } else {
        if (nums.length < 12) continue;
        // Sem cabeçalho: 12 meses (+ Total, que se ignora)
        monthly = nums.slice(0, 12).map((n, i) => ({ v: n.v, month: i + 1 }));
      }

      const flipSign = SIGN_FLIPPED_SECTIONS.has(sectionByCode.get(code) ?? "");
      monthly.forEach((n) => {
        const month = n.month;
        const k = `${code}-${month}`;
        if (seen.has(k)) return;
        seen.add(k);
        if (n.v !== 0) {
          // PDF stores expenses/compras/pessoal as negatives normalmente; convertemos
          // para positivo (valor normal a somar como gasto). Se a linha aparecer
          // positiva no PDF é uma exceção (devolução/correção) — nesse caso o sinal
          // invertido dá um valor negativo, que reduz o total em vez de o inflacionar.
          // Rendimentos (vendas) não sofrem esta inversão: vêm positivos no PDF.
          const value = flipSign ? -n.v : Math.abs(n.v);
          entries.push({ month, account_code: code, value });
        }
      });
    }
  }

  return { entries, nif };
}
