import { useMemo, useState } from "react";
import { AlertTriangle, PartyPopper, Search, ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useClients, useCollaborators, useMonthlyObligationsRange, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
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
  missing: { col: string; type: string }[];
  total: number;
}

interface Props {
  /** Abrir o regime na tabela "Clientes do mês", no mês indicado (e opcionalmente já pesquisado pelo cliente). */
  onOpenRegime?: (regimeId: string, month: string, clientName?: string) => void;
}

/** Painel da Gestão Mensal: só os clientes com tarefas em falta, do mês de trabalho
 * (mês anterior) para trás — os meses mais antigos são atrasos. */
const GestaoMensalEmFaltaView = ({ onOpenRegime }: Props) => {
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const [collabFilter, setCollabFilter] = useState("all");
  const [regimeFilter, setRegimeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showLate, setShowLate] = useState(true);
  const { user } = useAuth();
  const upsert = useUpsertObligation();

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
  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    return collaborators.find((c: any) => c.email?.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [user, collaborators]);

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
          const missing = cols.filter(({ type }) => !done.has(`${client.id}|${month}|${type}`));
          if (missing.length > 0) out.push({ client, regime, month, missing, total: cols.length });
        }
      }
    }
    return out;
  }, [clients, obligations, months]);

  // Pesquisa e responsável aplicam-se a tudo; o regime só à lista (os cartões mostram cada regime).
  const baseFiltered = useMemo(() => {
    let list = rows;
    if (collabFilter === "none") list = list.filter((r) => !r.client.responsavel_id);
    else if (collabFilter !== "all") list = list.filter((r) => r.client.responsavel_id === collabFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.client.name.toLowerCase().includes(q) || (r.client.nif || "").includes(q));
    }
    return [...list].sort((a, b) => a.client.name.localeCompare(b.client.name, "pt"));
  }, [rows, collabFilter, search]);
  const filtered = regimeFilter === "all" ? baseFiltered : baseFiltered.filter((r) => r.regime.id === regimeFilter);

  const inMonth = filtered.filter((r) => r.month === selMonth);
  // Atrasos: meses anteriores ao escolhido, mais recentes primeiro.
  const lateRows = filtered.filter((r) => r.month < selMonth)
    .sort((a, b) => b.month.localeCompare(a.month) || a.client.name.localeCompare(b.client.name, "pt"));

  // Botões de responsável: quem tem clientes em falta (o próprio primeiro, "Sem responsável" no fim).
  const collabIds = useMemo(() => {
    const rank = (id: string) => (id === currentCollaborator?.id ? 0 : id === "none" ? 2 : 1);
    return [...new Set(rows.map((r) => r.client.responsavel_id || "none"))]
      .sort((a, b) => rank(a) - rank(b) || collabName(a).localeCompare(collabName(b), "pt"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, collaborators, currentCollaborator]);

  // Marcar uma tarefa como feita diretamente a partir do painel (com Desfazer).
  const markDone = (r: Missing, m: { col: string; type: string }) => {
    const existing = obligations.find((o: any) =>
      o.client_id === r.client.id && o.reference_month === r.month && o.obligation_type === m.type);
    const prev = existing ? { status: existing.status, completed_at: existing.completed_at ?? null, completed_by: existing.completed_by ?? null } : null;
    upsert.mutate({
      ...(existing?.id ? { id: existing.id } : {}),
      client_id: r.client.id,
      obligation_type: m.type,
      reference_month: r.month,
      status: "concluida",
      completed_at: new Date().toISOString(),
      completed_by: user?.id || null,
    }, {
      onSuccess: (saved: any) => {
        toast(`${m.col} marcado — ${r.client.name} (${monthLabel(r.month)})`, {
          action: {
            label: "Desfazer",
            onClick: () => upsert.mutate({
              id: saved?.id ?? existing?.id,
              client_id: r.client.id,
              obligation_type: m.type,
              reference_month: r.month,
              status: prev?.status ?? "pendente",
              completed_at: prev?.completed_at ?? null,
              completed_by: prev?.completed_by ?? null,
            }),
          },
        });
      },
      onError: () => toast.error("Não foi possível marcar a tarefa."),
    });
  };

  if (isLoading || loadingObl) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  const regimeCount = (id: string) => baseFiltered.filter((r) => r.month === selMonth && (id === "all" || r.regime.id === id)).length;

  const StatCard = ({ id, label }: { id: string; label: string }) => {
    const active = regimeFilter === id;
    const n = regimeCount(id);
    return (
      <button type="button" onClick={() => setRegimeFilter(active && id !== "all" ? "all" : id)} aria-pressed={active}
        className={cn("flex-1 min-w-[140px] text-left rounded-xl border px-4 py-3 transition-colors",
          active ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/40")}>
        <div className={cn("text-2xl font-bold leading-none", n > 0 ? "text-warning" : "text-success")}>{n}</div>
        <div className="text-xs text-muted-foreground mt-1.5">{label}</div>
      </button>
    );
  };

  const renderRow = (r: Missing, showMonth: boolean) => (
    <div key={`${r.client.id}|${r.month}|${r.regime.id}`} className="flex items-center gap-4 px-4 py-2 border-b last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button type="button" onClick={() => onOpenRegime?.(r.regime.id, r.month, r.client.name)}
          title={`Abrir ${r.client.name} em ${monthLabel(r.month)}`}
          className="font-medium text-left truncate hover:text-primary">
          {r.client.name}
        </button>
        {showMonth && (
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive shrink-0">{MONTH_NAMES[Number(r.month.slice(5, 7)) - 1]}</span>
        )}
        {regimeFilter === "all" && <span className="ml-auto text-xs text-muted-foreground shrink-0">{r.regime.label}</span>}
      </div>
      {collabFilter === "all" && (r.client.responsavel_id ? (
        <div title={collabName(r.client.responsavel_id)} className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarPalette(r.client.responsavel_id))}>
          {getInitials(collabName(r.client.responsavel_id))}
        </div>
      ) : <div title="Sem responsável" className="w-6 h-6 rounded-full border border-dashed shrink-0" />)}
      <div className="flex gap-1.5 shrink-0 w-[55%] max-w-4xl">
        {r.missing.map((m) => (
          <button key={m.type} type="button" onClick={() => markDone(r, m)} disabled={upsert.isPending}
            title={`Marcar ${m.col} como feito`}
            className="w-28 shrink-0 inline-flex items-center justify-center gap-1 text-xs font-medium px-2 py-1 rounded-full border bg-card text-muted-foreground transition-colors hover:border-success hover:bg-success/10 hover:text-success disabled:opacity-60">
            {m.col}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold">Tarefas em falta</h2>
        <div className="flex items-center gap-2 mr-10">
          {selMonth !== workMonth && (
            <button type="button" onClick={() => setSelMonth(workMonth)}
              className="text-xs font-medium px-2 py-1 rounded-full border bg-card hover:bg-muted text-muted-foreground">
              Ir para o mês de trabalho
            </button>
          )}
          <div className="flex items-center gap-1 bg-card rounded-lg border px-1 py-0.5">
            <button type="button" onClick={() => selIdx < months.length - 1 && setSelMonth(months[selIdx + 1])} disabled={selIdx >= months.length - 1}
              className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium min-w-[120px] text-center">{monthLabel(selMonth)}</span>
            <button type="button" onClick={() => selIdx > 0 && setSelMonth(months[selIdx - 1])} disabled={selIdx <= 0}
              className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30" aria-label="Mês seguinte"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <StatCard id="all" label="Clientes em falta" />
        {REGIMES.map((reg) => <StatCard key={reg.id} id={reg.id} label={reg.label} />)}
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar cliente..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Responsável">
          <button type="button" onClick={() => setCollabFilter("all")} aria-pressed={collabFilter === "all"}
            className={cn("px-3 py-1.5 text-sm rounded-full border transition-colors",
              collabFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}>
            Todos
          </button>
          {collabIds.map((id) => {
            const active = collabFilter === id;
            const name = collabName(id);
            return (
              <button key={id} type="button" onClick={() => setCollabFilter(active ? "all" : id)} aria-pressed={active}
                className={cn("flex items-center gap-1.5 pl-1 pr-3 py-1 text-sm rounded-full border transition-colors",
                  active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}>
                <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                  id === "none" ? "bg-muted text-muted-foreground" : getAvatarPalette(id))}>
                  {id === "none" ? "—" : getInitials(name)}
                </span>
                {id === currentCollaborator?.id ? "Eu" : id === "none" ? "Sem responsável" : name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {inMonth.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-6 text-sm font-medium text-success">
          <PartyPopper className="w-4 h-4" /> Nada em falta em {monthLabel(selMonth)}.
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          {inMonth.map((r) => renderRow(r, false))}
        </div>
      )}

      {lateRows.length > 0 && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowLate((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-destructive hover:opacity-80">
            <ChevronDown className={cn("w-4 h-4 transition-transform", !showLate && "-rotate-90")} />
            <AlertTriangle className="w-4 h-4" /> Atrasados de meses anteriores ({lateRows.length})
          </button>
          {showLate && (
            <div className="bg-card rounded-xl border border-destructive/20 overflow-hidden">
              {lateRows.map((r) => renderRow(r, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GestaoMensalEmFaltaView;
