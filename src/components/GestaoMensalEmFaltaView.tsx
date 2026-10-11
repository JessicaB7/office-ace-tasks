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
    return Array.from({ length: MONTHS_BACK }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - 1 - i, 1)));
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

  const Table = ({ items }: { items: Missing[] }) => (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Cliente</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Mês</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Em falta</th>
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Responsável</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={`${r.client.id}-${r.month}-${r.regime.id}`} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{r.client.name}</div>
                  <div className="text-xs text-muted-foreground">{r.regime.label}</div>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{monthLabel(r.month)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {r.missing.map((m) => (
                      <span key={m} className="text-xs font-medium px-2 py-0.5 rounded bg-warning/15 text-warning">{m}</span>
                    ))}
                    {r.missing.length === r.total && <span className="text-xs text-muted-foreground self-center">· nada feito</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  {r.client.responsavel_id ? (
                    <div className="flex items-center gap-2">
                      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarPalette(r.client.responsavel_id))}>
                        {getInitials(collabName(r.client.responsavel_id))}
                      </div>
                      <span className="text-muted-foreground truncate">{collabName(r.client.responsavel_id)}</span>
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-2 py-2.5">
                  {onOpenRegime && (
                    <button type="button" onClick={() => onOpenRegime(r.regime.id)} title={`Abrir ${r.regime.label}`}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Em falta</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Clientes com tarefas por fazer — mês de trabalho ({monthLabel(workMonth)}) e atrasos dos {MONTHS_BACK - 1} meses anteriores.
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
        <>
          {late.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" /> Atrasados <span className="text-xs font-medium text-muted-foreground">({late.length})</span>
              </h3>
              <Table items={late} />
            </section>
          )}
          {current.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-semibold">
                {monthLabel(workMonth)} <span className="text-xs font-medium text-muted-foreground">({current.length})</span>
              </h3>
              <Table items={current} />
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default GestaoMensalEmFaltaView;
