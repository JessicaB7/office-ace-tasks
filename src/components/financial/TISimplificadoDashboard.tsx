import { useMemo, useState, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

// Escalões IRS 2024 (taxa marginal)
const IRS_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 7703, rate: 0.1325 },
  { upTo: 11623, rate: 0.18 },
  { upTo: 16472, rate: 0.23 },
  { upTo: 21321, rate: 0.26 },
  { upTo: 27146, rate: 0.3275 },
  { upTo: 39791, rate: 0.37 },
  { upTo: 51997, rate: 0.435 },
  { upTo: 81199, rate: 0.45 },
  { upTo: Infinity, rate: 0.48 },
];

function calcIRS(rendimentoColectavel: number): number {
  if (rendimentoColectavel <= 0) return 0;
  let imposto = 0;
  let prev = 0;
  for (const b of IRS_BRACKETS) {
    if (rendimentoColectavel <= b.upTo) {
      imposto += (rendimentoColectavel - prev) * b.rate;
      return imposto;
    }
    imposto += (b.upTo - prev) * b.rate;
    prev = b.upTo;
  }
  return imposto;
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

  const [retencoes, setRetencoes] = useState<number>(Number(settings?.irs_retencoes ?? 0));
  useEffect(() => {
    setRetencoes(Number(settings?.irs_retencoes ?? 0));
  }, [settings?.irs_retencoes]);


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

  const totalFat = faturacaoM.reduce((a, b) => a + b, 0);
  const totalDesp = despesasM.reduce((a, b) => a + b, 0);
  const totalIva = ivaTrim.reduce((a, b) => a + b, 0);

  const rendimentoColectavel = totalFat * coef;
  const irsEstimado = calcIRS(rendimentoColectavel);
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
    { label: "IVA a entregar (anual)", value: totalIva, tone: totalIva >= 0 ? ("warn" as const) : ("positive" as const) },
    { label: "IRS estimado", value: irsEstimado, tone: "warn" as const },
  ];


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
              <div className="text-[11px] text-muted-foreground font-semibold">Q{i + 1}</div>
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
              <div className="text-[11px] text-muted-foreground">Q{i + 1}</div>
              <div className={cn("text-lg font-bold tabular-nums", v < 0 ? "text-emerald-600" : "text-primary")}>{fmtEur(v)}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {["Pagar até 25/05", "Pagar até 25/08", "Pagar até 25/11", "Pagar até 25/02 ano seguinte"][i]}
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
              Aplica o coeficiente do art.º 31 do CIRS à faturação e calcula o IRS pelos escalões 2024.
            </p>
          </div>
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
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">Faturação</div>
            <div className="text-lg font-bold tabular-nums">{fmtEur(totalFat)}</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">× Coeficiente</div>
            <div className="text-lg font-bold tabular-nums">{(coef * 100).toFixed(0).replace(".", ",")}%</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-[11px] text-muted-foreground">Rendimento colectável</div>
            <div className="text-lg font-bold tabular-nums">{fmtEur(rendimentoColectavel)}</div>
          </div>
          <div className="rounded-lg border bg-background p-3 ring-1 ring-amber-200 dark:ring-amber-900/40">
            <div className="text-[11px] text-amber-700">IRS estimado</div>
            <div className="text-lg font-bold tabular-nums text-amber-700">{fmtEur(irsEstimado)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
