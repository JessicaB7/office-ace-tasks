import { useState, useEffect, useMemo } from "react";
import { useClients, useCollaborators, useMonthlyObligations, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { Search, ChevronLeft, ChevronRight, ChevronDown, Check, PartyPopper, ArrowUpRight, MessageSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import ClientDetailDialog from "@/components/ClientDetailDialog";
import ClientMonthlyHistoryDialog from "@/components/ClientMonthlyHistoryDialog";
import MonthlyNoteCell from "@/components/MonthlyNoteCell";
import { getInitials, getAvatarPalette } from "@/lib/avatar";
import { SUB_PAGE_CONFIG, isObligationSatisfied, isColumnApplicable } from "@/lib/contabilidadesConfig";
import { toast } from "sonner";

const STATUS_FILTER_STORAGE_KEY = "contabilidadesStatusFilter";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Quantos meses para trás (antes do mês corrente) se verificam clientes por fechar. */
const PAST_MONTHS_TO_CHECK = 3;

type ClientTier = "none" | "started" | "done";

/** Separadores da Gestão Mensal (uma só página, um separador por regime). */
const REGIME_TABS: { id: string; label: string }[] = [
  { id: "TI_iva", label: "TI Simplificado - Reg. IVA" },
  { id: "TI_isento", label: "TI Simplificado - Isento IVA" },
  { id: "organizada", label: "TI Organizado" },
  { id: "empresas", label: "Empresas" },
];

const fmtWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";


/** Pedido de navegação vindo de outra vista (ex.: "Em falta"): abre o mês
 * indicado e, opcionalmente, já pesquisado por um cliente. Um objeto novo
 * por pedido, para que cliques repetidos voltem a aplicar. */
export interface ContabilidadesNav {
  month: string;
  search?: string;
}

interface ContabilidadesViewProps {
  subPage?: string;
  /** Mudar de separador (regime) — atualiza a vista ativa da app. */
  onSubPageChange?: (subPage: string) => void;
  nav?: ContabilidadesNav | null;
}

const ContabilidadesView = ({ subPage, onSubPageChange, nav }: ContabilidadesViewProps) => {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { user } = useAuth();

  // Mês de trabalho = mês anterior ao corrente (em outubro fecha-se setembro).
  const now = new Date();
  const workDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [year, setYear] = useState(workDate.getFullYear());
  const [month, setMonth] = useState(workDate.getMonth());
  const isWorkMonth = year === workDate.getFullYear() && month === workDate.getMonth();
  const goToWorkMonth = () => { setYear(workDate.getFullYear()); setMonth(workDate.getMonth()); };
  const [activeTab, setActiveTab] = useState<string>(subPage || "TI_iva");
  const [collabFilter, setCollabFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  // Filtro por estado do cliente no mês (todos os separadores com tarefas).
  type StatusFilter = "all" | ClientTier;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    try {
      const v = localStorage.getItem(STATUS_FILTER_STORAGE_KEY);
      return v === "none" || v === "started" || v === "done" ? v : "all";
    } catch {
      return "all";
    }
  });
  const changeStatusFilter = (v: StatusFilter) => {
    setStatusFilter(v);
    try {
      localStorage.setItem(STATUS_FILTER_STORAGE_KEY, v);
    } catch {
      // localStorage indisponível — a preferência só dura esta sessão
    }
  };

  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligations(referenceMonth);
  const upsert = useUpsertObligation();
  const [showDone, setShowDone] = useState(false);

  const config = SUB_PAGE_CONFIG[activeTab];
  const columns = config?.columns;
  const hasMultiColumns = !!columns && columns.length > 0;
  const hasGallery = config?.gallery ?? false;
  // TI Simplificado - Isento de IVA não tem tarefas mensais a cumprir
  // (não há IVA a entregar) — não faz sentido mostrar pendentes/progresso.
  const noTasksTab = activeTab === "TI_isento";

  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage);
      setCollabFilter("all");
      setSearch("");
    }
  }, [subPage]);

  useEffect(() => {
    if (!nav) return;
    const [y, m] = nav.month.split("-").map(Number);
    setYear(y);
    setMonth(m - 1);
    setSearch(nav.search || "");
    setSelectedClient(null);
  }, [nav]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const activeClients = useMemo(() => clients.filter((c: any) => c.active), [clients]);

  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    return collaborators.find((c: any) => c.email?.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [user, collaborators]);

  const getCollabName = (id: string | null) => {
    if (!id) return "—";
    const col = collaborators.find((c: any) => c.id === id);
    return col ? col.name : "—";
  };

  // Build obligation type keys for each column
  const colOblTypes = useMemo(() => {
    if (!columns) return [];
    return columns.map((col) => `contabilidade_${activeTab}_${col.toLowerCase().replace(/[- ]/g, "_")}`);
  }, [columns, activeTab]);

  const oblType = `contabilidade_${activeTab}`;

  // Build maps for each column
  const colMaps = useMemo(() => {
    return colOblTypes.map((type) => {
      const map: Record<string, any> = {};
      obligations.forEach((o: any) => { if (o.obligation_type === type) map[o.client_id] = o; });
      return map;
    });
  }, [obligations, colOblTypes]);

  // Single column map (for simple tabs)
  const oblMap = useMemo(() => {
    const map: Record<string, any> = {};
    obligations.forEach((o: any) => { if (o.obligation_type === oblType) map[o.client_id] = o; });
    return map;
  }, [obligations, oblType]);

  // Notes map for empresas tab (one row per client/month with obligation_type = 'empresa_notes')
  const notesMap = useMemo(() => {
    const map: Record<string, any> = {};
    obligations.forEach((o: any) => { if (o.obligation_type === "empresa_notes") map[o.client_id] = o; });
    return map;
  }, [obligations]);

  const isClientDoneWith = (c: any, maps: Record<string, any>[], single: Record<string, any>) => {
    if (noTasksTab) return false;
    if (hasMultiColumns) {
      return maps.every((map, i) => isObligationSatisfied(c, columns![i], map[c.id]?.status));
    }
    return single[c.id]?.status === "concluida";
  };
  const isClientDone = (c: any) => isClientDoneWith(c, colMaps, oblMap);

  // Estado do cliente na galeria: concluído, em curso (algum passo concluído
  // ou em andamento) ou por começar — mesma regra das cores do cartão.
  const getClientTier = (c: any): ClientTier => {
    if (isClientDone(c)) return "done";
    const started = (columns || []).some((col, i) => {
      if (!isColumnApplicable(c, col)) return false;
      const st = colMaps[i]?.[c.id]?.status;
      return st === "concluida" || st === "em_andamento";
    });
    return started ? "started" : "none";
  };

  const filteredClients = useMemo(() => {
    if (!config) return [];
    let list = activeClients.filter(config.filter);

    if (collabFilter !== "all") {
      if (collabFilter === "none") {
        list = list.filter((c: any) => !c.responsavel_id);
      } else {
        list = list.filter((c: any) => c.responsavel_id === collabFilter);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c: any) => c.name.toLowerCase().includes(q) || (c.nif || "").includes(q));
    }
    // Pendentes primeiro, depois por nome — facilita ver de imediato o que falta.
    return list.sort((a: any, b: any) => {
      const doneA = isClientDone(a);
      const doneB = isClientDone(b);
      if (doneA !== doneB) return doneA ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClients, config, collabFilter, search, colMaps, oblMap, hasMultiColumns]);

  // TI Isento: distribuição dos clientes do regime por responsável (ignora a
  // pesquisa e o filtro de responsável, para mostrar sempre o total).
  const byResponsavel = useMemo(() => {
    if (!noTasksTab || !config) return [];
    const counts = new Map<string, number>();
    activeClients.filter(config.filter).forEach((c) => {
      const key = c.responsavel_id || "none";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, name: id === "none" ? "Sem responsável" : getCollabName(id) }))
      .sort((a, b) => (a.id === "none" ? 1 : b.id === "none" ? -1 : b.count - a.count));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noTasksTab, config, activeClients, collaborators]);
  const byResponsavelTotal = byResponsavel.reduce((s, r) => s + r.count, 0);

  const toggleObl = (clientId: string, type: string, map: Record<string, any>, label?: string) => {
    const obl = map[clientId];
    const done = obl?.status === "concluida";
    const prev = obl ? { status: obl.status, completed_at: obl.completed_at ?? null, completed_by: obl.completed_by ?? null } : null;
    upsert.mutate({
      client_id: clientId,
      obligation_type: type,
      reference_month: referenceMonth,
      status: done ? "pendente" : "concluida",
      completed_at: done ? null : new Date().toISOString(),
      completed_by: done ? null : user?.id || null,
      ...(obl?.id ? { id: obl.id } : {}),
    }, {
      onSuccess: (saved: any) => {
        const clientName = clients.find((c: any) => c.id === clientId)?.name || "";
        toast(`${label || "Tarefa"} ${done ? "desmarcada" : "marcada"} — ${clientName}`, {
          action: {
            label: "Desfazer",
            onClick: () => upsert.mutate({
              id: saved?.id ?? obl?.id,
              client_id: clientId,
              obligation_type: type,
              reference_month: referenceMonth,
              status: prev?.status ?? "pendente",
              completed_at: prev?.completed_at ?? null,
              completed_by: prev?.completed_by ?? null,
            }),
          },
        });
      },
    });
  };

  const whoDid = (obl: any) => {
    if (!obl?.completed_at) return "";
    const name = collaborators.find((c: any) => c.user_id && c.user_id === obl.completed_by)?.name;
    return `${name ? `${name}, ` : ""}${fmtWhen(obl.completed_at)}`;
  };

  // Progresso do mês (respeita pesquisa e responsável): clientes fechados e tarefas feitas.
  const progress = useMemo(() => {
    if (noTasksTab || !hasMultiColumns) return null;
    let tasks = 0;
    let tasksDone = 0;
    filteredClients.forEach((c: any) => {
      columns!.forEach((col, i) => {
        if (!isColumnApplicable(c, col)) return;
        tasks++;
        if (colMaps[i][c.id]?.status === "concluida") tasksDone++;
      });
    });
    const clientsDone = filteredClients.filter((c: any) => isClientDone(c)).length;
    return { clientsDone, clients: filteredClients.length, tasks, tasksDone, pct: tasks ? Math.round((tasksDone / tasks) * 100) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredClients, colMaps, noTasksTab, hasMultiColumns, columns]);

  const displayedClients = statusFilter === "all" || noTasksTab ? filteredClients : filteredClients.filter((c: any) => getClientTier(c) === statusFilter);

  // Notas mensais só fazem sentido nos separadores em galeria (têm ficha do cliente).
  const showNotes = hasGallery;

  // Empresas, TI Contabilidade Organizada e TI Simplificado - Reg. IVA: selecionar
  // um cliente abre uma aba completa (não um diálogo) com os dados e a tabela de
  // meses sempre visível.
  if ((activeTab === "empresas" || activeTab === "organizada" || activeTab === "TI_iva") && selectedClient) {
    return (
      <ClientMonthlyHistoryDialog
        variant="page"
        client={clients.find((c) => c.id === selectedClient.id) || selectedClient}
        open={true}
        onClose={() => setSelectedClient(null)}
        activeTab={activeTab}
        columns={columns}
        referenceMonth={referenceMonth}
        showNotes={showNotes}
        notesObligation={notesMap[selectedClient.id]}
      />
    );
  }

  const tierCounts = {
    none: filteredClients.filter((c: any) => getClientTier(c) === "none").length,
    started: filteredClients.filter((c: any) => getClientTier(c) === "started").length,
    done: filteredClients.filter((c: any) => getClientTier(c) === "done").length,
  };
  const pendingRows = displayedClients.filter((c: any) => noTasksTab || !isClientDone(c));
  const doneRows = noTasksTab ? [] : displayedClients.filter((c: any) => isClientDone(c));
  // Em "Todos", os fechados ficam numa secção recolhida no fim; no filtro "Fechados" aparecem logo.
  const doneInline = statusFilter === "done";

  const renderRow = (client: any) => {
    const done = !noTasksTab && isClientDone(client);
    const respName = getCollabName(client.responsavel_id);
    const note = notesMap[client.id]?.notes || "";
    return (
      <div key={client.id} className={cn("flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-muted/30 transition-colors", done && "opacity-60")}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button type="button" onClick={() => setSelectedClient(client)} title="Abrir ficha mensal do cliente"
            className="group inline-flex items-center gap-1 min-w-0 font-medium text-left hover:text-primary">
            <span className="truncate">{client.name}</span>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          {showNotes && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" title={note || "Adicionar nota do mês"} aria-label="Notas do mês"
                  className={cn("relative p-1 rounded shrink-0 transition-colors hover:bg-muted",
                    note ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground")}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  {note && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-2">
                <MonthlyNoteCell clientId={client.id} referenceMonth={referenceMonth}
                  obligationId={notesMap[client.id]?.id} initialNotes={note} />
              </PopoverContent>
            </Popover>
          )}
        </div>
        {client.responsavel_id ? (
          <div title={respName} className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarPalette(client.responsavel_id))}>
            {getInitials(respName)}
          </div>
        ) : <div title="Sem responsável" className="w-7 h-7 rounded-full border border-dashed shrink-0" />}
        {hasMultiColumns && !noTasksTab && (
          <div className="flex gap-1.5 shrink-0 justify-end">
            {columns!.map((col, i) => {
              if (!isColumnApplicable(client, col)) {
                return <span key={col} title={`${col}: não aplicável`} className="w-[5.5rem] inline-flex items-center justify-center text-xs text-muted-foreground/30">—</span>;
              }
              const obl = colMaps[i][client.id];
              const isDone = obl?.status === "concluida";
              const started = obl?.status === "em_andamento";
              return (
                <button key={col} type="button" onClick={() => toggleObl(client.id, colOblTypes[i], colMaps[i], col)}
                  title={isDone ? `${col}: feito${whoDid(obl) ? ` — ${whoDid(obl)}` : ""} (clicar para desmarcar)` : `Marcar ${col} como feito`}
                  className={cn("w-[5.5rem] inline-flex items-center justify-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition-colors",
                    isDone ? "bg-success/15 text-success border-success/30 hover:bg-success/25"
                      : started ? "bg-warning/15 text-warning border-warning/30 hover:border-success hover:text-success"
                      : "bg-card text-muted-foreground hover:border-success hover:text-success")}>
                  {isDone && <Check className="w-3 h-3" />}
                  {col}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const StatCard = ({ value, label, filter, tone }: { value: number; label: string; filter: ClientTier; tone: string }) => {
    const active = statusFilter === filter;
    return (
      <button type="button" onClick={() => changeStatusFilter(active ? "all" : filter)} aria-pressed={active}
        className={cn("flex-1 min-w-[120px] text-left rounded-xl border px-4 py-3 transition-colors",
          active ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/40")}>
        <div className={cn("text-2xl font-bold leading-none", tone)}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1.5">{label}</div>
      </button>
    );
  };

  const R = 26;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold">Gestão Mensal de Clientes</h2>
      <div className="flex items-end justify-between gap-4 flex-wrap border-b">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Regime">
          {REGIME_TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} role="tab" aria-selected={active} type="button"
                onClick={() => {
                  setActiveTab(t.id); setCollabFilter("all"); setSearch(""); setSelectedClient(null);
                  onSubPageChange?.(t.id);
                }}
                className={cn("px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pb-2">
          {!isWorkMonth && (
            <button type="button" onClick={goToWorkMonth}
              className="text-xs font-medium px-2 py-1 rounded-full border bg-card hover:bg-muted text-muted-foreground">
              Ir para o mês de trabalho
            </button>
          )}
          <div className="flex items-center gap-1 bg-card rounded-lg border px-1 py-0.5">
            <button onClick={prevMonth} className="p-1 hover:bg-muted rounded transition-colors" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium min-w-[120px] text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className="p-1 hover:bg-muted rounded transition-colors" aria-label="Mês seguinte"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {progress && progress.clients > 0 && (
        <div className="flex gap-3 flex-wrap items-stretch">
          <button type="button" onClick={() => changeStatusFilter("all")} title="Mostrar todos"
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-2 transition-colors hover:bg-muted/40">
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90 shrink-0" aria-hidden>
              <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" className="stroke-muted" />
              <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
                className={cn("transition-all", progress.pct === 100 ? "stroke-success" : "stroke-primary")}
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress.pct / 100)} />
            </svg>
            <div className="text-left">
              <div className="text-2xl font-bold leading-none">{progress.pct}%</div>
              <div className="text-xs text-muted-foreground mt-1.5">{isWorkMonth ? "mês de trabalho" : MONTH_NAMES[month]}</div>
            </div>
          </button>
          <StatCard value={tierCounts.none} label="Por começar" filter="none" tone="text-foreground" />
          <StatCard value={tierCounts.started} label="Em andamento" filter="started" tone="text-warning" />
          <StatCard value={tierCounts.done} label="Fechados" filter="done" tone="text-success" />
        </div>
      )}

      {noTasksTab && byResponsavelTotal > 0 && (
        <div className="bg-card rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Clientes por responsável</span>
            <span className="text-muted-foreground">{byResponsavelTotal} no total</span>
          </div>
          <div className="flex h-9 w-full overflow-hidden rounded-lg">
            {byResponsavel.map((r) => (
              <button
                key={r.id}
                type="button"
                title={`${r.name}: ${r.count}`}
                onClick={() => setCollabFilter((f) => (f === r.id ? "all" : r.id))}
                style={{ flexGrow: r.count, flexBasis: 0 }}
                className={cn(
                  "min-w-[2.25rem] flex items-center justify-center text-xs font-semibold border-r border-card last:border-r-0 transition-opacity",
                  r.id === "none" ? "bg-muted text-muted-foreground" : getAvatarPalette(r.id),
                  collabFilter !== "all" && collabFilter !== r.id && "opacity-40"
                )}
              >
                {r.count}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {byResponsavel.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setCollabFilter((f) => (f === r.id ? "all" : r.id))}
                className={cn("flex items-center gap-1.5 text-xs transition-opacity",
                  collabFilter !== "all" && collabFilter !== r.id && "opacity-40")}
              >
                <span className={cn("w-2.5 h-2.5 rounded-sm", r.id === "none" ? "bg-muted-foreground/40" : getAvatarPalette(r.id))} />
                <span className="text-foreground">{r.name}</span>
                <span className="font-semibold">{r.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={collabFilter} onChange={(e) => setCollabFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os responsáveis</option>
          {currentCollaborator && <option value={currentCollaborator.id}>Os meus clientes</option>}
          {collaborators.filter((c: any) => c.active && c.id !== currentCollaborator?.id).map((col: any) => (
            <option key={col.id} value={col.id}>{col.name}</option>
          ))}
          <option value="none">Sem responsável</option>
        </select>
      </div>

      {progress && progress.pct === 100 && statusFilter === "all" && !search && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          <PartyPopper className="w-4 h-4" /> {MONTH_NAMES[month]} fechado — parabéns!
        </div>
      )}

      {(doneInline ? doneRows : pendingRows).length > 0 ? (
        <div className="bg-card rounded-xl border overflow-hidden">
          {(doneInline ? doneRows : pendingRows).map(renderRow)}
        </div>
      ) : !(progress?.pct === 100 && statusFilter === "all") && (
        <div className="bg-card rounded-xl border px-4 py-12 text-center text-muted-foreground">
          {filteredClients.length > 0 ? "Nenhum cliente neste estado" : "Nenhum cliente encontrado"}
        </div>
      )}

      {statusFilter === "all" && doneRows.length > 0 && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowDone((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("w-4 h-4 transition-transform", !showDone && "-rotate-90")} />
            <Check className="w-4 h-4 text-success" /> Fechados ({doneRows.length})
          </button>
          {showDone && <div className="bg-card rounded-xl border overflow-hidden">{doneRows.map(renderRow)}</div>}
        </div>
      )}

      <ClientDetailDialog client={selectedClient} open={!!selectedClient} onClose={() => setSelectedClient(null)} allowDelete={false} />
    </div>
  );
};

export default ContabilidadesView;
