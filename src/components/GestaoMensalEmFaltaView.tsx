import { useMemo, useState } from "react";
import { AlertTriangle, PartyPopper, Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const [collabFilter, setCollabFilter] = useState("all");
  const [regimeFilter, setRegimeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MONTHS_BACK }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - 1 - i, 1)))
      .filter((m) => m >= START_MONTH);
  }, []);
  const workMonth = months[0];
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligationsRange(months);

  const currentCollaborator = useMemo(
    () => collaborators.find((c: any) => user?.email && c.email?.toLowerCase() === user.email.toLowerCase()) || null,
    [collaborators, user],
  );
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

  const late = filtered.filter((r) => r.month !== workMonth);
  const current = filtered.filter((r) => r.month === workMonth);
  const lateClients = new Set(late.map((r) => r.client.id)).size;
  const currentClients = new Set(current.map((r) => r.client.id)).size;

  if (isLoading || loadingObl) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  // Mês → colaborador → regime. O mês de trabalho primeiro, depois os atrasos (mais recentes primeiro).
  const byMonth = months
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Em falta</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Clientes com tarefas por fazer — mês de trabalho ({monthLabel(workMonth)}) e meses anteriores por fechar
          (conta a partir de {monthLabel(START_MONTH)}).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-card rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">Atrasados (meses anteriores)</div>
          <div className={cn("text-3xl font-bold mt-1", lateClients > 0 ? "text-destructive" : "text-success")}>{lateClients}</div>
          <div className="text-xs text-muted-foreground">clientes · {late.length} meses por fechar</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">{monthLabel(workMonth)}</div>
          <div className={cn("text-3xl font-bold mt-1", currentClients > 0 ? "text-warning" : "text-success")}>{currentClients}</div>
          <div className="text-xs text-muted-foreground">clientes com tarefas por fazer</div>
        </div>
      </div>

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
        <select value={collabFilter} onChange={(e) => setCollabFilter(e.target.value)} aria-label="Responsável"
          className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os responsáveis</option>
          {collaborators.filter((c: any) => c.active).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="none">Sem responsável</option>
        </select>
        {currentCollaborator && (
          <button type="button" onClick={() => setCollabFilter((f) => (f === currentCollaborator.id ? "all" : currentCollaborator.id))}
            className={cn("px-3 py-2 text-sm font-medium rounded-lg border whitespace-nowrap transition-colors",
              collabFilter === currentCollaborator.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}>
            Só os meus clientes
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border px-4 py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
          <PartyPopper className="w-4 h-4" /> Nada em falta.
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
