import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
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

const cents = (v: number) => Math.round(v * 100) / 100;
const sameCurrency = (a: number, b: number) => Math.abs(cents(a) - cents(b)) <= 0.01;

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

// Balancetes trimestrais ficam concentrados no mês de fecho. Se por algum
// motivo os valores aparecerem repartidos por igual pelos 3 meses do trimestre,
// colapsa-os no último mês para o gráfico.
function closeRepeatedQuarterValues(monthly: number[]): number[] {
  const out = monthly.map(cents);
  for (let qi = 0; qi < 4; qi++) {
    const s = qi * 3;
    const q = out.slice(s, s + 3);
    const nz = q.filter((v) => Math.abs(v) > 0.01);
    if (nz.length === 3 && nz.every((v) => sameCurrency(v, nz[0]))) {
      out[s] = 0;
      out[s + 1] = 0;
      out[s + 2] = cents(q.reduce((a, b) => a + b, 0));
    }
  }
  return out;
}

function sumSectionMonthClosedByQuarter(
  map: Map<string, number>,
  accounts: any[],
  sections: string[],
  month: number,
): number {
  let total = 0;
  for (const a of accounts) {
    if (!sections.includes(a.section)) continue;
    const closed = closeRepeatedQuarterValues(
      Array.from({ length: 12 }, (_, i) => getValue(map, i + 1, a.code)),
    );
    total += closed[month - 1] ?? 0;
  }
  return total;
}

