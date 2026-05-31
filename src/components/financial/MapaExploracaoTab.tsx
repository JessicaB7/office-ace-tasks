import { useMemo } from "react";
import { useClientFinancialEntries, useClientFinancialSettings, useFinancialAccounts, useUpsertSettings } from "@/hooks/useClientFinancials";
import { buildEntryMap, computeMapaExploracao, fmt, MONTHS_PT, quarterSums } from "./financialMath";
import { cn } from "@/lib/utils";

export default function MapaExploracaoTab({ clientId, year }: { clientId: string; year: number }) {
  const { data: accounts = [] } = useFinancialAccounts();
  const { data: entries = [] } = useClientFinancialEntries(clientId, year);
  const { data: settings } = useClientFinancialSettings(clientId, year);
  const upsertSettings = useUpsertSettings(clientId, year);

  const me = useMemo(() => {
    if (!settings) return null;
    return computeMapaExploracao(buildEntryMap(entries), accounts, settings);
  }, [entries, accounts, settings]);

  if (!me || !settings) return <div className="text-muted-foreground text-sm">A calcular...</div>;

  type Row = { label: string; vals: number[]; total: number; tone?: "primary" | "muted" | "negative" | "bold" };
  const rows: Row[] = [
    { label: "Total Rendimentos (71-79)", vals: me.rendimentos, total: me.totalRendimentos, tone: "bold" },
    { label: "Total Gastos (61-69)", vals: me.gastos, total: me.totalGastos, tone: "bold" },
    { label: "Compras (31)", vals: me.compras, total: me.totalCompras, tone: "muted" },
    { label: "Resultado de Exploração", vals: me.resultado, total: me.totalResultado, tone: "primary" },
    { label: "Resultado Acumulado", vals: me.resultadoAcumulado, total: me.resultadoAcumulado[11], tone: "muted" },
    { label: "Imposto Estimado", vals: me.impostoEstimado, total: me.totalImposto, tone: "negative" },
    { label: "Tributações Autónomas", vals: me.ta, total: me.totalTA, tone: "negative" },
    { label: "RLP — Resultado Líquido", vals: me.rlp, total: me.totalRLP, tone: "primary" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SettingNumber label="Taxa IRC" value={settings.corporate_tax_rate} suffix="%" mult={100}
          onCommit={(v) => upsertSettings.mutate({ corporate_tax_rate: v / 100 })} />
        <SettingNumber label="TA Representação" value={settings.ta_representacao} suffix="%" mult={100}
          onCommit={(v) => upsertSettings.mutate({ ta_representacao: v / 100 })} />
        <SettingNumber label="TA Ajudas Custo" value={settings.ta_kms} suffix="%" mult={100}
          onCommit={(v) => upsertSettings.mutate({ ta_kms: v / 100 })} />
        <SettingNumber label="TA Não Documentadas" value={settings.ta_nao_doc} suffix="%" mult={100}
          onCommit={(v) => upsertSettings.mutate({ ta_nao_doc: v / 100 })} />
      </div>

      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-muted/60 text-left px-3 py-2 font-semibold w-64">Linha</th>
                {MONTHS_PT.map((m) => <th key={m} className="px-2 py-2 text-right font-semibold">{m}</th>)}
                <th className="px-2 py-2 text-right font-bold bg-muted">TOTAL</th>
                {[1,2,3,4].map((qi) => <th key={qi} className="px-2 py-2 text-right font-semibold bg-muted/80">Q{qi}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const q = quarterSums(r.vals);
                const cls =
                  r.tone === "primary" ? "bg-primary/10 font-bold text-primary" :
                  r.tone === "negative" ? "text-destructive" :
                  r.tone === "bold" ? "font-semibold" :
                  "text-muted-foreground";
                return (
                  <tr key={idx} className={cn("border-t", r.tone === "primary" && "border-t-2 border-primary")}>
                    <td className={cn("sticky left-0 bg-card px-3 py-1.5", cls)}>{r.label}</td>
                    {r.vals.map((v, i) => (
                      <td key={i} className={cn("px-2 py-1 text-right tabular-nums", cls, v < 0 && r.tone !== "negative" && "text-destructive")}>{fmt(v)}</td>
                    ))}
                    <td className={cn("px-2 py-1 text-right tabular-nums bg-muted/40", cls)}>{fmt(r.total)}</td>
                    {q.map((qv, qi) => (
                      <td key={qi} className={cn("px-2 py-1 text-right tabular-nums bg-muted/20", cls)}>{fmt(qv)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingNumber({ label, value, suffix, mult = 1, onCommit }: { label: string; value: number; suffix?: string; mult?: number; onCommit: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1 rounded-lg border bg-card px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          step="0.1"
          defaultValue={(value * mult).toFixed(2)}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (!isNaN(n) && n / mult !== value) onCommit(n);
          }}
          className="w-20 bg-transparent text-right tabular-nums font-semibold text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}
