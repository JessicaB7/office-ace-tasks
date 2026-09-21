import { useState, useMemo } from "react";
import { BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Clock, PartyPopper, UserCircle2, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useClients, useCollaborators, useMonthlyObligations, useMonthlyObligationsRange, useTimeEntriesRange } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
import { SUB_PAGE_CONFIG, obligationTypesFor } from "@/lib/contabilidadesConfig";
import { getInitials, getAvatarPalette } from "@/lib/avatar";
import { formatDurationCompact } from "@/lib/formatDuration";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Intervalo fixo pedido para o gráfico de evolução — Julho a Dezembro de 2026.
const TREND_RANGE = [
  { key: "2026-07-01", label: "Jul 26" },
  { key: "2026-08-01", label: "Ago 26" },
  { key: "2026-09-01", label: "Set 26" },
  { key: "2026-10-01", label: "Out 26" },
  { key: "2026-11-01", label: "Nov 26" },
  { key: "2026-12-01", label: "Dez 26" },
];

// Mesma paleta categórica já usada em toda a app para estes 3 regimes
// (ver ObrigacoesView/ClientListView): TI RS verde, TI CO âmbar, SQ/Empresas azul.
const REGIME_STYLE: Record<string, { color: string; short: string }> = {
  TI_iva: { color: "#10b981", short: "TI RS" },
  organizada: { color: "#f59e0b", short: "TI CO" },
  empresas: { color: "#3b82f6", short: "Empresas" },
};

// Mesma paleta de estados já usada em ClientListView.
const STATUS_STYLE: Record<string, { label: string; dot: string; text: string }> = {
  ativo: { label: "Ativo", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  a_sair: { label: "A sair", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  inativo: { label: "Inativo", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};
const clientStatus = (c: any): string => c.status || (c.active === false ? "inativo" : "ativo");

// Regimes com obrigações mensais reais (mesmos que têm galeria) — TI Isento
// fica de fora, não tem tarefas a cumprir.
const REGIME_KEYS = Object.entries(SUB_PAGE_CONFIG).filter(([, cfg]) => cfg.gallery);

const RadialProgress = ({ pct, color, size = 56, stroke = 5 }: { pct: number; color: string; size?: number; stroke?: number }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          style={{ stroke: color }} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{pct}%</div>
    </div>
  );
};

const StatTile = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent: string }) => (
  <div className="bg-card rounded-2xl border p-4 flex items-center gap-3">
    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", accent)}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-bold leading-tight">{value}</div>
      <div className="text-xs text-muted-foreground truncate">{label}</div>
    </div>
  </div>
);

