import { Fragment, useEffect, useMemo, useState } from "react";
import { useFinancialAccounts, useClientFinancialEntries, useUpsertEntry, type FinancialAccount } from "@/hooks/useClientFinancials";
import { buildEntryMap, getValue, MONTHS_PT, sumSectionMonth, sumSectionYear, fmt, quarterSums } from "./financialMath";
import { cn } from "@/lib/utils";

type Section = {
  key: FinancialAccount["section"];
  label: string;
  tone: "neutral" | "positive" | "negative";
};

const SECTIONS: Section[] = [
  { key: "vendas", label: "Faturação", tone: "positive" },
  { key: "pessoal", label: "Gastos com pessoal", tone: "negative" },
  { key: "despesas", label: "Despesas (FSE)", tone: "negative" },
  { key: "compras", label: "Compra de Material", tone: "negative" },
];

function EditableCell({ value, onCommit, readOnly }: { value: number; onCommit: (n: number) => void; readOnly?: boolean }) {
  const [v, setV] = useState(value === 0 ? "" : String(value));
  useEffect(() => { setV(value === 0 ? "" : String(value)); }, [value]);
  if (readOnly) {
    return <td className="px-2 py-1 text-right text-xs tabular-nums text-muted-foreground">{fmt(value)}</td>;
  }
  return (
    <td className="px-0 py-0">
      <input
        value={v}
        onChange={(e) => setV(e.target.value.replace(",", "."))}
        onBlur={() => {
          const n = Number(v) || 0;
          if (n !== value) onCommit(n);
        }}
        className="w-full px-2 py-1 text-right text-xs tabular-nums bg-transparent border-0 focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary rounded"
        placeholder="—"
      />
    </td>
  );
}

export default function AnaliseMensalTab({ clientId, year, readOnly }: { clientId: string; year: number; readOnly?: boolean }) {
  const { data: accounts = [] } = useFinancialAccounts();
  const { data: entries = [] } = useClientFinancialEntries(clientId, year);
  const upsert = useUpsertEntry(clientId, year);
  const [showEmpty, setShowEmpty] = useState(false);

  const map = useMemo(() => buildEntryMap(entries), [entries]);
  const operationalAccounts = useMemo(
    () => accounts.filter((a) => SECTIONS.some((s) => s.key === a.section)),
    [accounts]
  );

  // Total Vendas, Total Pessoal, Total Despesas + Compras, Lucro
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const hasValues = (code: string) => months.some((m) => getValue(map, m, code) !== 0);
  const totVendasM = months.map((m) => sumSectionMonth(map, accounts, "vendas", m));
  const totPessoalM = months.map((m) => sumSectionMonth(map, accounts, "pessoal", m));
  const totDespesasM = months.map((m) => sumSectionMonth(map, accounts, "despesas", m));
  const totComprasM = months.map((m) => sumSectionMonth(map, accounts, "compras", m));
  const lucroM = months.map((_, i) => totVendasM[i] - totPessoalM[i] - totDespesasM[i] - totComprasM[i]);

  const q = (arr: number[]) => quarterSums(arr);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="accent-primary" />
          Mostrar contas sem valores
        </label>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-muted/60 text-left px-3 py-2 font-semibold w-72 min-w-72">Conta</th>
                {MONTHS_PT.map((m) => <th key={m} className="px-2 py-2 text-right font-semibold">{m}</th>)}
                <th className="px-2 py-2 text-right font-bold bg-muted">TOTAL</th>
                {[1,2,3,4].map((qi) => <th key={qi} className="px-2 py-2 text-right font-semibold bg-muted/80">Q{qi}</th>)}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((section) => {
                const all = operationalAccounts.filter((a) => a.section === section.key);
                const accs = showEmpty ? all : all.filter((a) => hasValues(a.code));
                const sectionTotalsM = months.map((m) => sumSectionMonth(map, accounts, section.key, m));

                return (
                  <Fragment key={section.key}>
                    <tr className="bg-primary/5">
                      <td className="sticky left-0 bg-primary/5 px-3 py-1.5 font-semibold text-primary text-[11px] uppercase tracking-wide" colSpan={18}>{section.label}</td>
                    </tr>
                    {accs.map((a) => (
                      <tr key={a.code} className="border-t hover:bg-muted/30">
                        <td className="sticky left-0 bg-card px-3 py-1 text-foreground">
                          <span className="text-muted-foreground tabular-nums mr-2 text-[10px]">{a.code}</span>{a.name}
                        </td>
                        {months.map((m) => (
                          <EditableCell
                            key={m}
                            value={getValue(map, m, a.code)}
                            onCommit={(n) => upsert.mutate({ month: m, account_code: a.code, value: n })}
                            readOnly={readOnly}
                          />
                        ))}
                        <td className="px-2 py-1 text-right text-xs tabular-nums font-medium bg-muted/40">{fmt(months.reduce((s, m) => s + getValue(map, m, a.code), 0))}</td>
                        {q(months.map((m) => getValue(map, m, a.code))).map((qv, qi) => (
                          <td key={qi} className="px-2 py-1 text-right text-xs tabular-nums text-muted-foreground bg-muted/20">{fmt(qv)}</td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="sticky left-0 bg-muted/30 px-3 py-1.5 text-foreground">Total {section.label}</td>
                      {sectionTotalsM.map((v, i) => <td key={i} className="px-2 py-1 text-right text-xs tabular-nums">{fmt(v)}</td>)}
                      <td className="px-2 py-1 text-right text-xs tabular-nums bg-muted/60">{fmt(sumSectionYear(map, accounts, section.key))}</td>
                      {q(sectionTotalsM).map((qv, qi) => <td key={qi} className="px-2 py-1 text-right text-xs tabular-nums bg-muted/40">{fmt(qv)}</td>)}
                    </tr>
                  </Fragment>
                );
              })}

              <tr className="border-t-2 border-primary bg-primary/10 font-bold">
                <td className="sticky left-0 bg-primary/10 px-3 py-2 text-primary">LUCRO MENSAL</td>
                {lucroM.map((v, i) => (
                  <td key={i} className={cn("px-2 py-2 text-right text-xs tabular-nums", v < 0 ? "text-destructive" : "text-foreground")}>{fmt(v)}</td>
                ))}
                <td className={cn("px-2 py-2 text-right text-xs tabular-nums bg-primary/20", lucroM.reduce((s,v)=>s+v,0) < 0 ? "text-destructive" : "")}>{fmt(lucroM.reduce((s,v)=>s+v,0))}</td>
                {q(lucroM).map((qv, qi) => <td key={qi} className={cn("px-2 py-2 text-right text-xs tabular-nums bg-primary/15", qv < 0 ? "text-destructive" : "")}>{fmt(qv)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Dica: clica numa célula para editar. Os valores são gravados ao sair do campo.</p>
    </div>
  );
}
