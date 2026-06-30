import { useMemo, useState, useEffect, useRef } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  useClientFinancialEntries,
  useClientFinancialSettings,
  useFinancialAccounts,
  useUpsertSettings,
} from "@/hooks/useClientFinancials";
import {
  buildEntryMap,
  getValue,
  MONTHS_PT,
  fmtEur,
  sumSectionMonth,
} from "./financialMath";
import { cn } from "@/lib/utils";

const IVA_VENDAS = ["24331111", "24333311", "24341331"];
const IVA_COMPRAS = ["24323111", "24323211", "24323311", "24342"];

// Escalões IRS 2026 — método "taxa × rendimento − parcela a abater"
const IRS_BRACKETS: { upTo: number; rate: number; abate: number }[] = [
  { upTo: 8342, rate: 0.125, abate: 0 },
  { upTo: 12587, rate: 0.157, abate: 266.94 },
  { upTo: 17838, rate: 0.212, abate: 959.26 },
  { upTo: 23089, rate: 0.241, abate: 1476.45 },
  { upTo: 29397, rate: 0.311, abate: 3092.77 },
  { upTo: 43090, rate: 0.349, abate: 4209.94 },
  { upTo: 46566, rate: 0.431, abate: 7743.27 },
  { upTo: 86634, rate: 0.446, abate: 8441.48 },
  { upTo: Infinity, rate: 0.48, abate: 11387.17 },
];

function calcIRS(rendimentoColectavel: number): number {
  if (rendimentoColectavel <= 0) return 0;
  for (const b of IRS_BRACKETS) {
    if (rendimentoColectavel <= b.upTo) {
      return Math.max(0, rendimentoColectavel * b.rate - b.abate);
    }
  }
  return 0;
}


