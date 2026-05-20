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
  Revolut: ["revolut", "revolut bank", "revolt21"],
  CGD: ["caixa geral de depósitos", "caixadirecta", "cgd"],
  Santander: ["santander", "totaptpl"],
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
  const dateOnly = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) return null;
    return date;
  };
  // dd-mm-yyyy or dd/mm/yyyy
  let m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const [, d, mo, rawYear] = m;
    let y = rawYear;
    if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y;
    return dateOnly(Number(y), Number(mo), Number(d));
  }
  // yyyy-mm-dd
  m = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (m) {
    return dateOnly(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  return null;
}

function makeDateOnly(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
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
    const dataLanc = makeDateOnly(year, movM, movD);
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

// ---------- Revolut parser ----------
// Layout: "<day> <mon>. <year> <description> [€out] [€in] €saldo"
// PDF extraction joins columns with spaces; missing columns simply disappear.
// We capture the last two € numbers per row: first = movement amount, second = saldo.
const PT_MONTHS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

function parseRevolut(text: string): ParsedStatement {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const parseEur = (raw: string): number => {
    // raw may include leading '-', '€', spaces as thousand sep, '.' decimal, or ',' decimal
    let s = raw.replace(/€/g, "").replace(/\s/g, "").trim();
    const neg = s.startsWith("-");
    if (neg) s = s.slice(1);
    // If both '.' and ',' present, '.' is thousand sep, ',' decimal (rare for Revolut)
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
    const n = parseFloat(s);
    return neg ? -n : n;
  };

  // Balances from summary block
  let saldoInicial: number | undefined;
  let saldoFinal: number | undefined;
  const mIni = text.match(/Saldo\s+de\s+abertura[^\d\-€]*(-?€?\s?-?\d[\d\s.,]*)/i);
  if (mIni) saldoInicial = parseEur(mIni[1]);
  const mFim = text.match(/Saldo\s+de\s+encerramento[^\d\-€]*(-?€?\s?-?\d[\d\s.,]*)/i);
  if (mFim) saldoFinal = parseEur(mFim[1]);

  // Date prefix: "9 abr. 2026" — capture day, mon, year, and rest
  const reRow = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?\s+(\d{4})\s+(.+)$/i;
  // Number with €: optional leading '-' or '- ' or '-€', then €, then digits with optional space-thousand and '.' decimal
  const reNum = /-?\s*€\s*-?\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})?/g;

  type Row = { date: Date; desc: string; amount: number; saldo: number; order: number };
  const rows: Row[] = [];
  let order = 0;
  for (const line of lines) {
    const m = line.match(reRow);
    if (!m) continue;
    const day = parseInt(m[1]);
    const mon = PT_MONTHS[m[2].toLowerCase()];
    const year = parseInt(m[3]);
    const rest = m[4];
    const nums = rest.match(reNum);
    if (!nums || nums.length < 2) continue;
    // Description = everything before the first matched number
    const firstIdx = rest.indexOf(nums[0]);
    let desc = rest.slice(0, firstIdx).trim().replace(/\s+/g, " ");
    // Strip leading type code (e.g. "ATM ", "FEE ", "CAR ") — keep readable description
    desc = desc.replace(/^(ATM|FEE|CAR|MOA|MOR|MOS|EXI|EXO|TRF)\s+/i, "");
    if (!desc) desc = "Movimento";
    const amount = parseEur(nums[nums.length - 2]);
    const saldo = parseEur(nums[nums.length - 1]);
    if (isNaN(amount) || isNaN(saldo)) continue;
    const date = new Date(year, mon - 1, day, 12, 0, 0, 0);
    rows.push({ date, desc, amount, saldo, order: order++ });
  }

  // Revolut lists newest first. Sort chronologically: by date asc; within same date, reverse original order.
  rows.sort((a, b) => a.date.getTime() - b.date.getTime() || b.order - a.order);

  // Determine sign of each amount using saldo delta vs previous balance
  const txs: BankTransaction[] = [];
  let prev = saldoInicial;
  for (const r of rows) {
    let signed = r.amount;
    if (prev !== undefined) {
      const delta = +(r.saldo - prev).toFixed(2);
      // If delta sign disagrees with our amount sign, flip
      if (Math.abs(Math.abs(delta) - Math.abs(r.amount)) < 0.02) {
        signed = delta < 0 ? -Math.abs(r.amount) : Math.abs(r.amount);
      } else {
        // Fallback: trust saldo delta
        signed = delta;
      }
    }
    txs.push({ dataMov: r.date, dataValor: r.date, descricao: r.desc, movimento: signed });
    prev = r.saldo;
  }

  if (saldoFinal === undefined && prev !== undefined) saldoFinal = prev;

  return { bank: "Revolut", transactions: txs, saldoInicial, saldoFinal };
}

