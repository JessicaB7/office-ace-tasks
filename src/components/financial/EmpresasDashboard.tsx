import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useClientFinancialEntries,
  useClientFinancialSettings,
  useFinancialAccounts,
  useUpsertSettings,
} from "@/hooks/useClientFinancials";
import { buildEntryMap, MONTHS_PT, fmtEur, sumSectionMonth, sumGroupMonth } from "./financialMath";
import { cn } from "@/lib/utils";

const cents = (v: number) => Math.round(v * 100) / 100;

export default function EmpresasDashboard({
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
  const { data: settings } = useClientFinancialSettings(clientId, year);
  const upsertSettings = useUpsertSettings(clientId, year);
  const map = useMemo(() => buildEntryMap(entries), [entries]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Rubricas SNC
  const rendimentosM = months.map((m) => sumSectionMonth(map, accounts, "vendas", m));
  const fseM = months.map((m) => sumGroupMonth(map, accounts, "62", m));
  const pessoalM = months.map((m) => sumSectionMonth(map, accounts, "pessoal", m));
  const depreciacoesM = months.map((m) => sumGroupMonth(map, accounts, "64", m));
  const outrosGastosM = months.map(
    (m) =>
      sumSectionMonth(map, accounts, "despesas", m) +
      sumSectionMonth(map, accounts, "compras", m) -
      fseM[m - 1] -
      depreciacoesM[m - 1],
  );
  const gastosM = months.map(
    (m, i) => fseM[i] + pessoalM[i] + depreciacoesM[i] + outrosGastosM[i],
  );
  const resultadoM = months.map((_, i) => rendimentosM[i] - gastosM[i]);

  const vendasM = rendimentosM;

  const totalRendimentos = rendimentosM.reduce((a, b) => a + b, 0);
  const totalFse = fseM.reduce((a, b) => a + b, 0);
  const totalPessoal = pessoalM.reduce((a, b) => a + b, 0);
  const totalDepreciacoes = depreciacoesM.reduce((a, b) => a + b, 0);
  const totalOutros = outrosGastosM.reduce((a, b) => a + b, 0);
  const totalVendas = totalRendimentos;
  const totalGastos = gastosM.reduce((a, b) => a + b, 0);
  const resultado = totalRendimentos - totalGastos;

  const vTrim = [0, 1, 2, 3].map((q) => vendasM.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0));
  const gTrim = [0, 1, 2, 3].map((q) => gastosM.slice(q * 3, q * 3 + 3).reduce((a, b) => a + b, 0));
  const rTrim = vTrim.map((v, i) => v - gTrim[i]);

  const chartData = MONTHS_PT.map((m, i) => ({
    mes: m,
    Rendimentos: cents(rendimentosM[i]),
    Gastos: cents(gastosM[i]),
    Resultado: cents(resultadoM[i]),
  }));


  const taxa = Number(settings?.corporate_tax_rate ?? 0.16);
  const baseTributavel = Math.max(0, resultado);
  const ircBase = baseTributavel * taxa;
  const derrama = baseTributavel * 0.015;
  const ircTotal = ircBase + derrama;
  const taxaEfetiva = baseTributavel > 0 ? (ircTotal / baseTributavel) * 100 : 0;

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
      pdf.save(`Analise_Empresa_${safeName}_${year}.pdf`);
      toast.success("PDF exportado");
    } catch (e: any) {
      toast.error("Erro a exportar PDF: " + (e?.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const kpis = [
    { label: "Rendimentos", value: totalRendimentos, tone: "primary" as const },
    { label: "FSE", value: totalFse, tone: "neutral" as const },
    { label: "Gastos com pessoal", value: totalPessoal, tone: "neutral" as const },
    { label: "Depreciações", value: totalDepreciacoes, tone: "neutral" as const },
    { label: "Resultado", value: resultado, tone: resultado >= 0 ? ("positive" as const) : ("warn" as const) },
  ];


  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
          <div className="text-sm text-muted-foreground">Análise Empresa · {year}</div>
        </div>

        <div className="col-span-12 grid grid-cols-2 lg:grid-cols-5 gap-3 auto-rows-fr">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border bg-card p-4 h-full min-h-[88px] flex flex-col justify-center">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={cn(
                "text-xl font-bold mt-1 tabular-nums",
                k.tone === "primary" && "text-primary",
                k.tone === "warn" && "text-amber-700",
                k.tone === "positive" && "text-emerald-700",
              )}>{fmtEur(k.value)}</div>
            </div>
          ))}
        </div>

        <div className="col-span-12 rounded-xl border bg-card p-4">
          <h4 className="font-semibold text-sm mb-3">Estrutura de gastos</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
            {[
              { label: "FSE", value: totalFse },
              { label: "Gastos com pessoal", value: totalPessoal },
              { label: "Depreciações", value: totalDepreciacoes },
              { label: "Outros gastos", value: totalOutros },
            ].map((g) => (
              <div key={g.label} className="rounded-lg border bg-background p-3 min-h-[92px] flex flex-col justify-center">
                <div className="text-[11px] text-muted-foreground">{g.label}</div>
                <div className="text-lg font-bold tabular-nums">{fmtEur(g.value)}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {totalGastos > 0 ? `${((g.value / totalGastos) * 100).toFixed(1)}% dos gastos` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 rounded-xl border bg-card p-4 h-full flex flex-col">
          <h4 className="font-semibold text-sm mb-3">Rendimentos, gastos e resultado (mensal)</h4>
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="24%" barGap={3}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} interval={0} tickMargin={8} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Rendimentos" fill="hsl(var(--primary))" maxBarSize={22} />
                <Bar dataKey="Gastos" fill="hsl(var(--primary) / 0.62)" maxBarSize={22} />
                <Bar dataKey="Resultado" fill="hsl(var(--primary) / 0.32)" maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="col-span-12 lg:col-span-5 rounded-xl border bg-card p-4 h-full flex flex-col">
          <h4 className="font-semibold text-sm mb-3">Análise trimestral</h4>
          <div className="grid grid-cols-2 gap-3 auto-rows-fr flex-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-background p-3 space-y-1 min-h-[112px] h-full flex flex-col justify-center">
                <div className="text-[11px] text-muted-foreground font-semibold">{i + 1}º trimestre</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Rendimentos</span>
                  <span className="font-semibold tabular-nums text-primary">{fmtEur(vTrim[i])}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Gastos</span>
                  <span className="font-semibold tabular-nums">{fmtEur(gTrim[i])}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t">
                  <span className="text-muted-foreground">Resultado</span>
                  <span className={cn("font-bold tabular-nums", rTrim[i] >= 0 ? "text-emerald-700" : "text-amber-700")}>
                    {fmtEur(rTrim[i])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
            <h4 className="font-semibold text-sm">IRC estimado</h4>
            {!exporting && (
            <div className="flex items-center gap-2">
              <Label htmlFor="irc-taxa" className="text-xs text-muted-foreground whitespace-nowrap">Taxa de IRC (%)</Label>
              <Input
                id="irc-taxa"
                type="number"
                step="0.5"
                className="h-8 w-24"
                value={(taxa * 100).toString()}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) upsertSettings.mutate({ corporate_tax_rate: v / 100 });
                }}
              />
            </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">
            <div className="rounded-lg border bg-background p-3 min-h-[100px] flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Matéria coletável</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(baseTributavel)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[100px] flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">IRC ({(taxa * 100).toFixed(1)}%)</div>
              <div className="text-lg font-bold tabular-nums text-primary">{fmtEur(ircBase)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[100px] flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Derrama municipal (1,5%)</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(derrama)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[100px] flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Total a pagar</div>
              <div className="text-lg font-bold tabular-nums text-amber-700">{fmtEur(ircTotal)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">Taxa efetiva {taxaEfetiva.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
