import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, Legend } from "recharts";
import { Download, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useClientFinancialEntries,
  useFinancialAccounts,
} from "@/hooks/useClientFinancials";
import { buildEntryMap, fmtEur, sumSectionMonth, sumGroupMonth, quarterSums } from "./financialMath";
import { cn } from "@/lib/utils";

const cents = (v: number) => Math.round(v * 100) / 100;
const QUARTERS = ["1º trimestre", "2º trimestre", "3º trimestre", "4º trimestre"];
const QUARTERS_SHORT = ["1º T", "2º T", "3º T", "4º T"];

export default function DashboardTrimestral({
  clientId,
  year,
  client,
}: {
  clientId: string;
  year: number;
  client: any;
}) {
  const { data: accounts = [] } = useFinancialAccounts();
  const { data: entries = [] } = useClientFinancialEntries(clientId, year);
  const map = useMemo(() => buildEntryMap(entries), [entries]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const rendimentosM = months.map((m) => sumSectionMonth(map, accounts, "vendas", m));
  const fseM = months.map((m) => sumGroupMonth(map, accounts, "62", m));
  const pessoalM = months.map((m) => sumSectionMonth(map, accounts, "pessoal", m));
  const depreciacoesM = months.map((m) => sumGroupMonth(map, accounts, "64", m));
  const mercadoriasM = months.map((m) => sumGroupMonth(map, accounts, "31", m));
  const outrosGastosM = months.map(
    (m) =>
      sumSectionMonth(map, accounts, "despesas", m) +
      sumSectionMonth(map, accounts, "compras", m) -
      fseM[m - 1] -
      depreciacoesM[m - 1] -
      mercadoriasM[m - 1],
  );
  const gastosM = months.map(
    (_, i) => fseM[i] + pessoalM[i] + depreciacoesM[i] + mercadoriasM[i] + outrosGastosM[i],
  );
  const resultadoM = months.map((_, i) => rendimentosM[i] - gastosM[i]);

  // Subdivisão dos FSE por rubricas SNC
  const FSE_SUB: { label: string; prefixes: string[] }[] = [
    { label: "Serviços especializados", prefixes: ["621", "622"] },
    { label: "Materiais", prefixes: ["623"] },
    { label: "Energia e fluidos", prefixes: ["624"] },
    { label: "Deslocações, estadas e transportes", prefixes: ["625"] },
    { label: "Serviços diversos", prefixes: ["626"] },
  ];
  const fseSubM = FSE_SUB.map((s) =>
    months.map((m) => s.prefixes.reduce((acc, p) => acc + sumGroupMonth(map, accounts, p, m), 0)),
  );
  const fseOutrosM = months.map(
    (_, idx) => fseM[idx] - fseSubM.reduce((acc, arr) => acc + arr[idx], 0),
  );

  // Agregação por trimestre
  const rendimentosQ = quarterSums(rendimentosM);
  const fseQ = quarterSums(fseM);
  const fseSubQ = fseSubM.map(quarterSums);
  const fseOutrosQ = quarterSums(fseOutrosM);
  const pessoalQ = quarterSums(pessoalM);
  const depreciacoesQ = quarterSums(depreciacoesM);
  const mercadoriasQ = quarterSums(mercadoriasM);
  const outrosGastosQ = quarterSums(outrosGastosM);
  const gastosQ = quarterSums(gastosM);
  const resultadoQ = quarterSums(resultadoM);


  const lastWithData = useMemo(() => {
    for (let q = 3; q >= 0; q--) if (rendimentosQ[q] || gastosQ[q]) return q;
    return Math.floor(new Date().getMonth() / 3);
  }, [rendimentosQ.join(","), gastosQ.join(",")]);

  const [quarter, setQuarter] = useState<number>(lastWithData);
  const i = quarter;
  const prev = i > 0 ? i - 1 : null;

  const acumulado = (arr: number[]) => arr.slice(0, i + 1).reduce((a, b) => a + b, 0);

  const rows = [
    { label: "Rendimentos", arr: rendimentosQ, tone: "primary" as const },
    { label: "Gastos com mercadorias", arr: mercadoriasQ, tone: "neutral" as const },
    { label: "FSE", arr: fseQ, tone: "neutral" as const },
    { label: "Gastos com salários", arr: pessoalQ, tone: "neutral" as const },
    { label: "Depreciações", arr: depreciacoesQ, tone: "neutral" as const },
    { label: "Outros gastos", arr: outrosGastosQ, tone: "neutral" as const },
    { label: "Total de gastos", arr: gastosQ, tone: "neutral" as const },
    { label: "Resultado", arr: resultadoQ, tone: "result" as const },
  ];

  const kpis = rows.filter((r) => r.label !== "Outros gastos" && r.label !== "Total de gastos");

  const margem = rendimentosQ[i] ? (resultadoQ[i] / rendimentosQ[i]) * 100 : 0;

  const chartData = QUARTERS_SHORT.map((q, idx) => ({
    trimestre: q,
    Rendimentos: cents(rendimentosQ[idx]),
    Gastos: cents(gastosQ[idx]),
    Resultado: cents(resultadoQ[idx]),
  }));

  let running = 0;
  const acumData = QUARTERS_SHORT.map((q, idx) => {
    running += resultadoQ[idx];
    return { trimestre: q, Acumulado: cents(running) };
  });

  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const pdf = new jsPDF("l", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentW = pageW - margin * 2;
      const contentH = pageH - margin * 2;
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        windowWidth: reportRef.current.scrollWidth,
      });
      const ratio = canvas.width / canvas.height;
      let wMm = contentW;
      let hMm = wMm / ratio;
      if (hMm > contentH) { hMm = contentH; wMm = hMm * ratio; }
      const xOff = margin + (contentW - wMm) / 2;
      const yOff = margin + (contentH - hMm) / 2;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", xOff, yOff, wMm, hMm);
      const safeName = (client?.name || client?.nome || "cliente").replace(/[^a-zA-Z0-9-_]+/g, "_");
      pdf.save(`Analise_Trimestral_${safeName}_T${i + 1}_${year}.pdf`);
      toast.success("PDF exportado");
    } catch (e: any) {
      toast.error("Erro a exportar PDF: " + (e?.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const variation = (arr: number[]) => {
    if (prev === null) return null;
    const base = arr[prev];
    if (!base) return null;
    return ((arr[i] - base) / Math.abs(base)) * 100;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {QUARTERS.map((q, idx) => (
            <button
              key={q}
              onClick={() => setQuarter(idx)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium border transition-colors",
                quarter === idx
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {q}
            </button>
          ))}
        </div>
        <Button onClick={exportPDF} disabled={exporting} size="sm" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {exporting ? "A exportar..." : "Exportar PDF"}
        </Button>
      </div>

      <div ref={reportRef} className="bg-background p-4 grid grid-cols-12 gap-3 items-stretch" style={{ width: exporting ? 1400 : undefined }}>
        <div className="col-span-12 flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-lg font-semibold">{client?.name || client?.nome || "—"}</div>
            <div className="text-sm text-muted-foreground">NIF: {client?.nif || client?.nipc || "—"}</div>
          </div>
          <div className="text-sm text-muted-foreground">
            Análise trimestral · {QUARTERS[i]} {year}
          </div>
        </div>

        <div className="col-span-12 grid grid-cols-2 lg:grid-cols-6 gap-3 auto-rows-fr">
          {kpis.map((k) => {
            const v = k.arr[i];
            const varPct = variation(k.arr);
            return (
              <div key={k.label} className="rounded-xl border bg-card p-4 h-full min-h-[104px] flex flex-col justify-center">
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className={cn(
                  "text-xl font-bold mt-1 tabular-nums",
                  k.tone === "primary" && "text-primary",
                  k.tone === "result" && (v >= 0 ? "text-emerald-700" : "text-amber-700"),
                )}>{fmtEur(v)}</div>
                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  {varPct === null ? (
                    <><Minus className="h-3 w-3" /> sem comparação</>
                  ) : (
                    <>
                      {varPct >= 0 ? <ArrowUp className="h-3 w-3 text-emerald-600" /> : <ArrowDown className="h-3 w-3 text-amber-600" />}
                      {Math.abs(varPct).toFixed(1)}% vs {QUARTERS_SHORT[prev!]}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
          <div className="rounded-lg border bg-card p-3 min-h-[92px] flex flex-col justify-center">
            <div className="text-[11px] text-muted-foreground">Margem do trimestre</div>
            <div className={cn("text-lg font-bold tabular-nums", margem >= 0 ? "text-emerald-700" : "text-amber-700")}>
              {margem.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3 min-h-[92px] flex flex-col justify-center">
            <div className="text-[11px] text-muted-foreground">Rendimentos acumulados</div>
            <div className="text-lg font-bold tabular-nums text-primary">{fmtEur(acumulado(rendimentosQ))}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 min-h-[92px] flex flex-col justify-center">
            <div className="text-[11px] text-muted-foreground">Gastos acumulados</div>
            <div className="text-lg font-bold tabular-nums">{fmtEur(acumulado(gastosQ))}</div>
          </div>
          <div className="rounded-lg border bg-card p-3 min-h-[92px] flex flex-col justify-center">
            <div className="text-[11px] text-muted-foreground">Resultado acumulado</div>
            <div className={cn("text-lg font-bold tabular-nums", acumulado(resultadoQ) >= 0 ? "text-emerald-700" : "text-amber-700")}>
              {fmtEur(acumulado(resultadoQ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 rounded-xl border bg-card p-4 h-full flex flex-col">
          <h4 className="font-semibold text-sm mb-3">Evolução trimestral</h4>
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="24%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="trimestre" fontSize={11} interval={0} tickMargin={8} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Rendimentos" fill="hsl(var(--primary))" maxBarSize={38} />
                <Bar dataKey="Gastos" fill="hsl(var(--primary) / 0.62)" maxBarSize={38} />
                <Bar dataKey="Resultado" fill="hsl(var(--primary) / 0.32)" maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 rounded-xl border bg-card p-4 h-full flex flex-col">
          <h4 className="font-semibold text-sm mb-3">Resultado acumulado</h4>
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={acumData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="trimestre" fontSize={11} interval={0} tickMargin={8} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
                <Line type="monotone" dataKey="Acumulado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-12 rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-semibold w-56">Rubrica</th>
                {QUARTERS.map((q, idx) => (
                  <th key={q} className={cn("px-3 py-2 text-right font-semibold", idx === i && "bg-primary/10 text-primary")}>{q}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t">
                  <td className={cn("px-3 py-1.5", r.tone === "result" && "font-semibold")}>{r.label}</td>
                  {r.arr.map((v, idx) => (
                    <td key={idx} className={cn(
                      "px-3 py-1.5 text-right tabular-nums",
                      idx === i && "bg-primary/10 font-semibold",
                      r.tone === "result" && (v >= 0 ? "text-emerald-700" : "text-amber-700"),
                    )}>{fmtEur(v)}</td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                    {fmtEur(r.arr.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
