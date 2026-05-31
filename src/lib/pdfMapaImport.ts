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

export async function parseMapaPdf(file: File, knownCodes: Set<string>): Promise<ImportedEntry[]> {
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  const entries: ImportedEntry[] = [];
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
      if (nums.length < 12) continue;
      // Take first 12 numbers (last one would be Total which we drop)
      // Some rows have exactly 13 (12 months + total). Drop the last only if length >= 13.
      const monthly = nums.length >= 13 ? nums.slice(0, 12) : nums.slice(0, 12);

      monthly.forEach((n, idx) => {
        const month = idx + 1;
        const k = `${code}-${month}`;
        if (seen.has(k)) return;
        seen.add(k);
        if (n.v !== 0) {
          // PDF stores expenses as negatives; convert to absolute positive
          // because our model stores expenses with sign=1 and aggregates as expense.
          entries.push({ month, account_code: code, value: Math.abs(n.v) });
        }
      });
    }
  }

  return entries;
}
