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
export async function extractPdfText(file: File, password?: string): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  // Use bundled worker
  // @ts-ignore
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf, password: password || undefined }).promise;
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

// ---------- Millennium BCP parser ----------
// Format: "M.DD M.DDDESCRITIVO ... AMOUNT BALANCE"
// Numbers use SPACE as thousand sep and DOT as decimal (e.g. "10 373.06")
// Description may contain integer references (e.g. "MOV N 16") that confuse naive parsing,
// so we determine the amount via balance delta when available.
function parseMillennium(text: string): ParsedStatement {
  const lines = text.split(/\n/).map((l) => l.trim());
  const txs: BankTransaction[] = [];

  let year = new Date().getFullYear();
  const yMatch = text.match(/EXTRATO\s+DE\s+(\d{4})\/(\d{1,2})\/\d{1,2}/i);
  if (yMatch) year = parseInt(yMatch[1]);

  let saldoInicial: number | undefined;
  // Try several patterns: "SALDO INICIAL 10 373.06", "SALDO ANTERIOR ...", with possible newlines/extra whitespace
  const parseAmt = (raw: string): number => {
    let s = raw.replace(/\s/g, "");
    // If contains both '.' and ',' → '.' is thousand sep, ',' is decimal
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",")) s = s.replace(",", ".");
    return parseFloat(s);
  };
  const sIniPatterns = [
    /SALDO\s+INICIAL[^\d\-]*(-?\d{1,3}(?:[\s.]\d{3})*[.,]\d{2})/i,
    /SALDO\s+ANTERIOR[^\d\-]*(-?\d{1,3}(?:[\s.]\d{3})*[.,]\d{2})/i,
    // Number BEFORE the label (some PDFs render saldo column first)
    /(-?\d{1,3}(?:[\s.]\d{3})*[.,]\d{2})\s*\n?\s*SALDO\s+INICIAL/i,
    /(-?\d{1,3}(?:[\s.]\d{3})*[.,]\d{2})\s*\n?\s*SALDO\s+ANTERIOR/i,
  ];
  for (const re of sIniPatterns) {
    const m = text.match(re);
    if (m) {
      saldoInicial = parseAmt(m[1]);
      break;
    }
  }

  let prevBalance = saldoInicial;

  // Decimal number with optional space-thousand-sep
  const reNum = /(?:\d{1,3}(?:\s\d{3})+|\d+)\.\d{2}/g;
  const reLine = /^(\d{1,2})\.(\d{1,2})\s+(\d{1,2})\.(\d{1,2})(.+)$/;
  const isNoise = (s: string) => /^(A\s+TRANSPORTAR|TRANSPORTE|SALDO\s+(INICIAL|FINAL))/i.test(s);

  const fmtAmt = (n: number) => {
    const s = n.toFixed(2);
    if (n < 1000) return [s];
    // With thousand-sep using space
    const [int, dec] = s.split(".");
    const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return [s, `${withSep}.${dec}`];
  };

  // Reject only standalone header/meta lines, not real descriptions that happen to start with these words
  const isHeaderOrMeta = (s: string) => {
    if (/^(DATA\s+(LANC|VALOR)|DESCRITIVO|D[EÉ]BITO\s*$|CR[EÉ]DITO\s*$|SALDO\s*$|TRANSPORTE\s*$|A\s+TRANSPORTAR|SUCURSAL|EXTRATO\b|MOEDA\b|RESUMO|MENSAGEM\b|NIB\b|IBAN\b|BIC|Banco\s+Comercial|Capital\s+Social|Nos\s+termos|Poder|www\.|\(\+|^\d{2}\/\d{2}\/\d{2,4})/i.test(s)) return true;
    // Pure header tokens or page markers
    if (/^(DATA|VALOR|LANC\.?|DEBITO|CREDITO|SALDO|PAG|CONTA|N\.)\s*$/i.test(s)) return true;
    if (/^\d{2}\/\d{2}\/\d{2}\s/.test(s)) return true;
    return false;
  };

  let pendingDesc = "";
  for (const line of lines) {
    if (!line || isNoise(line)) { pendingDesc = ""; continue; }
    const m = line.match(reLine);
    if (!m) {
      // Buffer as potential description for next tx line
      if (!isHeaderOrMeta(line) && !/^\d/.test(line) && line.length >= 3 && line.length < 120) {
        pendingDesc = line.replace(/\s+/g, " ").trim();
      }
      continue;
    }

    const movM = parseInt(m[1]);
    const movD = parseInt(m[2]);
    const valM = parseInt(m[3]);
    const valD = parseInt(m[4]);
    const rest = m[5];

    const nums: { value: number; index: number; raw: string }[] = [];
    let nm: RegExpExecArray | null;
    while ((nm = reNum.exec(rest)) !== null) {
      nums.push({ value: parseFloat(nm[0].replace(/\s/g, "")), index: nm.index, raw: nm[0] });
    }
    reNum.lastIndex = 0;
    if (nums.length < 1) continue;

    // Last decimal number is the running balance
    const balance = nums[nums.length - 1].value;

    let signed: number;
    let descricaoEnd: number;

    if (prevBalance !== undefined) {
      // Amount derived from balance delta — most reliable for Millennium
      const delta = +(balance - prevBalance).toFixed(2);
      signed = delta;
      const absAmt = Math.abs(delta);
      const candidates = fmtAmt(absAmt);
      // Find last occurrence (before the balance) of one of the candidate strings
      let foundIdx = -1;
      const searchEnd = nums[nums.length - 1].index;
      for (const cand of candidates) {
        const idx = rest.lastIndexOf(cand, searchEnd - 1);
        if (idx > foundIdx) foundIdx = idx;
      }
      descricaoEnd = foundIdx > 0 ? foundIdx : (nums.length >= 2 ? nums[nums.length - 2].index : searchEnd);
    } else {
      // Fallback: assume penultimate decimal number is the amount
      if (nums.length < 2) continue;
      const amt = nums[nums.length - 2].value;
      signed = /^(CR[EÉ]DITO|TRF\s+DE|TRF\.?\s*P\/O|OPDE\s+DEVOL)/i.test(rest) ? amt : -amt;
      descricaoEnd = nums[nums.length - 2].index;
    }

    let descricao = rest.slice(0, descricaoEnd).trim().replace(/\s+/g, " ");
    if (!descricao || descricao.length < 3) {
      descricao = pendingDesc || (signed >= 0 ? "Crédito" : "Débito");
    }
    pendingDesc = "";
    prevBalance = balance;

    // Per user requirement: both dates = data lançamento (first column)
    const dataLanc = new Date(year, movM - 1, movD);
    txs.push({
      dataMov: dataLanc,
      dataValor: dataLanc,
      descricao,
      movimento: signed,
    });
  }

  let saldoFinal: number | undefined;
  const sFinPatterns = [
    /SALDO\s+FINAL[^\d\-]*(-?\d{1,3}(?:[\s.]\d{3})*[.,]\d{2})/i,
    /SALDO\s+(?:ATUAL|ACTUAL|CONTABIL[IÍ]STICO|DISPON[IÍ]VEL)[^\d\-]*(-?\d{1,3}(?:[\s.]\d{3})*[.,]\d{2})/i,
    /(-?\d{1,3}(?:[\s.]\d{3})*[.,]\d{2})\s*\n?\s*SALDO\s+FINAL/i,
  ];
  for (const re of sFinPatterns) {
    const m = text.match(re);
    if (m) {
      saldoFinal = parseAmt(m[1]);
      break;
    }
  }
  if (saldoFinal === undefined && prevBalance !== undefined && prevBalance !== saldoInicial) {
    saldoFinal = prevBalance;
  }

  // Derive missing saldo from the other + sum of movements
  const sumMovs = +txs.reduce((s, t) => s + t.movimento, 0).toFixed(2);
  if (saldoInicial === undefined && saldoFinal !== undefined && txs.length > 0) {
    saldoInicial = +(saldoFinal - sumMovs).toFixed(2);
  }
  if (saldoFinal === undefined && saldoInicial !== undefined && txs.length > 0) {
    saldoFinal = +(saldoInicial + sumMovs).toFixed(2);
  }

  return { bank: "Millennium", transactions: txs, saldoInicial, saldoFinal };
}

