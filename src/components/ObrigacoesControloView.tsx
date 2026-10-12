import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, PartyPopper, Search, ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useClients, useCollaborators, useMonthlyObligationsRange, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
import { OBRIGACAO_GROUPS, OBRIGACAO_SUBFILTERS, obrigacoesForClient, isObrigacaoDone, saftModo, ssPagamento, todayYmd, fmtPrazo, type ObrigacaoTask } from "@/lib/obrigacoesControlo";
import { getInitials, getAvatarPalette, shortName } from "@/lib/avatar";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
/** Primeiro mês a que se pode navegar. */
const FIRST_MONTH = "2025-01-01";
/** Primeiro mês contado nos atrasos: antes disto o histórico na app está incompleto
 * (meses feitos mas não marcados), por isso só se veem navegando até eles. */
const START_MONTH = "2026-09-01";
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

interface Missing {
  client: any;
  month: string;
  missing: ObrigacaoTask[];
}

/** Pedido de navegação (ex.: vindo do aviso de prazos): mês e obrigação a mostrar. Um objeto novo por pedido. */
export interface ObrigacoesControloNav {
  month: string;
  group?: string;
}

interface Props {
  /** Abrir o separador da obrigação no mês indicado (e opcionalmente já pesquisado pelo cliente). */
  onOpenObrigacao?: (groupId: string, month: string, clientName?: string) => void;
  nav?: ObrigacoesControloNav | null;
}

/** Controlo interno das Obrigações Mensais: clientes com obrigações por cumprir no
 * mês (por omissão o anterior, cujos prazos caem no mês corrente) e atrasos. */