// ---------- Santander parser ----------
// Layout per row: "DD-MM DD-MM <descritivo> [<moeda>] <valor PT> <saldo PT>"
// Year is not in the row → derive from "PERÍODO DE YYYY-MM-DD A YYYY-MM-DD" header.
function parseSantander(text: string): ParsedStatement {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  // Period header (may appear multiple times — first wins)
  let startYear = new Date().getFullYear();
  let endYear = startYear;
  let startMonth = 1;
  const period = text.match(/PER[IÍ]ODO\s+DE\s+(\d{4})-(\d{2})-\d{2}\s+A\s+(\d{4})-(\d{2})-\d{2}/i);
  if (period) {
    startYear = parseInt(period[1]);
    startMonth = parseInt(period[2]);
    endYear = parseInt(period[3]);
  }

  // PT amount: optional leading '-', integer with optional dot-thousands, comma decimals
  const reAmt = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
  // Row prefix: two DD-MM dates
  const reRow = /^(\d{2})-(\d{2})\s+(\d{2})-(\d{2})\s+(.+)$/;

  type Row = { tx: BankTransaction; saldo: number; order: number };
  const rows: Row[] = [];
  let order = 0;
  for (const line of lines) {
    const m = line.match(reRow);
    if (!m) continue;
    const movD = parseInt(m[1]);
    const movM = parseInt(m[2]);
    if (movM < 1 || movM > 12 || movD < 1 || movD > 31) continue;
    const rest = m[5];
    const nums = rest.match(reAmt);
    if (!nums || nums.length < 2) continue;
    const valor = parseAmountPT(nums[nums.length - 2]);
    const saldo = parseAmountPT(nums[nums.length - 1]);
    if (valor === null || valor === 0 || saldo === null) continue;
    const valorStr = nums[nums.length - 2];
    const valorIdx = rest.lastIndexOf(valorStr);
    let desc = rest.slice(0, valorIdx).trim().replace(/\s+/g, " ");
    desc = desc.replace(/\s+(EUR|EU)\s*$/i, "").trim();
    if (!desc) desc = valor >= 0 ? "Crédito" : "Débito";

    const year = movM >= startMonth ? startYear : endYear;
    const date = makeDateOnly(year, movM, movD);
    rows.push({
      tx: { dataMov: date, dataValor: date, descricao: desc, movimento: valor },
      saldo,
      order: order++,
    });
  }

  const txs: BankTransaction[] = rows.map((r) => r.tx);

  // Derive balances from the saldo column of the first/last movement row (chronological).
  // Santander PDFs typically list newest → oldest; sort by date asc, then by source order desc
  // (within same day, the earlier-printed row is the more recent transaction).
  let saldoInicial: number | undefined;
  let saldoFinal: number | undefined;
  if (rows.length > 0) {
    const sorted = [...rows].sort((a, b) => {
      const d = a.tx.dataMov.getTime() - b.tx.dataMov.getTime();
      return d !== 0 ? d : b.order - a.order;
    });
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    // Saldo final = saldo da última linha cronológica
    saldoFinal = last.saldo;
    // Saldo inicial = saldo da primeira linha cronológica menos o seu movimento
    saldoInicial = +(first.saldo - first.tx.movimento).toFixed(2);
  }

  // Use only saldos derived from movement rows — summary regex was unreliable.
  return { bank: "Santander", transactions: txs, saldoInicial, saldoFinal };
}

