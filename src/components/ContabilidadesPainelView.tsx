import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useClients, useCollaborators, useMonthlyObligations, useMonthlyObligationsRange } from "@/hooks/useSupabaseQuery";
import { SUB_PAGE_CONFIG, obligationTypesFor } from "@/lib/contabilidadesConfig";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const TREND_MONTHS = 6;

// Mesma paleta categórica já usada em toda a app para estes 3 regimes
// (ver ObrigacoesView/ClientListView): TI RS verde, TI CO âmbar, SQ/Empresas azul.
const REGIME_STYLE: Record<string, { color: string; short: string; dot: string }> = {
  TI_iva: { color: "#10b981", short: "TI RS", dot: "bg-emerald-500" },
  organizada: { color: "#f59e0b", short: "TI CO", dot: "bg-amber-500" },
  empresas: { color: "#3b82f6", short: "Empresas", dot: "bg-blue-500" },
};

// Regimes com obrigações mensais reais (mesmos que têm galeria) — TI Isento
// fica de fora, não tem tarefas a cumprir.
const REGIME_KEYS = Object.entries(SUB_PAGE_CONFIG).filter(([, cfg]) => cfg.gallery);

const ContabilidadesPainelView = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [collabFilter, setCollabFilter] = useState<string>("all");
  const [regimeFilter, setRegimeFilter] = useState<string>("all");

  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: obligations = [] } = useMonthlyObligations(referenceMonth);

  const activeClients = useMemo(() => {
    let list = clients.filter((c: any) => c.active);
    if (collabFilter === "none") list = list.filter((c: any) => !c.responsavel_id);
    else if (collabFilter !== "all") list = list.filter((c: any) => c.responsavel_id === collabFilter);
    return list;
  }, [clients, collabFilter]);

  const visibleRegimeKeys = useMemo(() =>
    regimeFilter === "all" ? REGIME_KEYS : REGIME_KEYS.filter(([key]) => key === regimeFilter),
  [regimeFilter]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const regimeSummaries = useMemo(() => {
    return visibleRegimeKeys.map(([key, cfg]) => {
      const tabClients = activeClients.filter(cfg.filter);
      const obTypes = obligationTypesFor(key, cfg);
      const doneTypesByClient = new Map<string, Set<string>>();
      obligations.forEach((o: any) => {
        if (o.status !== "concluida" || !obTypes.includes(o.obligation_type)) return;
        if (!doneTypesByClient.has(o.client_id)) doneTypesByClient.set(o.client_id, new Set());
        doneTypesByClient.get(o.client_id)!.add(o.obligation_type);
      });
      const pendingClients: any[] = [];
      let doneCount = 0;
      tabClients.forEach((c: any) => {
        const done = doneTypesByClient.get(c.id);
        const isDone = !!done && obTypes.every((t) => done.has(t));
        if (isDone) doneCount++; else pendingClients.push(c);
      });
      return {
        key, label: cfg.label, total: tabClients.length, doneCount, pendingClients,
        pct: tabClients.length > 0 ? Math.round((doneCount / tabClients.length) * 100) : 0,
      };
    });
  }, [activeClients, obligations, visibleRegimeKeys]);

  const trendMonths = useMemo(() => {
    const arr: { key: string; label: string }[] = [];
    for (let i = TREND_MONTHS - 1; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      arr.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
        label: `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      });
    }
    return arr;
  }, [year, month]);

  const { data: rangeObligations = [] } = useMonthlyObligationsRange(trendMonths.map((m) => m.key));

  const trendData = useMemo(() => {
    return trendMonths.map((m) => {
      const monthObls = rangeObligations.filter((o: any) => o.reference_month === m.key);
      const row: Record<string, number | string> = { mes: m.label };
      visibleRegimeKeys.forEach(([key, cfg]) => {
        const tabClients = activeClients.filter(cfg.filter);
        const obTypes = obligationTypesFor(key, cfg);
        const doneCount = tabClients.filter((c: any) =>
          obTypes.every((t) => monthObls.some((o: any) => o.client_id === c.id && o.obligation_type === t && o.status === "concluida"))
        ).length;
        row[REGIME_STYLE[key].short] = tabClients.length > 0 ? Math.round((doneCount / tabClients.length) * 100) : 0;
      });
      return row;
    });
  }, [trendMonths, rangeObligations, activeClients, visibleRegimeKeys]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Painel — Gestão Mensal</h2>
          <p className="text-sm text-muted-foreground mt-1">Análise geral de todos os clientes, por mês</p>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg border px-2 py-1">
          <button onClick={prevMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <select value={collabFilter} onChange={(e) => setCollabFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os responsáveis</option>
          {collaborators.filter((c: any) => c.active).map((col: any) => (
            <option key={col.id} value={col.id}>{col.name}</option>
          ))}
          <option value="none">Sem responsável</option>
        </select>
        <select value={regimeFilter} onChange={(e) => setRegimeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os regimes</option>
          {REGIME_KEYS.map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
      </div>

      <div className={cn("grid grid-cols-1 gap-4", visibleRegimeKeys.length > 1 && "md:grid-cols-3")}>
        {regimeSummaries.map((r) => (
          <div key={r.key} className="bg-card rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", REGIME_STYLE[r.key].dot)} />
                <h3 className="font-semibold text-sm truncate">{r.label}</h3>
              </div>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
                r.pct === 100 ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                {r.pct}%
              </span>
            </div>
            <Progress value={r.pct} className={cn("h-1.5", r.pct === 100 && "[&>div]:bg-success")} />
            <div className="text-xs text-muted-foreground">{r.doneCount}/{r.total} clientes concluídos</div>
            {r.pendingClients.length > 0 ? (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Pendentes ({r.pendingClients.length})
                </div>
                <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {r.pendingClients.map((c: any) => (
                    <li key={c.id} className="truncate text-muted-foreground">{c.name}</li>
                  ))}
                </ul>
              </div>
            ) : r.total > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-success font-medium">
                <PartyPopper className="w-3.5 h-3.5" /> Tudo concluído
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Sem clientes</div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border p-4">
        <h3 className="font-semibold text-sm mb-3">Evolução da conclusão — últimos {TREND_MONTHS} meses</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="mes" fontSize={11} />
            <YAxis fontSize={11} unit="%" domain={[0, 100]} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {visibleRegimeKeys.map(([key]) => (
              <Line key={key} type="monotone" dataKey={REGIME_STYLE[key].short}
                stroke={REGIME_STYLE[key].color} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ContabilidadesPainelView;
