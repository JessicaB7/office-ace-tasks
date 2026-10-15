/** Guia DMR SS — dados estruturados guardados em toconline_jobs.result_data. Valores em euros (número). */
export interface DmrSsResult {
  /** Contribuições a pagar na guia (entidade empregadora + TI, quando juntas). */
  valor?: number | null;
  /** Parte de trabalhador independente incluída (ou por pagar, se não incluída). */
  valor_ti?: number | null;
  entidade?: string | null;
  referencia?: string | null;
  /** Data limite de pagamento, AAAA-MM-DD. */
  data_limite?: string | null;
  ficheiro?: string | null;
  atraso?: number | null;
  coimas?: number | null;
  outros?: number | null;
  execucao_fiscal?: number | null;
  /** Planos prestacionais / acordos, em texto. */
  acordos?: string | null;
  /** Já entregue antes (Pagamento marcado) — nada a fazer. */
  ja_entregue?: boolean;
}

/** "1.234,56" → 1234.56 */
export const parseEuro = (s: string): number => Number(s.replace(/\./g, "").replace(",", "."));

export const fmtEuro = (n: number | null | undefined): string =>
  n == null ? "" : n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

/** Total de dívidas (atraso + coimas + outros + execução fiscal). */
export const totalDividas = (d: DmrSsResult | null | undefined): number =>
  (d?.atraso || 0) + (d?.coimas || 0) + (d?.outros || 0) + (d?.execucao_fiscal || 0);

export const temDividas = (d: DmrSsResult | null | undefined): boolean =>
  totalDividas(d) > 0 || !!d?.acordos;

/** Lê os dados do texto do Resultado no formato do manual
 * ("DMR SS 09/2026 — 1.511,63 € até 26/10/2026 — Ref. MB 21056/885694031 (DMR SS/Guia_….pdf) — Atraso 0,00 € · …"). */
export function parseDmrSsNotes(notes: string | null | undefined): DmrSsResult | null {
  if (!notes || !/^DMR SS/.test(notes)) return null;
  const out: DmrSsResult = {};
  const euro = "([\\d.]+,\\d{2}) €";
  const valor = notes.match(new RegExp(`^DMR SS \\d{2}/\\d{4} — ${euro}`));
  if (valor) out.valor = parseEuro(valor[1]);
  const data = notes.match(/até (\d{2})\/(\d{2})\/(\d{4})/);
  if (data) out.data_limite = `${data[3]}-${data[2]}-${data[1]}`;
  const ref = notes.match(/Ref\. MB (\d+)\/(\d+)/);
  if (ref) { out.entidade = ref[1]; out.referencia = ref[2]; }
  const fich = notes.match(/\((?:DMR SS\/)?(Guia_DMR_SS_[^)\s;]+\.pdf)/);
  if (fich) out.ficheiro = fich[1];
  const campo = (label: string) => {
    const m = notes.match(new RegExp(`${label} ${euro}`));
    return m ? parseEuro(m[1]) : undefined;
  };
  const atraso = campo("Atraso"); if (atraso !== undefined) out.atraso = atraso;
  const coimas = campo("Coimas"); if (coimas !== undefined) out.coimas = coimas;
  const outros = campo("Outros"); if (outros !== undefined) out.outros = outros;
  const ef = campo("Execução fiscal"); if (ef !== undefined) out.execucao_fiscal = ef;
  const ti = notes.match(new RegExp(`trabalhador independente ${euro}`));
  if (ti) out.valor_ti = parseEuro(ti[1]);
  const acordo = notes.match(/acordos?: (.+)$/);
  if (acordo) out.acordos = acordo[1].trim();
  if (/já entregue/i.test(notes)) out.ja_entregue = true;
  return out;
}

/** Campos da ficha do cliente usados nas guias DMR SS. */
export interface SsClientInfo {
  name: string;
  nif?: string | null;
  tipo_contabilidade?: string | null;
  pag_seguranca_social?: string | null;
  ss_acesso_problema?: string | null;
}

export interface DmrSsRow { cliente: string; nif: string; estado: string; data: DmrSsResult | null; notas?: string | null }

const COLS = ["Cliente", "NIF", "Estado", "Valor", "Entidade", "Referência", "Pagar até", "Em atraso", "Execução fiscal", "Coimas/outros", "Acordos", "Observações"];

/** Tabela (TSV, para colar no Excel/Sheets) com uma linha por cliente. */
export function dmrSsToTsv(rows: DmrSsRow[]): string {
  const num = (n: number | null | undefined) => (n ? n.toLocaleString("pt-PT", { minimumFractionDigits: 2 }) : "");
  const dt = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "");
  const lines = rows.map((r) => {
    const d = r.data || {};
    return [
      r.cliente, r.nif, r.estado, num(d.valor), d.entidade || "", d.referencia || "", dt(d.data_limite),
      num(d.atraso), num(d.execucao_fiscal), num((d.coimas || 0) + (d.outros || 0)), d.acordos || "",
      (r.notas || "").replace(/[\t\n]+/g, " "),
    ].join("\t");
  });
  return [COLS.join("\t"), ...lines].join("\n");
}