function parseNovoBanco(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/);
  // Find the first movements section
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/SALDO\s+ANTERIOR/i.test(lines[i]) && /\d/.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) {
    return { bank: "Novo Banco", transactions: [], ...findBalances(text) };
  }

  const numRe = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
  const parsePT = (s: string) => parseFloat(s.replace(/\./g, "").replace(",", "."));
  const parseDate = (s: string) => {
    const m = s.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
    if (!m) return null;
    return new Date(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0, 0);
  };

  // Capture first account number (e.g. "0006 8110 8781") to distinguish from sub-accounts
  let mainAcct: string | null = null;
  const acctRe = /CONTA\s+.*?n[ºo]\s+([\d\s]+?)\s+de\s+\d{2}\.\d{2}\.\d{4}/i;
  for (let i = 0; i <= startIdx; i++) {
    const am = lines[i].match(acctRe);
    if (am) { mainAcct = am[1].replace(/\s+/g, ""); break; }
  }

  // Initial balance
  const anteriorNums = lines[startIdx].match(numRe) || [];
  const saldoInicial = anteriorNums.length ? parsePT(anteriorNums[anteriorNums.length - 1]) : 0;
  let prevSaldo = saldoInicial;
  let saldoFinal: number | undefined;

  const rowRe = /^\s*(\d{2}\.\d{2}\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})\s+(.*)$/;
  const transactions: BankTransaction[] = [];
  let current: { tx: BankTransaction; rawDescParts: string[] } | null = null;

  const flush = () => {
    if (current) {
      current.tx.descricao = current.rawDescParts.join(" ").replace(/\s+/g, " ").trim();
      transactions.push(current.tx);
      current = null;
    }
  };

  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    // End conditions
    if (/SALDO\s+CONTABIL[ÍI]STICO/i.test(line) || /^TOTAL\b/i.test(line)) {
      const nums = line.match(numRe) || [];
      if (/SALDO\s+CONTABIL[ÍI]STICO/i.test(line) && nums.length) {
        saldoFinal = parsePT(nums[nums.length - 1]);
      }
      flush();
      break;
    }
    // Break only on a DIFFERENT account header (not page-break repeats of the same account)
    if (/^CONTA\s/i.test(line)) {
      const am = line.match(acctRe);
      const acct = am ? am[1].replace(/\s+/g, "") : null;
      if (acct && mainAcct && acct !== mainAcct) {
        flush();
        break;
      }
      continue;
    }
    // Skip headers/page footers
    if (/Página\s*\d+\|/i.test(line) || /^Data\s+Valor/i.test(line) || /^Data\s+Data/i.test(line) || /^Valor\s*$/i.test(line) || /^Descritivo/i.test(line) || /Extrato\s+Integrado/i.test(line)) {
      continue;
    }

    const m = raw.match(rowRe);
    if (m) {
      flush();
      const dataMov = parseDate(m[1]);
      const dataValor = parseDate(m[2]);
      if (!dataMov || !dataValor) continue;
      const rest = m[3];
      const nums = rest.match(numRe) || [];
      let movimento = 0;
      let descPart = rest;
      if (nums.length >= 1) {
        const saldo = parsePT(nums[nums.length - 1]);
        movimento = Math.round((saldo - prevSaldo) * 100) / 100;
        prevSaldo = saldo;
        // Strip trailing numbers from description
        const lastNumIdx = rest.lastIndexOf(nums[nums.length - 1]);
        descPart = rest.substring(0, lastNumIdx);
        // Strip the movement amount too (penultimate number) if present
        if (nums.length >= 2) {
          const penIdx = descPart.lastIndexOf(nums[nums.length - 2]);
          if (penIdx >= 0) descPart = descPart.substring(0, penIdx);
        }
      }
      current = {
        tx: { dataMov, dataValor, descricao: "", movimento },
        rawDescParts: [descPart.trim()],
      };
    } else if (current) {
      // Continuation of description
      current.rawDescParts.push(line);
    }
  }
  flush();

  return { bank: "Novo Banco", transactions, saldoInicial, saldoFinal };
}

export function parseBankText(text: string, bankHint?: string | null): ParsedStatement {
  const bank = bankHint || detectBank(text) || "Genérico";
  if (bank === "Millennium") return parseMillennium(text);
  if (bank === "Revolut") return parseRevolut(text);
  if (bank === "Santander") return parseSantander(text);
  if (bank === "Novo Banco") return parseNovoBanco(text);
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
