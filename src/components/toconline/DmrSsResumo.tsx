import { useEffect, useMemo, useState } from "react";
import { Copy, Receipt, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ToconlineJob } from "@/hooks/useToconlineJobs";
import { STATUS_LABELS, STATUS_CLASSES, type ToconlineJobStatus } from "@/lib/toconlineProcedures";
import { type DmrSsResult, type SsClientInfo, fmtEuro, totalDividas, temDividas, dmrSsToTsv } from "@/lib/dmrSs";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthLabel = (key: string) => { const [y, m] = key.split("-").map(Number); return `${MONTH_NAMES[m - 1]} ${y}`; };
const fmtDate = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

/** Resumo mensal da Guia DMR SS: guias geradas (valor, referência, prazo) e controlo de dívidas. */
const DmrSsResumo = ({ jobs, clientById }: { jobs: ToconlineJob[]; clientById: Map<string, SsClientInfo> }) => {
  const ssJobs = useMemo(() => jobs.filter((j) => j.procedure_id === "dmr_guia_ss"), [jobs]);
  const months = useMemo(() => [...new Set(ssJobs.map((j) => j.reference_month))].sort().reverse(), [ssJobs]);
  const [month, setMonth] = useState(months[0] || "");
  useEffect(() => { if (!months.includes(month)) setMonth(months[0] || ""); }, [months, month]);
  const [soDividas, setSoDividas] = useState(false);

  const rows = useMemo(() => ssJobs
    .filter((j) => j.reference_month === month)
    .map((j) => ({ job: j, client: clientById.get(j.client_id), data: (j.result_data || null) as DmrSsResult | null }))
    .filter((r) => !soDividas || temDividas(r.data))
    .sort((a, b) => (a.client?.name || "").localeCompare(b.client?.name || "", "pt")), [ssJobs, month, clientById, soDividas]);

  if (months.length === 0) return null;

  const guias = rows.filter((r) => r.data?.referencia);
  const totalGuias = guias.reduce((s, r) => s + (r.data?.valor || 0), 0);
  const comDividas = rows.filter((r) => temDividas(r.data));

  const copiar = async () => {
    const tsv = dmrSsToTsv(rows.map((r) => ({
      cliente: r.client?.name || "", nif: r.client?.nif || "",
      estado: STATUS_LABELS[r.job.status as ToconlineJobStatus] || r.job.status,
      data: r.data, notas: r.data?.referencia ? "" : r.job.result_notes,
    })));
    try { await navigator.clipboard.writeText(tsv); toast.success("Tabela copiada — cole no Excel ou no Google Sheets."); }
    catch { toast.error("Não foi possível copiar."); }
  };

  return (
    <section className="bg-card rounded-xl border overflow-hidden">
      <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" /> Guias DMR SS e dívidas</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês das guias"
            className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={soDividas} onChange={(e) => setSoDividas(e.target.checked)} /> Só com dívidas
          </label>
          <button onClick={copiar} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border hover:bg-muted transition-colors">
            <Copy className="w-4 h-4" /> Copiar tabela
          </button>
        </div>
      </div>
      <div className="px-4 pb-3 flex gap-4 flex-wrap text-sm">
        <span><span className="font-semibold">{guias.length}</span> guias · <span className="font-semibold">{fmtEuro(totalGuias)}</span></span>
        <span className={cn(comDividas.length ? "text-destructive" : "text-muted-foreground")}>
          <span className="font-semibold">{comDividas.length}</span> clientes com dívidas
        </span>
      </div>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto border-t">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Estado</th>
              <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Valor</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Entidade / Referência</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Pagar até</th>
              <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Em atraso</th>
              <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Execução fiscal</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground min-w-[200px]">Acordos / observações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ job, client, data }) => {
              const status = job.status as ToconlineJobStatus;
              return (
                <tr key={job.id} className="border-t align-top">
                  <td className="px-4 py-2 font-medium">
                    {client?.name || "—"}
                    {client?.ss_acesso_problema && (
                      <div className="text-xs text-warning font-normal flex items-start gap-1 mt-0.5"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{client.ss_acesso_problema}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap", STATUS_CLASSES[status])}>
                      {data?.ja_entregue ? "Já entregue" : STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {data?.referencia ? fmtEuro(data.valor) : ""}
                    {data?.valor_ti ? <div className="text-xs text-muted-foreground">TI {fmtEuro(data.valor_ti)}</div> : null}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">{data?.referencia ? `${data.entidade} / ${data.referencia}` : ""}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{data?.referencia ? fmtDate(data.data_limite) : ""}</td>
                  <td className={cn("px-4 py-2 text-right whitespace-nowrap", data?.atraso ? "text-destructive font-medium" : "text-muted-foreground")}>{data?.atraso ? fmtEuro(data.atraso) : "—"}</td>
                  <td className={cn("px-4 py-2 text-right whitespace-nowrap", data?.execucao_fiscal ? "text-destructive font-medium" : "text-muted-foreground")}>{data?.execucao_fiscal ? fmtEuro(data.execucao_fiscal) : "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {data?.acordos || (!data?.referencia && !data?.ja_entregue ? job.result_notes : "")}
                    {totalDividas(data) > 0 && (data?.coimas || data?.outros) ? <div>Coimas/outros: {fmtEuro((data?.coimas || 0) + (data?.outros || 0))}</div> : null}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sem resultados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DmrSsResumo;
