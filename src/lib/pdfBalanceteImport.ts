// Parses a TOConline "Balancete (Período, Acumulado)" PDF and aggregates
// accumulated values by account code, distributing them equally across the
// months covered by the report header.
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

export interface BalanceteEntry { month: number; account_code: string; value: number; }
export interface BalanceteResult { entries: BalanceteEntry[]; startMonth: number; endMonth: number; year: number; }

const MONTHS_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, "março": 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const ptNumber = (s: string): number | null => {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return null;
  let negative = false;
  let v = t;
  if (v.startsWith("-")) { negative = true; v = v.slice(1); }
  if (v.startsWith("(") && v.endsWith(")")) { negative = true; v = v.slice(1, -1); }
  v = v.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return negative ? -n : n;
};

export async function parseBalancetePdf(file: File, catalogCodes: string[]): Promise<BalanceteResult> {
  const buf = await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;

  // Sort catalog from longest to shortest so we match the deepest prefix first.
  const sortedCodes = [...catalogCodes].sort((a, b) => b.length - a.length);

  let startMonth = 1, endMonth = 12, year = new Date().getFullYear();
  let foundHeader = false;

  // Accumulate net per leaf account code (one row per account aggregated across the period).
  const acumDeb = new Map<string, number>();
  const acumCred = new Map<string, number>();
  const seenCodes = new Set<string>();

  // Column x-centers, learnt from first page's header row.
  // Order: perDeb, perCred, acumDeb, acumCred, saldoDev, saldoCred
  let colXs: number[] | null = null;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    type Item = { str: string; x: number; y: number };
    const items: Item[] = content.items
      .map((it: any) => ({ str: String(it.str || ""), x: it.transform[4], y: Math.round(it.transform[5]) }))
      .filter((it: Item) => it.str.trim().length > 0);

    if (!foundHeader) {
      const fullText = items.map((i) => i.str).join(" ");
      const m = fullText.match(/Exerc[íi]cio de (\d{4}),\s*([a-zç]+)\s*\(\d{4}\)\s*a\s*([a-zç]+)\s*\(\d{4}\)/i);
      if (m) {
        year = parseInt(m[1], 10);
        const s = MONTHS_PT[m[2].toLowerCase()];
        const e = MONTHS_PT[m[3].toLowerCase()];
        if (s) startMonth = s;
        if (e) endMonth = e;
        foundHeader = true;
      }
    }

    // Group items into rows by Y (tolerance ±2)
    const rows = new Map<number, Item[]>();
    for (const it of items) {
      let key = it.y;
      for (const k of rows.keys()) { if (Math.abs(k - it.y) <= 2) { key = k; break; } }
      const arr = rows.get(key) || [];
      arr.push(it);
      rows.set(key, arr);
    }

    // On first page locate column x positions using the header "Débito"/"Crédito" repeated 3 times.
    if (!colXs) {
      for (const arr of rows.values()) {
        const dcs = arr
          .filter((i) => /^(D[ée]bito|Cr[ée]dito)$/i.test(i.str.trim()))
          .sort((a, b) => a.x - b.x);
        if (dcs.length >= 4) {
          colXs = dcs.slice(0, 6).map((i) => i.x);
          // pad to 6 if needed
          while (colXs.length < 6) colXs.push(colXs[colXs.length - 1] + 60);
          break;
        }
      }
    }

    for (const arr of rows.values()) {
      arr.sort((a, b) => a.x - b.x);
      if (arr.length < 2) continue;
      const first = arr[0].str.trim();
      if (!/^\d{1,12}$/.test(first)) continue; // must start with an account code

      const code = first;
      seenCodes.add(code);

      // collect numeric items with x
      const nums: { v: number; x: number }[] = [];
      for (let i = 1; i < arr.length; i++) {
        const n = ptNumber(arr[i].str);
        if (n !== null) nums.push({ v: n, x: arr[i].x });
      }
      if (nums.length === 0) continue;

      // Assign each number to the nearest column.
      const cols = colXs ?? [0, 0, 0, 0, 0, 0];
      const valByCol: (number | null)[] = [null, null, null, null, null, null];
      for (const n of nums) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let c = 0; c < cols.length; c++) {
          const d = Math.abs(n.x - cols[c]);
          if (d < bestDist) { bestDist = d; bestIdx = c; }
        }
        // Only accept if reasonably close (within 80px) when we have column hints
        if (colXs && bestDist > 80) continue;
        valByCol[bestIdx] = n.v;
      }

      const accDeb = valByCol[2] ?? 0;
      const accCred = valByCol[3] ?? 0;
      if (accDeb === 0 && accCred === 0) continue;

      acumDeb.set(code, (acumDeb.get(code) || 0) + accDeb);
      acumCred.set(code, (acumCred.get(code) || 0) + accCred);
    }
  }

  // Keep only leaf codes: a code is a leaf if no longer code in seenCodes starts with it.
  const seenArr = Array.from(seenCodes);
  const isLeaf = (code: string) =>
    !seenArr.some((other) => other.length > code.length && other.startsWith(code));

  // Aggregate net per catalog code
  const catalogAgg = new Map<string, number>();
  for (const code of seenArr) {
    if (!isLeaf(code)) continue;
    // find longest-prefix catalog code
    const match = sortedCodes.find((c) => code.startsWith(c));
    if (!match) continue;
    const net = Math.abs((acumDeb.get(code) || 0) - (acumCred.get(code) || 0));
    if (net === 0) continue;
    catalogAgg.set(match, (catalogAgg.get(match) || 0) + net);
  }

  // Distribute equally across the period months
  const span = Math.max(1, endMonth - startMonth + 1);
  const entries: BalanceteEntry[] = [];
  for (const [code, total] of catalogAgg.entries()) {
    const per = Math.round((total / span) * 100) / 100;
    for (let m = startMonth; m <= endMonth; m++) {
      entries.push({ month: m, account_code: code, value: per });
    }
  }

  return { entries, startMonth, endMonth, year };
}

export async function isBalancetePdf(file: File): Promise<boolean> {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await (pdfjsLib as any).getDocument({ data: buf.slice(0) }).promise;
    const page = await pdf.getPage(1);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => String(it.str || "")).join(" ");
    return /Balancete\s*\(Per[íi]odo/i.test(text);
  } catch {
    return false;
  }
}