export default function TISimplificadoDashboard({
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
  const qc = useQueryClient();

  const [coef, setCoef] = useState<number>(Number(client?.irs_coeficiente ?? 0.75));
  useEffect(() => {
    setCoef(Number(client?.irs_coeficiente ?? 0.75));
  }, [client?.irs_coeficiente]);





  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const faturacaoM = months.map((m) => sumSectionMonth(map, accounts, "vendas", m));
  const despesasM = months.map(
    (m) =>
      sumSectionMonth(map, accounts, "despesas", m) +
      sumSectionMonth(map, accounts, "compras", m) +
      sumSectionMonth(map, accounts, "pessoal", m),
  );

  const ivaM = months.map((m) => {
    const v = IVA_VENDAS.reduce((s, c) => s + getValue(map, m, c), 0);
    const co = IVA_COMPRAS.reduce((s, c) => s + getValue(map, m, c), 0);
    return v - co;
  });

  const facTrim = [0, 1, 2, 3].map((qi) =>
    faturacaoM.slice(qi * 3, qi * 3 + 3).reduce((a, b) => a + b, 0),
  );
  const despTrim = [0, 1, 2, 3].map((qi) =>
    despesasM.slice(qi * 3, qi * 3 + 3).reduce((a, b) => a + b, 0),
  );
  const lucroTrim = facTrim.map((f, i) => f - despTrim[i]);

  // IVA por trimestre: usa contas 2436 (a pagar) / 2437 (a recuperar) do último mês do trimestre.
  // Fallback para o líquido das contas de IVA mensal somado no trimestre.
  const sumPrefixMonth = (prefix: string, month: number) => {
    let total = 0;
    for (const [key, val] of map.entries()) {
      const [mStr, code] = key.split(":");
      if (Number(mStr) === month && code.startsWith(prefix)) total += val;
    }
    return total;
  };
  const ivaTrim = [0, 1, 2, 3].map((qi) => {
    const lastMonth = qi * 3 + 3;
    const aPagar = sumPrefixMonth("2436", lastMonth);
    const aRecuperar = sumPrefixMonth("2437", lastMonth);
    if (aPagar !== 0 || aRecuperar !== 0) return aPagar - aRecuperar;
    return ivaM.slice(qi * 3, qi * 3 + 3).reduce((a, b) => a + b, 0);
  });

  // Retenções na fonte: soma anual da conta 2414 (qualquer subconta) do balancete.
  const retencoes2414 = (() => {
    let total = 0;
    for (const [key, val] of map.entries()) {
      const [, code] = key.split(":");
      if (code.startsWith("2414")) total += Math.abs(val);
    }
    return total;
  })();
  const retencoesManual = Number(settings?.irs_retencoes ?? 0);
  const retencoes = retencoes2414 > 0 ? retencoes2414 : retencoesManual;
  const retencoesSource: "auto" | "manual" = retencoes2414 > 0 ? "auto" : "manual";

  const [retencoesInput, setRetencoesInput] = useState<number>(retencoesManual);
  useEffect(() => {
    setRetencoesInput(Number(settings?.irs_retencoes ?? 0));
  }, [settings?.irs_retencoes]);

  const ssQuarters = [
    Number(settings?.ss_q1 ?? 0),
    Number(settings?.ss_q2 ?? 0),
    Number(settings?.ss_q3 ?? 0),
    Number(settings?.ss_q4 ?? 0),
  ];
  const [ssInputs, setSsInputs] = useState<number[]>(ssQuarters);
  useEffect(() => {
    setSsInputs([
      Number(settings?.ss_q1 ?? 0),
      Number(settings?.ss_q2 ?? 0),
      Number(settings?.ss_q3 ?? 0),
      Number(settings?.ss_q4 ?? 0),
    ]);
  }, [settings?.ss_q1, settings?.ss_q2, settings?.ss_q3, settings?.ss_q4]);


  const totalFat = faturacaoM.reduce((a, b) => a + b, 0);
  const totalDesp = despesasM.reduce((a, b) => a + b, 0);
  const totalIva = ivaTrim.reduce((a, b) => a + b, 0);

  const rendimentoColectavel = totalFat * coef;
  const irsEstimado = calcIRS(rendimentoColectavel);
  const irsLiquido = irsEstimado - retencoes;
  const resultado = totalFat - totalDesp;


  const chartData = MONTHS_PT.map((m, i) => ({
    mes: m,
    Faturação: Math.round(faturacaoM[i] * 100) / 100,
    Despesas: Math.round(despesasM[i] * 100) / 100,
  }));

  const saveCoef = async (val: number) => {
    const safe = isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.75;
    setCoef(safe);
    const { error } = await supabase
      .from("clients")
      .update({ irs_coeficiente: safe })
      .eq("id", clientId);
    if (error) {
      toast.error("Erro a guardar coeficiente");
    } else {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Coeficiente atualizado");
    }
  };

  const kpis = [
    { label: "Faturação anual", value: totalFat, tone: "primary" as const },
    { label: "Despesas totais", value: totalDesp, tone: "neutral" as const },
    { label: "Resultado líquido", value: resultado, tone: resultado >= 0 ? ("positive" as const) : ("warn" as const) },
  ];


  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const exportPDF = async () => {
    if (!reportRef.current) return;
    const ssMissing = !settings?.tco && ssInputs.some((v) => !v || Number(v) <= 0);
    if (ssMissing) {
      toast.error("Preencha a Segurança Social de todos os trimestres antes de exportar.");
      return;
    }
    setExporting(true);

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = margin;
      pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
      heightLeft -= pageH - margin * 2;
      while (heightLeft > 0) {
        position = heightLeft - imgH + margin;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
        heightLeft -= pageH - margin * 2;
      }
      const safeName = (client?.name || client?.nome || "cliente").replace(/[^a-zA-Z0-9-_]+/g, "_");
      pdf.save(`Analise_TI_Simplificado_${safeName}_${year}.pdf`);
      toast.success("PDF exportado");
    } catch (e: any) {
      toast.error("Erro a exportar PDF: " + (e?.message || ""));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={exportPDF} disabled={exporting} size="sm" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          {exporting ? "A exportar..." : "Exportar PDF"}
        </Button>
      </div>
      <div ref={reportRef} className="space-y-6 bg-background p-4">
      <div className="flex items-start justify-between border-b pb-3">
        <div>
          <div className="text-lg font-semibold">{client?.name || client?.nome || "—"}</div>
          <div className="text-sm text-muted-foreground">
            NIF: {client?.nif || client?.nipc || "—"}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Análise TI Simplificado · {year}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpis.map((k) => (

          <div key={k.label} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div
              className={cn(
                "text-xl font-bold mt-1 tabular-nums",
                k.tone === "primary" && "text-primary",
                k.tone === "warn" && "text-amber-700",
                k.tone === "positive" && "text-emerald-700",
              )}
            >
              {fmtEur(k.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h4 className="font-semibold text-sm mb-3">Faturação vs Despesas (mensal)</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="mes" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Faturação" fill="hsl(var(--primary))" />
            <Bar dataKey="Despesas" fill="#c17c74" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h4 className="font-semibold text-sm mb-3">Análise trimestral</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-background p-3 space-y-1">
              <div className="text-[11px] text-muted-foreground font-semibold">{i + 1}º trimestre</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Faturação</span>
                <span className="font-semibold tabular-nums text-primary">{fmtEur(facTrim[i])}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Despesas</span>
                <span className="font-semibold tabular-nums">{fmtEur(despTrim[i])}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t">
                <span className="text-muted-foreground">Lucro</span>
                <span className={cn("font-bold tabular-nums", lucroTrim[i] >= 0 ? "text-emerald-700" : "text-amber-700")}>
                  {fmtEur(lucroTrim[i])}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h4 className="font-semibold text-sm mb-3">IVA por trimestre</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ivaTrim.map((v, i) => (
            <div key={i} className="rounded-lg border bg-background p-3">
              <div className="text-[11px] text-muted-foreground">{i + 1}º trimestre</div>
              <div className={cn("text-lg font-bold tabular-nums", v < 0 ? "text-emerald-600" : "text-primary")}>{fmtEur(v)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {["Pagar até 25/05", "Pagar até 25/08", "Pagar até 25/11", "Pagar até 25/02 ano seguinte"][i]}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
          <div>
            <h4 className="font-semibold text-sm">Segurança Social por trimestre</h4>
            <p className="text-[11px] text-muted-foreground mt-1">
              Introduz manualmente o valor pago em cada trimestre.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Total anual: <span className="font-bold tabular-nums text-foreground">{fmtEur(ssQuarters.reduce((a, b) => a + b, 0))}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ssQuarters.map((val, i) => (
            <div key={i} className="rounded-lg border bg-background p-3 space-y-2">
              <div className="text-[11px] text-muted-foreground font-semibold">{i + 1}º trimestre</div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ssInputs[i]}
                  onChange={(e) => {
                    const next = [...ssInputs];
                    next[i] = Number(e.target.value);
                    setSsInputs(next);
                  }}
                  onBlur={() => {
                    if (ssInputs[i] !== ssQuarters[i]) {
                      upsertSettings.mutate({ [`ss_q${i + 1}`]: Number(ssInputs[i]) || 0 } as any);
                    }
                  }}
                  className="w-full text-right font-bold tabular-nums text-primary py-1 px-2 rounded border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">€</span>
              </div>
            </div>
          ))}
        </div>
      </div>


      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="font-semibold text-sm">IRS estimado (regime simplificado)</h4>
            <p className="text-[11px] text-muted-foreground mt-1">
              Aplica o coeficiente do art.º 31 do CIRS à faturação e calcula o IRS pelos escalões 2026.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Coeficiente</span>
              <select
                value={coef}
                onChange={(e) => saveCoef(Number(e.target.value))}
                className="py-1.5 px-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value={0.15}>0,15 — Vendas mercadorias</option>
                <option value={0.35}>0,35 — Outras prestações de serviços</option>
                <option value={0.75}>0,75 — Serviços profissionais (art.º 151)</option>
                <option value={0.95}>0,95 — Rend. capitais / prediais</option>
              </select>
            </label>
            {retencoesSource !== "auto" && (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Retenções na fonte</span>
                <input
                  type="number"
                  step="0.01"
                  value={retencoesInput}
                  onChange={(e) => setRetencoesInput(Number(e.target.value))}
                  onBlur={() => upsertSettings.mutate({ irs_retencoes: retencoesInput })}
                  className="w-32 py-1.5 px-2 rounded-lg border bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            )}


          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">Faturação</div>
            <div className="text-lg font-bold tabular-nums">{fmtEur(totalFat)}</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">Rendimento colectável</div>
            <div className="text-lg font-bold tabular-nums">{fmtEur(rendimentoColectavel)}</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">IRS estimado</div>
            <div className="text-lg font-bold tabular-nums">{fmtEur(irsEstimado)}</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">Retenções na fonte</div>
            <div className="text-lg font-bold tabular-nums text-emerald-700">−{fmtEur(retencoes)}</div>
          </div>
          <div className={cn("rounded-lg border bg-background p-3 ring-1", irsLiquido >= 0 ? "ring-amber-200 dark:ring-amber-900/40" : "ring-emerald-200 dark:ring-emerald-900/40")}>
            <div className={cn("text-[11px]", irsLiquido >= 0 ? "text-amber-700" : "text-emerald-700")}>
              {irsLiquido >= 0 ? "IRS a pagar" : "IRS a receber"}
            </div>
            <div className={cn("text-lg font-bold tabular-nums", irsLiquido >= 0 ? "text-amber-700" : "text-emerald-700")}>
              {fmtEur(Math.abs(irsLiquido))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );

}
