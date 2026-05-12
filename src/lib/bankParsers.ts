// Bank statement parsers for Portuguese banks
// Output normalized transactions for TOConline import

export interface BankTransaction {
  dataMov: Date;
  dataValor: Date;
  descricao: string;
  movimento: number; // positive = entrada (crédito), negative = saída (débito)
}

export interface ParsedStatement {
  bank: string;
  transactions: BankTransaction[];
  saldoInicial?: number;
  saldoFinal?: number;
}

const BANK_KEYWORDS: Record<string, string[]> = {
  Millennium: ["millennium", "millenniumbcp", "bcp"],
  CGD: ["caixa geral de depósitos", "caixadirecta", "cgd"],
  Santander: ["santander"],
  BPI: ["banco bpi", "bpi net"],
  "Novo Banco": ["novo banco", "novobanco"],
  ActivoBank: ["activobank", "activo bank"],
};

export function detectBank(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [bank, keywords] of Object.entries(BANK_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return bank;
  }
  return null;
}

// ---------- Helpers ----------
function parseDate(s: string): Date | null {
  if (!s) return null;
  const str = s.trim();
  // dd-mm-yyyy or dd/mm/yyyy
  let m = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    return isNaN(date.getTime()) ? null : date;
  }
  // yyyy-mm-dd
  m = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function parseAmountPT(s: string): number | null {
  if (!s) return null;
  let str = s.replace(/\s|€|EUR/gi, "").trim();
  if (!str) return null;
  // Handle trailing minus or parentheses
  let negative = false;
  if (str.endsWith("-") || str.startsWith("-")) {
    negative = true;
    str = str.replace(/-/g, "");
  }
  if (str.startsWith("(") && str.endsWith(")")) {
    negative = true;
    str = str.slice(1, -1);
  }
  // PT format: 1.234,56  -> remove thousand sep dots, replace decimal comma
  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(str);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

// ---------- PDF text extraction ----------
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  // Use bundled worker
  // @ts-ignore
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group items by approximate Y position to reconstruct lines
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: item.transform[4], str: item.str });
    }
    const sortedY = [...rows.keys()].sort((a, b) => b - a);
    for (const y of sortedY) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      const line = row.map((r) => r.str).join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
    }
  }
  return lines.join("\n");
}

// ---------- Generic line-based parser ----------
// Tries to detect rows of: <date> <date?> <description...> <amount> [<balance>]
function parseTextGeneric(text: string): BankTransaction[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const txs: BankTransaction[] = [];
  // Regex: starts with date, may have a 2nd date, then description, then amount(s) at the end
  const reLine =
    /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(?:(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+)?(.+?)\s+(-?\(?\d{1,3}(?:[.\s]\d{3})*,\d{2}\)?-?)(?:\s+-?\(?\d{1,3}(?:[.\s]\d{3})*,\d{2}\)?-?)?\s*$/;
  for (const line of lines) {
    const m = line.match(reLine);
    if (!m) continue;
    const d1 = parseDate(m[1]);
    const d2 = m[2] ? parseDate(m[2]) : d1;
    const desc = m[3].trim();
    const amount = parseAmountPT(m[4]);
    if (!d1 || !d2 || amount === null) continue;
    txs.push({ dataMov: d1, dataValor: d2, descricao: desc, movimento: amount });
  }
  return txs;
}

// Try to find balances from text (Saldo Inicial / Final / Anterior)
function findBalances(text: string): { saldoInicial?: number; saldoFinal?: number } {
  const out: { saldoInicial?: number; saldoFinal?: number } = {};
  const reAmount = /(-?\(?\d{1,3}(?:[.\s]\d{3})*,\d{2}\)?-?)/;
  const initial = text.match(new RegExp(`(?:saldo\\s+(?:inicial|anterior))[^\\n]*?${reAmount.source}`, "i"));
  if (initial) {
    const v = parseAmountPT(initial[1]);
    if (v !== null) out.saldoInicial = v;
  }
  const final = text.match(new RegExp(`(?:saldo\\s+(?:final|atual|actual|contabil[ií]stico|disponiv[eé]l))[^\\n]*?${reAmount.source}`, "i"));
  if (final) {
    const v = parseAmountPT(final[1]);
    if (v !== null) out.saldoFinal = v;
  }
  return out;
}

export function parseBankText(text: string, bankHint?: string | null): ParsedStatement {
  const bank = bankHint || detectBank(text) || "Genérico";
  const transactions = parseTextGeneric(text);
  const balances = findBalances(text);
  return { bank, transactions, ...balances };
}

// ---------- CSV / Excel parser ----------
export async function parseSpreadsheet(file: File): Promise<ParsedStatement> {
  const ExcelJS = (await import("exceljs")).default;
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();

  const isCsv = file.name.toLowerCase().endsWith(".csv");
  if (isCsv) {
    const text = new TextDecoder("utf-8").decode(buf);
    return parseCsvText(text);
  }
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return { bank: "Genérico", transactions: [] };

  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value as any;
      if (v == null) arr.push("");
      else if (v instanceof Date) arr.push(v.toISOString().slice(0, 10));
      else if (typeof v === "object" && "richText" in v) arr.push(v.richText.map((t: any) => t.text).join(""));
      else if (typeof v === "object" && "text" in v) arr.push(String(v.text));
      else arr.push(String(v));
    });
    rows.push(arr);
  });

  return parseTabularRows(rows, file.name);
}

