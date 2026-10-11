import { useMemo, useState } from "react";
import { AlertTriangle, PartyPopper, Search, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients, useCollaborators, useMonthlyObligationsRange } from "@/hooks/useSupabaseQuery";
import { SUB_PAGE_CONFIG, obligationTypesFor, isColumnApplicable } from "@/lib/contabilidadesConfig";
import { getInitials, getAvatarPalette } from "@/lib/avatar";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
/** Quantos meses para trás se procuram tarefas em falta (o mês de trabalho é o anterior ao corrente). */
const MONTHS_BACK = 6;
/** Primeiro mês contado: antes disto o histórico na app está incompleto (meses
 * feitos mas não marcados), por isso não entra nos atrasos. */
const START_MONTH = "2026-09-01";
/** Regimes com tarefas mensais (o TI Isento não tem). */
const REGIMES = [
  { id: "TI_iva", label: "TI Simplificado" },
  { id: "organizada", label: "TI Organizado" },
  { id: "empresas", label: "Empresas" },
];

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

interface Missing {
  client: any;
  regime: { id: string; label: string };
  month: string;
  missing: string[];
  total: number;
}

interface Props {
  /** Abrir o regime na tabela "Clientes do mês". */
  onOpenRegime?: (regimeId: string) => void;
}

/** Painel da Gestão Mensal: só os clientes com tarefas em falta, do mês de trabalho
 * (mês anterior) para trás — os meses mais antigos são atrasos. */
