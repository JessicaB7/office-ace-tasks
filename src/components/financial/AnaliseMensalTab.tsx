import { Fragment, useEffect, useMemo, useState } from "react";
import { useFinancialAccounts, useClientFinancialEntries, useUpsertEntry, type FinancialAccount } from "@/hooks/useClientFinancials";
import { buildEntryMap, getValue, MONTHS_PT, fmt, quarterSums } from "./financialMath";
import { cn } from "@/lib/utils";

type Group = {
  key: string;
  label: string;
  /** Cabeçalho de grupo (ex.: FSE) com rubricas por baixo */
  subgroups?: { key: string; label: string; match: (code: string) => boolean }[];
  match?: (code: string) => boolean;
  section?: FinancialAccount["section"];
};

const isFse = (c: string) => c === "62" || c.startsWith("62");

const GROUPS: Group[] = [
  { key: "vendas", label: "Faturação", section: "vendas", match: () => true },
  { key: "pessoal", label: "Gastos com pessoal", section: "pessoal", match: () => true },
  {
    key: "fse",
    label: "Fornecimentos e serviços externos",
    section: "despesas",
    match: isFse,
    subgroups: [
      { key: "fse_esp", label: "Serviços especializados", match: (c) => c.startsWith("621") || c.startsWith("622") },
      { key: "fse_mat", label: "Materiais", match: (c) => c.startsWith("623") },
      { key: "fse_energia", label: "Energia e fluidos", match: (c) => c.startsWith("624") },
      { key: "fse_desloc", label: "Deslocações, estadas e transportes", match: (c) => c.startsWith("625") },
      { key: "fse_div", label: "Serviços diversos", match: (c) => c.startsWith("626") },
      {
        key: "fse_outros",
        label: "Outros fornecimentos e serviços",
        match: (c) =>
          isFse(c) &&
          !["621", "622", "623", "624", "625", "626"].some((p) => c.startsWith(p)),
      },
    ],
  },
  { key: "cmvmc", label: "Custo das mercadorias vendidas e matérias consumidas", section: "despesas", match: (c) => c.startsWith("61") },
  { key: "ajudas", label: "Ajudas de custo e deslocações (pessoal)", section: "despesas", match: (c) => c.startsWith("63") },
  { key: "depreciacoes", label: "Depreciações e amortizações", section: "despesas", match: (c) => c.startsWith("64") },
  { key: "outros", label: "Outros gastos", section: "despesas", match: (c) => c.startsWith("65") || c.startsWith("67") || c.startsWith("68") },
  { key: "financiamento", label: "Gastos de financiamento", section: "despesas", match: (c) => c.startsWith("69") },
  { key: "compras", label: "Compra de Material", section: "compras", match: () => true },
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
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const hasValues = (code: string) => months.some((m) => getValue(map, m, code) !== 0);

  const accountsOf = (g: Group | Group["subgroups"][number], section?: FinancialAccount["section"]) =>
    accounts.filter((a) => {
      const sec = (g as Group).section ?? section;
      if (sec && a.section !== sec) return false;
      const match = (g as any).match as ((c: string) => boolean) | undefined;
      return match ? match(a.code) : true;
    });

  const monthlyOf = (accs: FinancialAccount[]) => months.map((m) => accs.reduce((s, a) => s + getValue(map, m, a.code), 0));

  const groupMonthly = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const g of GROUPS) out[g.key] = monthlyOf(accountsOf(g));
    return out;
  }, [accounts, map]);

  const lucroM = months.map((_, i) =>
    groupMonthly["vendas"][i] -
    GROUPS.filter((g) => g.key !== "vendas").reduce((s, g) => s + groupMonthly[g.key][i], 0)
  );

  const q = (arr: number[]) => quarterSums(arr);
  const total = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

  const renderAccountRow = (a: FinancialAccount, indent: boolean) => (
    <tr key={a.code} className="border-t hover:bg-muted/30">
      <td className={cn("sticky left-0 bg-card px-3 py-1 text-foreground", indent && "pl-8")}>
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
      <td className="px-2 py-1 text-right text-xs tabular-nums font-medium bg-muted/40">{fmt(total(months.map((m) => getValue(map, m, a.code))))}</td>
      {q(months.map((m) => getValue(map, m, a.code))).map((qv, qi) => (
        <td key={qi} className="px-2 py-1 text-right text-xs tabular-nums text-muted-foreground bg-muted/20">{fmt(qv)}</td>
      ))}
    </tr>
  );

  const renderTotalRow = (label: string, monthly: number[], strong: boolean) => (
    <tr className={cn("border-t font-semibold", strong ? "bg-muted/40" : "bg-muted/20")}>
      <td className={cn("sticky left-0 px-3 py-1.5 text-foreground", strong ? "bg-muted/40" : "bg-muted/20 pl-8 text-[11px]")}>{label}</td>
      {monthly.map((v, i) => <td key={i} className="px-2 py-1 text-right text-xs tabular-nums">{fmt(v)}</td>)}
      <td className="px-2 py-1 text-right text-xs tabular-nums bg-muted/60">{fmt(total(monthly))}</td>
      {q(monthly).map((qv, qi) => <td key={qi} className="px-2 py-1 text-right text-xs tabular-nums bg-muted/40">{fmt(qv)}</td>)}
    </tr>
  );

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
              {GROUPS.map((g) => {
                const all = accountsOf(g);
                const visible = showEmpty ? all : all.filter((a) => hasValues(a.code));
                if (!visible.length && !showEmpty) {
                  return null;
                }
                return (
                  <Fragment key={g.key}>
                    <tr className="bg-primary/5">
                      <td className="sticky left-0 bg-primary/5 px-3 py-1.5 font-semibold text-primary text-[11px] uppercase tracking-wide" colSpan={18}>{g.label}</td>
                    </tr>
                    {g.subgroups
                      ? g.subgroups.map((sg) => {
                          const sgAll = accountsOf(sg as any, g.section).filter((a) => (g.match ? g.match(a.code) : true));
                          const sgVisible = showEmpty ? sgAll : sgAll.filter((a) => hasValues(a.code));
                          if (!sgVisible.length) return null;
                          return (
                            <Fragment key={sg.key}>
                              <tr className="bg-muted/10">
                                <td className="sticky left-0 bg-muted/10 px-3 py-1 pl-6 font-medium text-[11px] text-foreground/80" colSpan={18}>{sg.label}</td>
                              </tr>
                              {sgVisible.map((a) => renderAccountRow(a, true))}
                              {renderTotalRow(`Subtotal ${sg.label}`, monthlyOf(sgAll), false)}
                            </Fragment>
                          );
                        })
                      : visible.map((a) => renderAccountRow(a, false))}
                    {renderTotalRow(`Total ${g.label}`, groupMonthly[g.key], true)}
                  </Fragment>
                );
              })}

              <tr className="border-t-2 border-primary bg-primary/10 font-bold">
                <td className="sticky left-0 bg-primary/10 px-3 py-2 text-primary">LUCRO MENSAL</td>
                {lucroM.map((v, i) => (
                  <td key={i} className={cn("px-2 py-2 text-right text-xs tabular-nums", v < 0 ? "text-destructive" : "text-foreground")}>{fmt(v)}</td>
                ))}
                <td className={cn("px-2 py-2 text-right text-xs tabular-nums bg-primary/20", total(lucroM) < 0 ? "text-destructive" : "")}>{fmt(total(lucroM))}</td>
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
