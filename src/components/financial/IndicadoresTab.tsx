import { useMemo } from "react";
import { useClientFinancialEntries, useClientFinancialSettings, useFinancialAccounts } from "@/hooks/useClientFinancials";
import { buildEntryMap, computeMapaExploracao, fmtEur, fmtPct, MONTHS_PT, sumSectionMonth, sumSectionYear } from "./financialMath";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PIE_COLORS = ["hsl(var(--primary))", "#7c9885", "#d4a574", "#c17c74", "#8b6f5e", "#6ba3c8", "#2dd4a8", "#a78bfa", "#f59e0b", "#ef4444"];

export default function IndicadoresTab({ clientId, year }: { clientId: string; year: number }) {
  const { data: accounts = [] } = useFinancialAccounts();
  const { data: entriesCurrent = [] } = useClientFinancialEntries(clientId, year);
  const { data: entriesPrev = [] } = useClientFinancialEntries(clientId, year - 1);
  const { data: settings } = useClientFinancialSettings(clientId, year);
  const { data: settingsPrev } = useClientFinancialSettings(clientId, year - 1);

  const compute = (entries: any[], s: any) => {
    if (!s) return null;
    const map = buildEntryMap(entries);
    const me = computeMapaExploracao(map, accounts, s);
    const vendas = sumSectionYear(map, accounts, "vendas");
    const pessoal = sumSectionYear(map, accounts, "pessoal_socios") + sumSectionYear(map, accounts, "pessoal_colab");
    const despesas = sumSectionYear(map, accounts, "despesas");
    return {
      vendas,
      pessoal,
      despesas,
      lucro: me.totalResultado,
      rlp: me.totalRLP,
      margemBruta: vendas > 0 ? (vendas - despesas - sumSectionYear(map, accounts, "compras")) / vendas : 0,
      margemLiquida: vendas > 0 ? me.totalRLP / vendas : 0,
      pesoDespesas: vendas > 0 ? despesas / vendas : 0,
      pesoPessoal: vendas > 0 ? pessoal / vendas : 0,
    };
  };

  const cur = useMemo(() => compute(entriesCurrent, settings), [entriesCurrent, settings, accounts]);
  const prev = useMemo(() => compute(entriesPrev, settingsPrev), [entriesPrev, settingsPrev, accounts]);

  const monthly = useMemo(() => {
    const map = buildEntryMap(entriesCurrent);
    return MONTHS_PT.map((m, i) => {
      const month = i + 1;
      const v = sumSectionMonth(map, accounts, "vendas", month);
      const g = sumSectionMonth(map, accounts, "pessoal_socios", month) + sumSectionMonth(map, accounts, "pessoal_colab", month) + sumSectionMonth(map, accounts, "despesas", month) + sumSectionMonth(map, accounts, "compras", month);
      return { mes: m, Faturação: v, Gastos: g, Lucro: v - g };
    });
  }, [entriesCurrent, accounts]);

  const acumulado = useMemo(() => {
    if (!cur || !settings) return [];
    const map = buildEntryMap(entriesCurrent);
    const me = computeMapaExploracao(map, accounts, settings);
    return MONTHS_PT.map((m, i) => ({ mes: m, RLP: Math.round(me.resultadoAcumulado[i] * 100) / 100 }));
  }, [entriesCurrent, accounts, settings, cur]);

  const composicaoDespesas = useMemo(() => {
    const map = buildEntryMap(entriesCurrent);
    return accounts
      .filter((a) => a.section === "despesas")
      .map((a) => ({ name: a.name, value: MONTHS_PT.reduce((s, _, i) => s + (map.get(`${i + 1}:${a.code}`) ?? 0), 0) }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [entriesCurrent, accounts]);

  if (!cur) return <div className="text-muted-foreground text-sm">A calcular...</div>;

  const kpis = [
    { label: "Faturação", cur: cur.vendas, prev: prev?.vendas ?? 0, fmt: fmtEur },
    { label: "Despesas (FSE)", cur: cur.despesas, prev: prev?.despesas ?? 0, fmt: fmtEur, inverse: true },
    { label: "Lucro / RLP", cur: cur.rlp, prev: prev?.rlp ?? 0, fmt: fmtEur },
    { label: "Margem líquida", cur: cur.margemLiquida, prev: prev?.margemLiquida ?? 0, fmt: fmtPct, isPct: true },
    { label: "Margem bruta", cur: cur.margemBruta, prev: prev?.margemBruta ?? 0, fmt: fmtPct, isPct: true },
    { label: "Peso de pessoal", cur: cur.pesoPessoal, prev: prev?.pesoPessoal ?? 0, fmt: fmtPct, isPct: true, inverse: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => {
          const delta = k.isPct ? k.cur - k.prev : (k.prev !== 0 ? (k.cur - k.prev) / Math.abs(k.prev) : 0);
          const good = k.inverse ? delta < 0 : delta > 0;
          return (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">{k.fmt(k.cur)}</div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-muted-foreground">{year - 1}: {k.fmt(k.prev)}</span>
                {k.prev !== 0 && (
                  <span className={good ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>
                    {delta > 0 ? "+" : ""}{k.isPct ? fmtPct(delta) : fmtPct(delta)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <h4 className="font-semibold text-sm mb-3">Faturação vs Gastos por mês</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Faturação" fill="hsl(var(--primary))" />
              <Bar dataKey="Gastos" fill="#c17c74" />
              <Bar dataKey="Lucro" fill="#7c9885" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h4 className="font-semibold text-sm mb-3">RLP acumulado</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={acumulado}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
              <Line type="monotone" dataKey="RLP" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <h4 className="font-semibold text-sm mb-3">Composição de despesas (top 10)</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={composicaoDespesas} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(d: any) => d.name}>
                {composicaoDespesas.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmtEur(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
