// Parses a TOConline "Balancete ( Período, Acumulado )" XLSX and aggregates
// period values by leaf account code. The value is placed in the closing month
// of the report so the chart shows the movement in the correct month instead
// of spreading an accumulated value across the period. Earlier months of the
// same range receive 0 so old distributions get cleared on re-import.
import * as XLSX from "xlsx";

export interface BalanceteEntry { month: number; account_code: string; value: number; }
export interface BalanceteResult { entries: BalanceteEntry[]; startMonth: number; endMonth: number; year: number; }

const MONTHS_PT: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, "março": 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const num = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};

export async function isBalanceteXlsx(file: File): Promise<boolean> {
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    for (const name of wb.SheetNames) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
      for (const row of rows.slice(0, 20)) {
        const txt = (row || []).map((c) => (c == null ? "" : String(c))).join(" ");
        if (/Balancete\s*\(\s*Per[íi]odo/i.test(txt)) return true;
      }
    }
  } catch {}
  return false;
}

export async function parseBalanceteXlsx(file: File, catalogCodes: string[]): Promise<BalanceteResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sortedCodes = [...catalogCodes].sort((a, b) => b.length - a.length);

  let startMonth = 1, endMonth = 12, year = new Date().getFullYear();
  let foundHeader = false;

  // Aggregate leaf-level period net per code across all sheets.
  const periodDeb = new Map<string, number>();
  const periodCred = new Map<string, number>();

  for (const sheetName of wb.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });

    // Locate the "Exercício de YYYY, mês (YYYY) a mês (YYYY)" header.
    if (!foundHeader) {
      const flat = rows.slice(0, 20).map((r) => (r || []).join(" ")).join(" ");
      const m = flat.match(/Exerc[íi]cio de (\d{4})\s*,\s*([a-zç]+)\s*\(\d{4}\)\s*a\s*([a-zç]+)\s*\(\d{4}\)/i);
      if (m) {
        year = parseInt(m[1], 10);
        const s = MONTHS_PT[m[2].toLowerCase()];
        const e = MONTHS_PT[m[3].toLowerCase()];
        if (s) startMonth = s;
        if (e) endMonth = e;
        foundHeader = true;
      }
    }

    // Locate the header row that contains "Conta" / "Descrição" so we can map columns.
    let headerIdx = -1;
    let colConta = -1, colInteg = -1, colPerDeb = -1, colPerCred = -1;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const row = rows[i] || [];
      const lower = row.map((c) => (c == null ? "" : String(c).toLowerCase().trim()));
      const idxConta = lower.findIndex((c) => c === "conta");
      const idxDesc = lower.findIndex((c) => c === "descrição" || c === "descricao");
      if (idxConta >= 0 && idxDesc >= 0) {
        headerIdx = i;
        colConta = idxConta;
        colInteg = lower.findIndex((c) => c.startsWith("integrad"));
        // Two "débito" and two "crédito" columns: first pair = Período, second = Acumulado.
        const debs = lower.map((c, k) => (/d[ée]bito/.test(c) ? k : -1)).filter((k) => k >= 0);
        const creds = lower.map((c, k) => (/cr[ée]dito/.test(c) ? k : -1)).filter((k) => k >= 0);
        colPerDeb = debs[0] ?? -1;
        colPerCred = creds[0] ?? -1;
        break;
      }
    }
    if (headerIdx < 0 || colConta < 0) continue;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const rawCode = row[colConta];
      if (rawCode == null) continue;
      const code = String(rawCode).trim();
      if (!/^\d{1,12}$/.test(code)) continue;

      // Skip integrating rows (totals). If the flag is missing, fall back to a
      // structural leaf check based on other rows.
      const integ = colInteg >= 0 ? row[colInteg] : null;
      if (integ === true || String(integ).toLowerCase() === "true" || String(integ).toLowerCase() === "sim") continue;

      const deb = colPerDeb >= 0 ? num(row[colPerDeb]) : 0;
      const cred = colPerCred >= 0 ? num(row[colPerCred]) : 0;
      if (deb === 0 && cred === 0) continue;

      periodDeb.set(code, (periodDeb.get(code) || 0) + deb);
      periodCred.set(code, (periodCred.get(code) || 0) + cred);
    }
  }

  // Aggregate net per catalog code (match longest prefix).
  const catalogAgg = new Map<string, number>();
  for (const code of periodDeb.keys()) {
    const match = sortedCodes.find((c) => code.startsWith(c));
    if (!match) continue;
    const net = Math.abs((periodDeb.get(code) || 0) - (periodCred.get(code) || 0));
    if (net === 0) continue;
    catalogAgg.set(match, (catalogAgg.get(match) || 0) + net);
  }

  const entries: BalanceteEntry[] = [];
  for (const [code, total] of catalogAgg.entries()) {
    const rounded = Math.round(total * 100) / 100;
    for (let m = startMonth; m <= endMonth; m++) {
      entries.push({ month: m, account_code: code, value: m === endMonth ? rounded : 0 });
    }
  }

  return { entries, startMonth, endMonth, year };
}