export function parseBankText(text: string, bankHint?: string | null): ParsedStatement {
  const bank = bankHint || detectBank(text) || "Genérico";
  if (bank === "Millennium") return parseMillennium(text);
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
import toconlineTemplateUrl from "@/assets/toconline-template.xlsx?url";

export async function buildToconlineXlsx(parsed: ParsedStatement, opts: {
  saldoInicial: number;
  saldoFinal: number;
}): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  // Carregar o template oficial do TOConline para preservar exatamente
  // a estrutura, formatação e fórmula de validação.
  const res = await fetch(toconlineTemplateUrl);
  if (!res.ok) throw new Error("Não foi possível carregar o modelo TOConline");
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) throw new Error("Modelo TOConline está vazio");
  await wb.xlsx.load(buf);

  const ws = wb.worksheets[0];

  // Preencher saldos (D3 e D5)
  ws.getCell("D3").value = opts.saldoInicial;
  ws.getCell("D5").value = opts.saldoFinal;

  // Limpar quaisquer movimentos de exemplo existentes (a partir da linha 8)
  const lastRow = ws.actualRowCount;
  for (let r = 8; r <= Math.max(lastRow, 9); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 4; c++) row.getCell(c).value = null;
  }

  // Inserir movimentos ordenados por data
  const sorted = [...parsed.transactions].sort(
    (a, b) => a.dataMov.getTime() - b.dataMov.getTime(),
  );

  let r = 8;
  for (const t of sorted) {
    const row = ws.getRow(r);
    // Usar sempre a data de lançamento em ambas as colunas
    row.getCell(1).value = t.dataMov;
    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(2).value = t.dataMov;
    row.getCell(2).numFmt = "dd/mm/yyyy";
    // Garantir que a descrição nunca fica vazia
    const desc = (t.descricao || "").trim();
    row.getCell(3).value = desc || (t.movimento >= 0 ? "Entrada" : "Saída");
    row.getCell(4).value = t.movimento;
    row.getCell(4).numFmt = "0.00";
    r++;
  }

  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