const GestaoMensalEmFaltaView = ({ onOpenRegime }: Props) => {
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const [collabFilter, setCollabFilter] = useState("all");
  const [regimeFilter, setRegimeFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Meses disponíveis: do início da contagem até ao mês corrente (o de trabalho é o anterior).
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MONTHS_BACK + 1 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))
      .filter((m) => m >= START_MONTH);
  }, []);
  const workMonth = months.find((m) => m < monthKey(new Date())) || months[months.length - 1];
  const [selMonth, setSelMonth] = useState(workMonth);
  const selIdx = months.indexOf(selMonth);
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligationsRange(months);

  const collabName = (id: string | null) => collaborators.find((c: any) => c.id === id)?.name || "Sem responsável";

  const rows = useMemo<Missing[]>(() => {
    const done = new Set(
      obligations.filter((o: any) => o.status === "concluida").map((o: any) => `${o.client_id}|${o.reference_month}|${o.obligation_type}`),
    );
    const out: Missing[] = [];
    const active = clients.filter((c: any) => c.active);
    for (const regime of REGIMES) {
      const config = SUB_PAGE_CONFIG[regime.id];
      const types = obligationTypesFor(regime.id, config);
      for (const client of active.filter(config.filter)) {
        for (const month of months) {
          // Antes do início do contrato não há nada a fazer.
          if (client.inicio_contrato && client.inicio_contrato.slice(0, 7) > month.slice(0, 7)) continue;
          const cols = (config.columns || []).map((col, i) => ({ col, type: types[i] }))
            .filter(({ col }) => isColumnApplicable(client, col));
          const missing = cols.filter(({ type }) => !done.has(`${client.id}|${month}|${type}`)).map(({ col }) => col);
          if (missing.length > 0) out.push({ client, regime, month, missing, total: cols.length });
        }
      }
    }
    return out;
  }, [clients, obligations, months]);

  const filtered = useMemo(() => {
    let list = rows;
    if (regimeFilter !== "all") list = list.filter((r) => r.regime.id === regimeFilter);
    if (collabFilter === "none") list = list.filter((r) => !r.client.responsavel_id);
    else if (collabFilter !== "all") list = list.filter((r) => r.client.responsavel_id === collabFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.client.name.toLowerCase().includes(q) || (r.client.nif || "").includes(q));
    }
    // Mais antigos primeiro (atrasos no topo), depois por cliente.
    return [...list].sort((a, b) => a.month.localeCompare(b.month) || a.client.name.localeCompare(b.client.name, "pt"));
  }, [rows, regimeFilter, collabFilter, search]);

  const inMonth = filtered.filter((r) => r.month === selMonth);
  const lateBefore = filtered.filter((r) => r.month < selMonth);
  const lateClients = new Set(lateBefore.map((r) => r.client.id)).size;
  // Colaboradores com clientes em falta no mês escolhido (ignora o filtro de colaborador, para os botões).
  const collabCounts = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.month === selMonth && (regimeFilter === "all" || r.regime.id === regimeFilter))
      .forEach((r) => { const k = r.client.responsavel_id || "none"; m.set(k, (m.get(k) || 0) + 1); });
    return m;
  }, [rows, selMonth, regimeFilter]);

  if (isLoading || loadingObl) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  // Mês → colaborador → regime. O mês de trabalho primeiro, depois os atrasos (mais recentes primeiro).
  const byMonth = [selMonth]
    .map((month) => {
      const items = filtered.filter((r) => r.month === month);
      const collabIds = [...new Set(items.map((r) => r.client.responsavel_id || "none"))]
        .sort((a, b) => (a === "none" ? 1 : b === "none" ? -1 : collabName(a).localeCompare(collabName(b), "pt")));
      const collabs = collabIds.map((id) => {
        const mine = items.filter((r) => (r.client.responsavel_id || "none") === id);
        return {
          id,
          name: id === "none" ? "Sem responsável" : collabName(id),
          count: mine.length,
          regimes: REGIMES.map((reg) => ({ ...reg, items: mine.filter((r) => r.regime.id === reg.id) })).filter((g) => g.items.length > 0),
        };
      });
      return { month, items, collabs };
    })
    .filter((m) => m.items.length > 0);

  const collabIdsSorted = [...collabCounts.keys()].sort((a, b) =>
    a === "none" ? 1 : b === "none" ? -1 : collabName(a).localeCompare(collabName(b), "pt"));
  const pill = (active: boolean) => cn("flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors",
    active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted");

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Em falta</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {inMonth.length} clientes com tarefas por fazer em {monthLabel(selMonth)}
            {selMonth === workMonth && " (mês de trabalho)"}.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg border px-2 py-1">
          <button type="button" onClick={() => selIdx < months.length - 1 && setSelMonth(months[selIdx + 1])} disabled={selIdx >= months.length - 1}
            className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthLabel(selMonth)}</span>
          <button type="button" onClick={() => selIdx > 0 && setSelMonth(months[selIdx - 1])} disabled={selIdx <= 0}
            className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30" aria-label="Mês seguinte"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap" role="group" aria-label="Colaborador">
        <button type="button" onClick={() => setCollabFilter("all")} className={pill(collabFilter === "all")}>
          Todos <span className="text-xs opacity-70">{[...collabCounts.values()].reduce((a, b) => a + b, 0)}</span>
        </button>
        {collabIdsSorted.map((id) => (
          <button key={id} type="button" onClick={() => setCollabFilter((f) => (f === id ? "all" : id))} className={pill(collabFilter === id)}>
            {id === "none" ? "Sem responsável" : collabName(id)} <span className="text-xs opacity-70">{collabCounts.get(id)}</span>
          </button>
        ))}
      </div>

      {lateClients > 0 && (
        <div className="flex items-center gap-2 text-sm rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {lateClients} clientes têm ainda meses anteriores a {monthLabel(selMonth)} por fechar — usa as setas do mês para os ver.
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar cliente..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={regimeFilter} onChange={(e) => setRegimeFilter(e.target.value)} aria-label="Regime"
          className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os regimes</option>
          {REGIMES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>

      {inMonth.length === 0 ? (
        <div className="bg-card rounded-xl border px-4 py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
          <PartyPopper className="w-4 h-4" /> Nada em falta em {monthLabel(selMonth)}.
        </div>
      ) : (
        <div className="space-y-8">
          {byMonth.map(({ month, items, collabs }) => {
            const isLate = month !== workMonth;
            return (
              <section key={month} className="space-y-3">
                <h3 className={cn("text-lg font-semibold flex items-center gap-2", isLate && "text-destructive")}>
                  {isLate && <AlertTriangle className="w-4 h-4" />}
                  {monthLabel(month)}
                  {isLate && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/15">atrasado</span>}
                  <span className="text-sm font-medium text-muted-foreground">· {items.length} clientes em falta</span>
                </h3>
                <div className="grid gap-4 lg:grid-cols-2">
                  {collabs.map((col) => (
                    <div key={col.id} className="bg-card rounded-xl border overflow-hidden">
                      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/30">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0",
                          col.id === "none" ? "bg-muted text-muted-foreground" : getAvatarPalette(col.id))}>
                          {col.id === "none" ? "—" : getInitials(col.name)}
                        </div>
                        <span className="font-semibold flex-1">{col.name}</span>
                        <span className="text-sm font-semibold text-warning">{col.count}</span>
                      </div>
                      <div className="divide-y">
                        {col.regimes.map((reg) => (
                          <div key={reg.id} className="px-4 py-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {reg.label} · {reg.items.length}
                              </span>
                              {onOpenRegime && (
                                <button type="button" onClick={() => onOpenRegime(reg.id)} title={`Abrir ${reg.label}`}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <ul className="space-y-1">
                              {reg.items.map((r) => (
                                <li key={r.client.id} className="flex items-center gap-2 flex-wrap text-sm">
                                  <span className="font-medium">{r.client.name}</span>
                                  <span className="flex flex-wrap gap-1">
                                    {r.missing.length === r.total ? (
                                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">nada feito</span>
                                    ) : r.missing.map((m) => (
                                      <span key={m} className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-warning/15 text-warning">{m}</span>
                                    ))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GestaoMensalEmFaltaView;