const ContabilidadesPainelView = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [collabFilter, setCollabFilter] = useState<string>("all");
  const [regimeFilter, setRegimeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { user, isAdmin } = useAuth();
  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: obligations = [] } = useMonthlyObligations(referenceMonth);

  // Colaborador correspondente ao utilizador com sessão iniciada — quem não é
  // admin só pode ver os próprios clientes neste painel.
  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    return collaborators.find((c: any) => c.email?.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [user, collaborators]);

  const visibleRegimeKeys = useMemo(() =>
    regimeFilter === "all" ? REGIME_KEYS : REGIME_KEYS.filter(([key]) => key === regimeFilter),
  [regimeFilter]);

  // Todos os clientes dos regimes visíveis (qualquer estado), já filtrados por
  // responsável e estado — usados para os KPIs e o resumo de "estado dos clientes".
  const scopedAllClients = useMemo(() => {
    let list = clients as any[];
    if (isAdmin) {
      if (collabFilter === "none") list = list.filter((c) => !c.responsavel_id);
      else if (collabFilter !== "all") list = list.filter((c) => c.responsavel_id === collabFilter);
    } else {
      // Não-admin: só os clientes de que é responsável, sem exceção.
      list = list.filter((c) => c.responsavel_id === currentCollaborator?.id);
    }
    if (statusFilter !== "all") list = list.filter((c) => clientStatus(c) === statusFilter);
    return list.filter((c) => visibleRegimeKeys.some(([, cfg]) => cfg.filter(c)));
  }, [clients, isAdmin, collabFilter, currentCollaborator, statusFilter, visibleRegimeKeys]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ativo: 0, a_sair: 0, inativo: 0 };
    scopedAllClients.forEach((c) => { counts[clientStatus(c)] = (counts[clientStatus(c)] || 0) + 1; });
    return counts;
  }, [scopedAllClients]);

  // Clientes ativos (ativo + a sair) — só estes têm obrigações mensais a cumprir.
  const activeClients = useMemo(() => scopedAllClients.filter((c) => c.active), [scopedAllClients]);

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

  const overallTotal = regimeSummaries.reduce((s, r) => s + r.total, 0);
  const overallDone = regimeSummaries.reduce((s, r) => s + r.doneCount, 0);
  const overallPending = overallTotal - overallDone;
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

  const { data: rangeObligations = [] } = useMonthlyObligationsRange(TREND_RANGE.map((m) => m.key));

  const trendData = useMemo(() => {
    return TREND_RANGE.map((m) => {
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
  }, [rangeObligations, activeClients, visibleRegimeKeys]);

  // Clientes de todos os regimes/estados visíveis, ignorando o filtro de
  // responsável — só para a repartição "Por colaborador" (admin).
  const collaboratorScopedClients = useMemo(() => {
    let list = clients as any[];
    if (statusFilter !== "all") list = list.filter((c) => clientStatus(c) === statusFilter);
    return list.filter((c) => c.active && visibleRegimeKeys.some(([, cfg]) => cfg.filter(c)));
  }, [clients, statusFilter, visibleRegimeKeys]);

  // Tempo de trabalho registado (cronómetro) no mês em curso, por colaborador
  // — só entradas já terminadas (uma em curso conta a partir do momento em
  // que for parada).
  const monthStartISO = `${referenceMonth}T00:00:00.000Z`;
  const monthEndISO = new Date(year, month + 1, 1).toISOString();
  const { data: monthTimeEntries = [] } = useTimeEntriesRange(monthStartISO, monthEndISO);

  const timeByCollaborator = useMemo(() => {
    const totals = new Map<string, number>();
    monthTimeEntries.forEach((e) => {
      if (!e.ended_at || !e.collaborator_id) return;
      const ms = new Date(e.ended_at).getTime() - new Date(e.started_at).getTime();
      totals.set(e.collaborator_id, (totals.get(e.collaborator_id) || 0) + ms);
    });
    return totals;
  }, [monthTimeEntries]);

  const collaboratorBreakdown = useMemo(() => {
    if (!isAdmin) return [];
    const byCollab = new Map<string, any[]>();
    collaboratorScopedClients.forEach((c: any) => {
      const key = c.responsavel_id || "__none__";
      if (!byCollab.has(key)) byCollab.set(key, []);
      byCollab.get(key)!.push(c);
    });

    const rows = Array.from(byCollab.entries()).map(([collabId, list]) => {
      let done = 0, total = 0;
      list.forEach((c: any) => {
        visibleRegimeKeys.forEach(([key, cfg]) => {
          if (!cfg.filter(c)) return;
          total++;
          const obTypes = obligationTypesFor(key, cfg);
          const isDone = obTypes.every((t) =>
            obligations.some((o: any) => o.client_id === c.id && o.obligation_type === t && o.status === "concluida"));
          if (isDone) done++;
        });
      });
      const collab = collaborators.find((c: any) => c.id === collabId);
      return {
        id: collabId, name: collab ? collab.name : "Sem responsável",
        total, done, pending: total - done,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        timeMs: timeByCollaborator.get(collabId) || 0,
      };
    });

    return rows.sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
  }, [isAdmin, collaboratorScopedClients, visibleRegimeKeys, obligations, collaborators, timeByCollaborator]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Painel — Gestão Mensal</h2>
            <p className="text-sm text-muted-foreground">Análise geral de todos os clientes, por mês</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg border px-2 py-1">
          <button onClick={prevMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        {isAdmin ? (
          <select value={collabFilter} onChange={(e) => setCollabFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">Todos os responsáveis</option>
            {collaborators.filter((c: any) => c.active).map((col: any) => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
            <option value="none">Sem responsável</option>
          </select>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border bg-card text-muted-foreground">
            <UserCircle2 className="w-4 h-4" /> Só os teus clientes
          </span>
        )}
        <select value={regimeFilter} onChange={(e) => setRegimeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os regimes</option>
          {REGIME_KEYS.map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os estados</option>
          <option value="ativo">Ativo</option>
          <option value="a_sair">A sair</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Users} label="Clientes com obrigações" value={overallTotal} accent="bg-primary/10 text-primary" />
        <StatTile icon={CheckCircle2} label="Concluído este mês" value={`${overallPct}%`} accent="bg-success/15 text-success" />
        <StatTile icon={Clock} label="Ainda pendentes" value={overallPending} accent="bg-warning/15 text-warning" />
        <div className="bg-card rounded-2xl border p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Estado dos clientes</div>
          <div className="space-y-1.5">
            {(["ativo", "a_sair", "inativo"] as const).map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={cn("w-2 h-2 rounded-full", STATUS_STYLE[s].dot)} />
                  {STATUS_STYLE[s].label}
                </span>
                <span className={cn("font-semibold", STATUS_STYLE[s].text)}>{statusCounts[s] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {regimeSummaries.map((r) => (
          <div key={r.key} className="relative bg-card rounded-2xl border p-5 space-y-4 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: REGIME_STYLE[r.key].color }} />
            <div className="flex items-center gap-3">
              <RadialProgress pct={r.pct} color={REGIME_STYLE[r.key].color} />
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{r.label}</h3>
                <div className="text-xs text-muted-foreground">{r.doneCount}/{r.total} clientes concluídos</div>
              </div>
            </div>
            {r.pendingClients.length > 0 ? (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Pendentes ({r.pendingClients.length})
                </div>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {r.pendingClients.map((c: any) => (
                    <li key={c.id} className="flex items-center gap-2 text-xs">
                      <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0", getAvatarPalette(c.id))}>
                        {getInitials(c.name)}
                      </span>
                      <span className="truncate text-muted-foreground">{c.name}</span>
                    </li>
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

      <div className="bg-card rounded-2xl border p-4">
        <h3 className="font-semibold text-sm mb-3">Evolução da conclusão — Julho a Dezembro de 2026</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trendData}>
            <defs>
              {visibleRegimeKeys.map(([key]) => (
                <linearGradient key={key} id={`painel-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={REGIME_STYLE[key].color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={REGIME_STYLE[key].color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
            <XAxis dataKey="mes" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} unit="%" domain={[0, 100]} tickLine={false} axisLine={false} width={36} />
            <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            {visibleRegimeKeys.map(([key]) => (
              <Area key={key} type="monotone" dataKey={REGIME_STYLE[key].short}
                stroke={REGIME_STYLE[key].color} strokeWidth={2}
                fill={`url(#painel-grad-${key})`} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {isAdmin && (
        <div className="bg-card rounded-2xl border p-4">
          <h3 className="font-semibold text-sm">Por colaborador</h3>
          <p className="text-xs text-muted-foreground mb-3">Progresso e tempo de trabalho registado (cronómetro) em {MONTH_NAMES[month]}</p>
          {collaboratorBreakdown.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sem dados para os filtros escolhidos.</div>
          ) : (
            <div className="space-y-1">
              {collaboratorBreakdown.map((row) => (
                <div key={row.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                    row.id === "__none__" ? "bg-muted text-muted-foreground" : getAvatarPalette(row.id))}>
                    {row.id === "__none__" ? "—" : getInitials(row.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{row.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={row.pct} className={cn("h-1.5 flex-1", row.pct === 100 && "[&>div]:bg-success")} />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{row.done}/{row.total}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {row.timeMs > 0 ? formatDurationCompact(row.timeMs) : "—"}
                  </span>
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
                    row.pct === 100 ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {row.pct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContabilidadesPainelView;