const ObrigacoesControloView = ({ onOpenObrigacao, nav }: Props) => {
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const [collabFilter, setCollabFilter] = useState("all");
  const [groupFilter, setGroupFilterState] = useState("all");
  // Filtros dentro da obrigação escolhida (ex.: DMR → AT/SS, Guia/Pagamento); "" = todos.
  const [subFilters, setSubFilters] = useState<Record<string, string>>({});
  const setGroupFilter = (id: string) => { setGroupFilterState(id); setSubFilters({}); };
  const [search, setSearch] = useState("");
  const [showLate, setShowLate] = useState(true);
  const { user } = useAuth();
  const upsert = useUpsertObligation();

  // Meses navegáveis: todos, de FIRST_MONTH até ao mês corrente (o de trabalho é o anterior). Índice 0 = mais recente.
  const months = useMemo(() => {
    const now = new Date();
    const out: string[] = [];
    for (let d = new Date(now.getFullYear(), now.getMonth(), 1); monthKey(d) >= FIRST_MONTH; d = new Date(d.getFullYear(), d.getMonth() - 1, 1)) {
      out.push(monthKey(d));
    }
    return out;
  }, []);
  const workMonth = months[1] || months[0];
  const [selMonth, setSelMonth] = useState(workMonth);
  const selIdx = months.indexOf(selMonth);
  useEffect(() => {
    if (!nav) return;
    if (months.includes(nav.month)) setSelMonth(nav.month);
    setGroupFilter(nav.group || "all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);
  const today = todayYmd();
  // Carrega o mês escolhido e os meses anteriores que contam como atrasos.
  const loadMonths = useMemo(() => months.filter((m) => m === selMonth || (m >= START_MONTH && m < selMonth)), [months, selMonth]);
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligationsRange(loadMonths);

  const collabName = (id: string | null) => collaborators.find((c: any) => c.id === id)?.name || "Sem responsável";
  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    return collaborators.find((c: any) => c.email?.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [user, collaborators]);

  const rows = useMemo<Missing[]>(() => {
    const byKey = new Map<string, any>();
    obligations.forEach((o: any) => byKey.set(`${o.client_id}|${o.reference_month}|${o.obligation_type}`, o));
    const out: Missing[] = [];
    for (const client of clients.filter((c: any) => c.active)) {
      for (const month of loadMonths) {
        const missing = obrigacoesForClient(client, month)
          .filter((t) => !isObrigacaoDone(t, byKey.get(`${client.id}|${month}|${t.type}`)));
        if (missing.length > 0) out.push({ client, month, missing });
      }
    }
    return out;
  }, [clients, obligations, loadMonths]);

  // Pesquisa e responsável aplicam-se a tudo; a obrigação só à lista (os cartões mostram cada uma).
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
  // Com uma obrigação escolhida, cada linha mostra só o que falta dessa obrigação.
  const filtered = groupFilter === "all" ? baseFiltered : baseFiltered
    .map((r) => ({
      ...r,
      missing: r.missing.filter((t) => t.group === groupFilter &&
        Object.entries(subFilters).every(([k, v]) => !v || t.meta[k] === v)),
    }))
    .filter((r) => r.missing.length > 0);
  const subFilterDefs = OBRIGACAO_SUBFILTERS[groupFilter] || [];

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

  // Marcar uma obrigação como feita a partir do painel (com Desfazer). A coluna
  // principal usa o status; a segunda (pagamento/envio) usa extra_done.
  const markDone = (r: Missing, t: ObrigacaoTask) => {
    const existing = obligations.find((o: any) =>
      o.client_id === r.client.id && o.reference_month === r.month && o.obligation_type === t.type);
    const base = { ...(existing?.id ? { id: existing.id } : {}), client_id: r.client.id, obligation_type: t.type, reference_month: r.month };
    const patch = t.field === "status"
      ? { status: "concluida", completed_at: new Date().toISOString(), completed_by: user?.id || null }
      : { status: existing?.status ?? "pendente", extra_done: true };
    const undo = t.field === "status"
      ? { status: existing?.status ?? "pendente", completed_at: existing?.completed_at ?? null, completed_by: existing?.completed_by ?? null }
      : { status: existing?.status ?? "pendente", extra_done: existing?.extra_done ?? false };
    upsert.mutate({ ...base, ...patch }, {
      onSuccess: (saved: any) => {
        toast(`${t.label} marcado — ${r.client.name} (${monthLabel(r.month)})`, {
          action: { label: "Desfazer", onClick: () => upsert.mutate({ ...base, id: saved?.id ?? existing?.id, ...undo }) },
        });
      },
      onError: () => toast.error("Não foi possível marcar a obrigação."),
    });
  };

  if (isLoading || loadingObl) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  const groupCount = (id: string) => baseFiltered.filter((r) => r.month === selMonth && (id === "all" || r.missing.some((t) => t.group === id))).length;

  // Prazos de cada obrigação no mês escolhido (podem ser vários: ex. DMR guia dia 10, pagamento dia 20).
  const groupDeadlines: Record<string, string[]> = {};
  clients.filter((c: any) => c.active).forEach((c: any) => obrigacoesForClient(c, selMonth).forEach((t) => {
    const list = (groupDeadlines[t.group] ||= []);
    if (!list.includes(t.deadline)) list.push(t.deadline);
  }));
  Object.values(groupDeadlines).forEach((l) => l.sort());

  const StatCard = ({ id, label }: { id: string; label: string }) => {
    const active = groupFilter === id;
    const n = groupCount(id);
    const prazos = groupDeadlines[id] || [];
    // Em atraso se algum prazo já passou e ainda há falta nessa obrigação.
    const late = n > 0 && baseFiltered.some((r) => r.month === selMonth && r.missing.some((t) => t.group === id && t.deadline < today));
    const isToday = n > 0 && prazos.includes(today);
    return (
      <button type="button" onClick={() => setGroupFilter(active && id !== "all" ? "all" : id)} aria-pressed={active}
        className={cn("flex-1 min-w-[120px] text-left rounded-xl border px-4 py-3 transition-colors",
          active ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/40")}>
        <div className={cn("text-2xl font-bold leading-none", n === 0 ? "text-success" : late ? "text-destructive" : "text-warning")}>{n}</div>
        <div className="text-xs text-muted-foreground mt-1.5">{label}</div>
        {prazos.length > 0 && (
          <div className={cn("text-[11px] mt-1 font-medium", late ? "text-destructive" : isToday ? "text-warning" : "text-muted-foreground")}>
            {late ? "Prazo ultrapassado · " : isToday ? "Hoje · " : "Prazo "}{prazos.map(fmtPrazo).join(" · ")}
          </div>
        )}
      </button>
    );
  };

  const renderRow = (r: Missing, showMonth: boolean) => (
    <div key={`${r.client.id}|${r.month}`} className="flex items-center gap-4 px-4 py-2 border-b last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button type="button" onClick={() => onOpenObrigacao?.(r.missing[0].group, r.month, r.client.name)}
          title={`Abrir ${r.client.name} em ${monthLabel(r.month)}`}
          className="font-medium text-left truncate hover:text-primary">
          {r.client.name}
        </button>
        {showMonth && (
          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive shrink-0">{MONTH_NAMES[Number(r.month.slice(5, 7)) - 1]}</span>
        )}
      </div>
      {groupFilter === "SAFT" && (
        <>
          <div className="w-28 shrink-0 text-sm text-muted-foreground">{saftModo(r.client)}</div>
          <div className="w-40 shrink-0 text-sm text-muted-foreground truncate">{r.client.programa_faturacao || "—"}</div>
        </>
      )}
      {groupFilter === "SS_TI" && <div className="w-40 shrink-0 text-sm text-muted-foreground">{ssPagamento(r.client)}</div>}
      {collabFilter === "all" && (r.client.responsavel_id ? (
        <div title={collabName(r.client.responsavel_id)} className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarPalette(r.client.responsavel_id))}>
          {getInitials(collabName(r.client.responsavel_id))}
        </div>
      ) : <div title="Sem responsável" className="w-6 h-6 rounded-full border border-dashed shrink-0" />)}
      <div className="flex flex-wrap gap-1.5 shrink-0 w-[55%] max-w-4xl">
        {r.missing.map((m) => (
          <button key={`${m.type}|${m.field}`} type="button" onClick={() => markDone(r, m)} disabled={upsert.isPending}
            title={`Marcar ${m.label} como feito — prazo ${fmtPrazo(m.deadline)}${m.deadline < today ? " (ultrapassado)" : ""}`}
            className={cn("w-32 shrink-0 inline-flex items-center justify-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition-colors hover:border-success hover:bg-success/10 hover:text-success disabled:opacity-60",
              m.deadline < today ? "bg-destructive/10 text-destructive border-destructive/30"
                : m.deadline === today ? "bg-warning/15 text-warning border-warning/30"
                : "bg-card text-muted-foreground")}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );

  // Cabeçalho da lista, alinhado com as colunas das linhas.
  const renderHeader = () => (
    <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/60 rounded-t-xl text-xs font-semibold text-muted-foreground">
      <div className="flex-1">Cliente</div>
      {groupFilter === "SAFT" && (
        <>
          <div className="w-28 shrink-0">Modo</div>
          <div className="w-40 shrink-0">Programa</div>
        </>
      )}
      {groupFilter === "SS_TI" && <div className="w-40 shrink-0">Forma de pagamento</div>}
      {collabFilter === "all" && <div className="w-6 shrink-0" />}
      <div className="shrink-0 w-[55%] max-w-4xl">Em falta</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold">Controlo interno — Obrigações</h2>
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
        {OBRIGACAO_GROUPS.map((g) => <StatCard key={g.id} id={g.id} label={g.label} />)}
      </div>

      {subFilterDefs.length > 0 && (
        <div className="flex gap-4 flex-wrap items-center">
          {subFilterDefs.map((def) => (
            <div key={def.key} className="flex rounded-lg border bg-card p-0.5" role="group" aria-label={def.label}>
              {["", ...def.options].map((opt) => {
                const active = (subFilters[def.key] || "") === opt;
                return (
                  <button key={opt || "all"} type="button" aria-pressed={active}
                    onClick={() => setSubFilters((f) => ({ ...f, [def.key]: opt }))}
                    className={cn("px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                    {opt || "Todos"}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

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
                {id === currentCollaborator?.id ? "Eu" : id === "none" ? "Sem responsável" : shortName(name)}
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
          {renderHeader()}
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
              {renderHeader()}
              {lateRows.map((r) => renderRow(r, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ObrigacoesControloView;
