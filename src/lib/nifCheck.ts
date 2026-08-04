import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";

export const findNifInText = (text: string): string | null => {
  const labelled = text.match(
    /(?:NIF|N\.?\s*I\.?\s*F\.?|NIPC|Contribuinte|Contribuente)[^0-9]{0,15}(\d[\d\s.]{7,12}\d)/i,
  );
  const raw = labelled?.[1] ?? text.match(/\b([125-9]\d{8})\b/)?.[1] ?? null;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
};

/** Extracts the first NIF found in a PDF or XLSX/CSV file (first pages/rows only). */
export async function extractNifFromFile(file: File): Promise<string | null> {
  const buf = await file.arrayBuffer();
  const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
  try {
    if (isPdf) {
      const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
      const maxPages = Math.min(pdf.numPages, 3);
      for (let p = 1; p <= maxPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const text = content.items.map((it: any) => String(it.str || "")).join(" ");
        const nif = findNifInText(text);
        if (nif) return nif;
      }
      return null;
    }
    const wb = XLSX.read(buf, { type: "array" });
    for (const sheetName of wb.SheetNames) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
      const text = rows
        .slice(0, 40)
        .map((r) => (r || []).map((c) => (c == null ? "" : String(c))).join(" "))
        .join(" ");
      const nif = findNifInText(text);
      if (nif) return nif;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates the NIF found in an imported document against the client's NIF.
 * Returns { ok, docNif } — ok=false means the document belongs to another entity.
 */
export async function validateDocumentNif(
  file: File,
  clientNif?: string | null,
): Promise<{ ok: boolean; docNif: string | null; clientNif: string | null }> {
  const docNif = await extractNifFromFile(file);
  const target = (clientNif ?? "").replace(/\D/g, "") || null;
  if (!docNif || !target) return { ok: true, docNif, clientNif: target };
  return { ok: docNif === target, docNif, clientNif: target };
}
