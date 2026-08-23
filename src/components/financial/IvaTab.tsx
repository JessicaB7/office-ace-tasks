import { useMemo } from "react";
import { useClientFinancialEntries, useFinancialAccounts } from "@/hooks/useClientFinancials";
import { buildEntryMap, getValue, fmt, fmtEur, VAT_DUE_DATES } from "./financialMath";
import { cn } from "@/lib/utils";

const IVA_VENDAS = ["24331111","24333311","24341331"];
const IVA_COMPRAS = ["24323111","24323211","24323311","24342"];
const TRIMESTRES = ["1º Trimestre", "2º Trimestre", "3º Trimestre", "4º Trimestre"];

const sumQuarter = (vals: number[], qi: number) =>
  vals.slice(qi * 3, qi * 3 + 3).reduce((a, b) => a + b, 0);

export default function IvaTab({ clientId, year }: { clientId: string; year: number }) {
  const { data: accounts = [] } = useFinancialAccounts();
  const { data: entries = [] } = useClientFinancialEntries(clientId, year);
  const map = useMemo(() => buildEntryMap(entries), [entries]);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Valor mensal por conta
  const monthlyVals = (code: string) => months.map((m) => getValue(map, m, code));
  const quarterlyVals = (code: string) => [0, 1, 2, 3].map((qi) => sumQuarter(monthlyVals(code), qi));

  const ivaPorMes = months.map((m) => {
    const vendas = IVA_VENDAS.reduce((s, c) => s + getValue(map, m, c), 0);
    const compras = IVA_COMPRAS.reduce((s, c) => s + getValue(map, m, c), 0);
    return vendas - compras;
  });

  const trimestres = [0, 1, 2, 3].map((qi) => sumQuarter(ivaPorMes, qi));

  const acc = (code: string) => accounts.find((a) => a.code === code);

  const totalsCol = (vals: number[]) => vals.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-semibold w-72">Conta</th>
              {TRIMESTRES.map((t) => <th key={t} className="px-3 py-2 text-right font-semibold">{t}</th>)}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-primary/5"><td colSpan={6} className="px-3 py-1.5 font-semibold text-primary text-[11px] uppercase tracking-wide">IVA Vendas</td></tr>
            {IVA_VENDAS.map((code) => {
              const q = quarterlyVals(code);
              return (
                <tr key={code} className="border-t">
                  <td className="px-3 py-1"><span className="text-muted-foreground text-[10px] mr-2 tabular-nums">{code}</span>{acc(code)?.name || code}</td>
                  {q.map((v, i) => <td key={i} className="px-3 py-1 text-right tabular-nums">{fmt(v)}</td>)}
                  <td className="px-3 py-1 text-right tabular-nums font-medium">{fmt(totalsCol(q))}</td>
                </tr>
              );
            })}
            <tr className="bg-primary/5 border-t"><td colSpan={6} className="px-3 py-1.5 font-semibold text-primary text-[11px] uppercase tracking-wide">IVA Compras</td></tr>
            {IVA_COMPRAS.map((code) => {
              const q = quarterlyVals(code);
              return (
                <tr key={code} className="border-t">
                  <td className="px-3 py-1"><span className="text-muted-foreground text-[10px] mr-2 tabular-nums">{code}</span>{acc(code)?.name || code}</td>
                  {q.map((v, i) => <td key={i} className="px-3 py-1 text-right tabular-nums">{fmt(v)}</td>)}
                  <td className="px-3 py-1 text-right tabular-nums font-medium">{fmt(totalsCol(q))}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-primary bg-primary/10 font-semibold">
              <td className="px-3 py-2 text-primary">IVA do trimestre (Vendas - Compras)</td>
              {trimestres.map((v, i) => <td key={i} className={cn("px-3 py-2 text-right tabular-nums", v < 0 && "text-destructive")}>{fmt(v)}</td>)}
              <td className={cn("px-3 py-2 text-right tabular-nums", totalsCol(trimestres) < 0 && "text-destructive")}>{fmt(totalsCol(trimestres))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-2">IVA a entregar ao Estado (trimestral)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {trimestres.map((v, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{TRIMESTRES[i]}</div>
              <div className={cn("text-xl font-bold mt-1 tabular-nums", v < 0 ? "text-emerald-600" : "text-primary")}>{fmtEur(v)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{VAT_DUE_DATES[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