function parseCsvText(text: string): ParsedStatement {
  // Detect delimiter
  const sample = text.split(/\r?\n/).slice(0, 5).join("\n");
  const delim = (sample.match(/;/g)?.length || 0) > (sample.match(/,/g)?.length || 0) ? ";" : ",";
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => parseCsvLine(l, delim));
  return parseTabularRows(rows, "csv");
}

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === delim) { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseTabularRows(rows: string[][], filename: string): ParsedStatement {
  const allText = rows.map((r) => r.join(" ")).join("\n");
  const bank = detectBank(allText) || "Genérico";
  const balances = findBalances(allText);

  // Find header row: contains "data" and ("descrição" or "descricao") and amount-related
  let headerIdx = -1;
  let cols = { dataMov: -1, dataValor: -1, descricao: -1, debito: -1, credito: -1, montante: -1 };
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i].map((c) => c.toString().toLowerCase().trim());
    const find = (preds: ((s: string) => boolean)[]) => r.findIndex((c) => preds.some((p) => p(c)));
    const dm = find([(s) => /data\s*(mov|oper|lan)/.test(s) || s === "data"]);
    const dv = find([(s) => /data\s*valor/.test(s)]);
    const desc = find([(s) => /descri/.test(s) || /movimento/.test(s) || /hist[oó]rico/.test(s)]);
    const deb = find([(s) => /^d[ée]bito$/.test(s) || s === "debito"]);
    const cre = find([(s) => /^cr[eé]dito$/.test(s) || s === "credito"]);
    const mont = find([(s) => /^valor$|^montante$|^importan/.test(s)]);
    if (dm >= 0 && desc >= 0 && (deb >= 0 || cre >= 0 || mont >= 0)) {
      headerIdx = i;
      cols = { dataMov: dm, dataValor: dv, descricao: desc, debito: deb, credito: cre, montante: mont };
      break;
    }
  }

  const txs: BankTransaction[] = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const dm = parseDate(r[cols.dataMov] || "");
      if (!dm) continue;
      const dv = cols.dataValor >= 0 ? parseDate(r[cols.dataValor] || "") || dm : dm;
      const desc = (r[cols.descricao] || "").trim();
      let amount: number | null = null;
      if (cols.montante >= 0) {
        amount = parseAmountPT(r[cols.montante] || "");
      } else {
        const d = cols.debito >= 0 ? parseAmountPT(r[cols.debito] || "") : null;
        const c = cols.credito >= 0 ? parseAmountPT(r[cols.credito] || "") : null;
        if (c && c !== 0) amount = Math.abs(c);
        else if (d && d !== 0) amount = -Math.abs(d);
      }
      if (amount === null || !desc) continue;
      txs.push({ dataMov: dm, dataValor: dv, descricao: desc, movimento: amount });
    }
  } else {
    // Fallback: try generic regex on the joined text
    const fromText = parseTextGeneric(allText);
    txs.push(...fromText);
  }

  return { bank, transactions: txs, ...balances };
}

// ---------- Build TOConline xlsx ----------
import templateUrl from "@/assets/toconline-template.xlsx?url";

export async function buildToconlineXlsx(parsed: ParsedStatement, opts: {
  saldoInicial: number;
  saldoFinal: number;
}): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const res = await fetch(templateUrl);
  const buf = await res.arrayBuffer();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];

  // Saldo Inicial: row 3, col D (4)
  ws.getCell(3, 4).value = opts.saldoInicial;
  // Saldo Final: row 5, col D (4)
  ws.getCell(5, 4).value = opts.saldoFinal;

  // Movements start at row 8 (header at row 7)
  // Sort transactions by date ascending
  const sorted = [...parsed.transactions].sort((a, b) => a.dataMov.getTime() - b.dataMov.getTime());

  // Clear any existing example rows beyond header (rows 8-9 in template)
  // We'll overwrite from row 8 onwards
  let r = 8;
  for (const t of sorted) {
    const row = ws.getRow(r);
    row.getCell(1).value = t.dataMov;
    row.getCell(1).numFmt = "yyyy-mm-dd";
    row.getCell(2).value = t.dataValor;
    row.getCell(2).numFmt = "yyyy-mm-dd";
    row.getCell(3).value = t.descricao;
    row.getCell(4).value = t.movimento;
    row.getCell(4).numFmt = "0.00";
    r++;
  }
  // If template had example rows beyond what we wrote, blank them
  while (r <= 9) {
    const row = ws.getRow(r);
    row.getCell(1).value = null;
    row.getCell(2).value = null;
    row.getCell(3).value = null;
    row.getCell(4).value = null;
    r++;
  }

  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