export default function TIOrganizadoDashboard({
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

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const faturacaoM = months.map((m) => sumSectionMonth(map, accounts, "vendas", m));
  const despesasM = months.map(
    (m) =>
      sumSectionMonth(map, accounts, "despesas", m) +
      sumSectionMonth(map, accounts, "compras", m) +
      sumSectionMonth(map, accounts, "pessoal", m),
  );

  const faturacaoChartM = months.map((m) =>
    sumSectionMonthClosedByQuarter(map, accounts, ["vendas"], m),
  );
  const despesasChartM = months.map((m) =>
    sumSectionMonthClosedByQuarter(map, accounts, ["despesas", "compras", "pessoal"], m),
  );

  const facTrim = [0, 1, 2, 3].map((qi) =>
    faturacaoM.slice(qi * 3, qi * 3 + 3).reduce((a, b) => a + b, 0),
  );
  const despTrim = [0, 1, 2, 3].map((qi) =>
    despesasM.slice(qi * 3, qi * 3 + 3).reduce((a, b) => a + b, 0),
  );
  const lucroTrim = facTrim.map((f, i) => f - despTrim[i]);

  const sumPrefixMonth = (prefix: string, month: number) => {
    let total = 0;
    for (const [key, val] of map.entries()) {
      const [mStr, code] = key.split(":");
      if (Number(mStr) === month && code.startsWith(prefix)) total += val;
    }
    return total;
  };
  const ivaAuto = [0, 1, 2, 3].map((qi) => {
    const lastMonth = qi * 3 + 3;
    const aPagar = sumPrefixMonth("2436", lastMonth);
    const aRecuperar = sumPrefixMonth("2437", lastMonth);
    return aPagar - aRecuperar;
  });

  // IVA por trimestre — valor manual (editável) tem prioridade sobre o automático
  const ivaManual: (number | null)[] = [
    settings?.iva_q1 ?? null,
    settings?.iva_q2 ?? null,
    settings?.iva_q3 ?? null,
    settings?.iva_q4 ?? null,
  ].map((v) => (v === null || v === undefined ? null : Number(v)));
  const ivaTrim = ivaAuto.map((auto, i) => (ivaManual[i] === null ? auto : (ivaManual[i] as number)));
  const [ivaInputs, setIvaInputs] = useState<string[]>(
    ivaTrim.map((v) => String(cents(v))),
  );
  useEffect(() => {
    setIvaInputs(
      [0, 1, 2, 3].map((i) =>
        String(cents(ivaManual[i] === null ? ivaAuto[i] : (ivaManual[i] as number))),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.iva_q1, settings?.iva_q2, settings?.iva_q3, settings?.iva_q4, entries]);

  const saveIva = (i: number) => {
    const v = Number(ivaInputs[i]);
    const next = Number.isFinite(v) ? cents(v) : 0;
    upsertSettings.mutate({ [`iva_q${i + 1}`]: next } as any);
  };
  const resetIva = (i: number) => {
    upsertSettings.mutate({ [`iva_q${i + 1}`]: null } as any);
  };

  // Retenção na fonte e pagamentos por conta (2414 e sub-contas) — soma anual em módulo.
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

  // Deduções à coleta (250 € por defeito, editável)
  const deducoes = Number(settings?.irs_deducoes_colecta ?? 250);
  const [deducoesInput, setDeducoesInput] = useState<number>(deducoes);
  useEffect(() => {
    setDeducoesInput(Number(settings?.irs_deducoes_colecta ?? 250));
  }, [settings?.irs_deducoes_colecta]);

  // Outras despesas (título e valor editáveis) — abate à faturação no resultado
  const outrasLabel = String(settings?.outras_despesas_label ?? "Outras despesas");
  const outrasValor = Number(settings?.outras_despesas_valor ?? 0);
  const [outrasLabelInput, setOutrasLabelInput] = useState<string>(outrasLabel);
  const [outrasValorInput, setOutrasValorInput] = useState<number>(outrasValor);
  useEffect(() => {
    setOutrasLabelInput(String(settings?.outras_despesas_label ?? "Outras despesas"));
  }, [settings?.outras_despesas_label]);
  useEffect(() => {
    setOutrasValorInput(Number(settings?.outras_despesas_valor ?? 0));
  }, [settings?.outras_despesas_valor]);

  const totalFat = faturacaoM.reduce((a, b) => a + b, 0);
  const totalDesp = despesasM.reduce((a, b) => a + b, 0);
  const resultado = totalFat - totalDesp - outrasValor;
  const totalIva = ivaTrim.reduce((a, b) => a + b, 0);

  // Simulador IRS
  const [coef, setCoef] = useState<number>(Number(client?.irs_coeficiente ?? 0.75));
  useEffect(() => {
    setCoef(Number(client?.irs_coeficiente ?? 0.75));
  }, [client?.irs_coeficiente]);
  const saveCoef = async (val: number) => {
    const safe = isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.75;
    setCoef(safe);
    const { error } = await supabase.from("clients").update({ irs_coeficiente: safe }).eq("id", clientId);
    if (error) toast.error("Erro a guardar coeficiente");
    else {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Coeficiente atualizado");
    }
  };

  const irsOrganizado = calcIRS(Math.max(0, resultado));
  const irsOrganizadoLiquido = irsOrganizado - retencoes;
  const rendimentoColectavel = totalFat * coef;
  const irsSimplificado = calcIRS(rendimentoColectavel);
  const irsSimplificadoLiquido = irsSimplificado - retencoes;
  const diffRegimes = irsSimplificadoLiquido - irsOrganizadoLiquido;

  const chartData = MONTHS_PT.map((m, i) => ({
    mes: m,
    Faturação: cents(faturacaoChartM[i]),
    Despesas: cents(despesasChartM[i]),
  }));

  const kpis = [
    { label: "Faturação anual", value: totalFat, tone: "primary" as const },
    { label: "Despesas totais", value: totalDesp, tone: "neutral" as const },
    { label: outrasLabel, value: outrasValor, tone: "neutral" as const },
    { label: "Resultado", value: resultado, tone: resultado >= 0 ? ("positive" as const) : ("warn" as const) },
  ];

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
      pdf.save(`Analise_TI_Organizado_${safeName}_${year}.pdf`);
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
      <div ref={reportRef} className="bg-background p-4 grid grid-cols-12 gap-3 items-stretch" style={{ width: exporting ? 1400 : undefined }}>
        <div className="col-span-12 flex items-start justify-between border-b pb-3">
          <div>
            <div className="text-lg font-semibold">{client?.name || client?.nome || "—"}</div>
            <div className="text-sm text-muted-foreground">NIF: {client?.nif || client?.nipc || "—"}</div>
          </div>
          <div className="text-sm text-muted-foreground">Análise TI Organizado · {year}</div>
        </div>

        <div className="col-span-12 grid grid-cols-4 gap-3 auto-rows-fr">
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

        {!exporting && (
          <div className="col-span-12 rounded-xl border bg-card p-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <label className="text-[11px] text-muted-foreground">Título</label>
                <input
                  type="text"
                  value={outrasLabelInput}
                  onChange={(e) => setOutrasLabelInput(e.target.value)}
                  onBlur={() => {
                    const v = outrasLabelInput.trim() || "Outras despesas";
                    setOutrasLabelInput(v);
                    if (v !== outrasLabel) upsertSettings.mutate({ outras_despesas_label: v });
                  }}
                  placeholder="Outras despesas"
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="w-40">
                <label className="text-[11px] text-muted-foreground">Valor (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={Number.isFinite(outrasValorInput) ? outrasValorInput : 0}
                  onChange={(e) => setOutrasValorInput(Number(e.target.value))}
                  onBlur={() => {
                    const v = Math.max(0, Number(outrasValorInput) || 0);
                    setOutrasValorInput(v);
                    if (v !== outrasValor) upsertSettings.mutate({ outras_despesas_valor: v });
                  }}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <p className="text-[11px] text-muted-foreground pb-2">
                Abate à faturação no cálculo do resultado.
              </p>
            </div>
          </div>
        )}

        <div className="col-span-7 rounded-xl border bg-card p-4 h-full flex flex-col">
          <h4 className="font-semibold text-sm mb-3">Faturação vs Despesas (mensal)</h4>
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="28%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" fontSize={11} interval={0} tickMargin={8} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Faturação" fill="hsl(var(--primary))" maxBarSize={28} />
                <Bar dataKey="Despesas" fill="hsl(var(--primary) / 0.62)" maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-5 rounded-xl border bg-card p-4 h-full flex flex-col">
          <h4 className="font-semibold text-sm mb-3">Análise trimestral</h4>
          <div className="grid grid-cols-2 gap-3 auto-rows-fr flex-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border bg-background p-3 space-y-1 min-h-[112px] h-full flex flex-col justify-center">
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
                  <span className="text-muted-foreground">Resultado</span>
                  <span className={cn("font-bold tabular-nums", lucroTrim[i] >= 0 ? "text-emerald-700" : "text-amber-700")}>
                    {fmtEur(lucroTrim[i])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 rounded-xl border bg-card p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">IVA por trimestre</h4>
            <div className="text-xs text-muted-foreground">
              Total anual: <span className="font-bold tabular-nums text-foreground">{fmtEur(totalIva)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr flex-1">
            {ivaTrim.map((v, i) => (
              <div key={i} className="rounded-lg border bg-background p-3 min-h-[116px] h-full flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-muted-foreground">{i + 1}º trimestre</div>
                  {!exporting && ivaManual[i] !== null && (
                    <button
                      type="button"
                      onClick={() => resetIva(i)}
                      title="Repor valor automático"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {exporting ? (
                  <div className={cn("text-lg font-bold tabular-nums", v < 0 ? "text-emerald-600" : "text-primary")}>{fmtEur(v)}</div>
                ) : (
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={ivaInputs[i] ?? ""}
                      onChange={(e) => {
                        const next = [...ivaInputs];
                        next[i] = e.target.value;
                        setIvaInputs(next);
                      }}
                      onBlur={() => saveIva(i)}
                      className={cn(
                        "w-full text-right font-bold tabular-nums text-base py-1.5 pl-2 pr-7 rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30",
                        v < 0 ? "text-emerald-600" : "text-primary",
                      )}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">€</span>
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground mt-1">
                  {["Pagar até 25/05", "Pagar até 25/08", "Pagar até 25/11", "Pagar até 25/02 ano seguinte"][i]}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h4 className="font-semibold text-sm">Retenção na fonte e pagamentos por conta</h4>
              <p className="text-xs text-muted-foreground mt-1">Conta 2414 · soma anual dos valores retidos por terceiros.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {!exporting && retencoesSource === "manual" && (
                <input
                  type="number"
                  step="0.01"
                  value={retencoesInput}
                  onChange={(e) => setRetencoesInput(Number(e.target.value))}
                  onBlur={() => upsertSettings.mutate({ irs_retencoes: retencoesInput })}
                  className="w-36 py-1.5 px-2 rounded-lg border bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
              <div className="text-2xl font-bold tabular-nums text-emerald-700">{fmtEur(retencoes)}</div>
            </div>
          </div>
        </div>

        <div className="col-span-12 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h4 className="font-semibold text-sm">Deduções à coleta</h4>
              <p className="text-xs text-muted-foreground mt-1">Valor que abate ao IRS estimado (250 € por defeito).</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {!exporting && (
                <input
                  type="number"
                  step="0.01"
                  value={deducoesInput}
                  onChange={(e) => setDeducoesInput(Number(e.target.value))}
                  onBlur={() => upsertSettings.mutate({ irs_deducoes_colecta: deducoesInput })}
                  className="w-36 py-1.5 px-2 rounded-lg border bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
              <div className="text-2xl font-bold tabular-nums text-emerald-700">{fmtEur(deducoes)}</div>
            </div>
          </div>
        </div>

        {/* Simulador de IRS */}
        <div className="col-span-12 rounded-xl border bg-card p-4">
          <h4 className="font-semibold text-sm">IRS Regime Organizado</h4>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 auto-rows-fr">
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Faturação</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(totalFat)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Resultado líquido</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(resultado)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">IRS estimado</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(irsOrganizado)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Deduções à coleta</div>
              <div className="text-lg font-bold tabular-nums text-emerald-700">−{fmtEur(deducoes)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Retenção na fonte e pagamentos por conta</div>
              <div className="text-lg font-bold tabular-nums text-emerald-700">−{fmtEur(retencoes)}</div>
            </div>
            <div className={cn("rounded-lg border bg-background p-3 ring-1 min-h-[78px] h-full flex flex-col justify-center", irsOrganizadoLiquido >= 0 ? "ring-amber-200 dark:ring-amber-900/40" : "ring-emerald-200 dark:ring-emerald-900/40")}>
              <div className={cn("text-[11px]", irsOrganizadoLiquido >= 0 ? "text-amber-700" : "text-emerald-700")}>
                {irsOrganizadoLiquido >= 0 ? "IRS a pagar" : "IRS a receber"}
              </div>
              <div className={cn("text-lg font-bold tabular-nums", irsOrganizadoLiquido >= 0 ? "text-amber-700" : "text-emerald-700")}>
                {fmtEur(Math.abs(irsOrganizadoLiquido))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <h4 className="font-semibold text-sm">IRS Regime Simplificado</h4>
            {!exporting && (
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
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 auto-rows-fr">
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Faturação</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(totalFat)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Rendimento colectável</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(rendimentoColectavel)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">IRS estimado</div>
              <div className="text-lg font-bold tabular-nums">{fmtEur(irsSimplificado)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Deduções à coleta</div>
              <div className="text-lg font-bold tabular-nums text-emerald-700">−{fmtEur(deducoes)}</div>
            </div>
            <div className="rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center">
              <div className="text-[11px] text-muted-foreground">Retenção na fonte e pagamentos por conta</div>
              <div className="text-lg font-bold tabular-nums text-emerald-700">−{fmtEur(retencoes)}</div>
            </div>
            <div className={cn("rounded-lg border bg-background p-3 ring-1 min-h-[78px] h-full flex flex-col justify-center", irsSimplificadoLiquido >= 0 ? "ring-amber-200 dark:ring-amber-900/40" : "ring-emerald-200 dark:ring-emerald-900/40")}>
              <div className={cn("text-[11px]", irsSimplificadoLiquido >= 0 ? "text-amber-700" : "text-emerald-700")}>
                {irsSimplificadoLiquido >= 0 ? "IRS a pagar" : "IRS a receber"}
              </div>
              <div className={cn("text-lg font-bold tabular-nums", irsSimplificadoLiquido >= 0 ? "text-amber-700" : "text-emerald-700")}>
                {fmtEur(Math.abs(irsSimplificadoLiquido))}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border bg-muted/40 p-3 flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {diffRegimes === 0
                ? "Ambos os regimes resultam no mesmo IRS"
                : diffRegimes > 0
                  ? "Regime organizado mais favorável — poupança estimada"
                  : "Regime simplificado mais favorável — poupança estimada"}
            </span>
            <span className="text-base font-bold tabular-nums">{fmtEur(Math.abs(diffRegimes))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
