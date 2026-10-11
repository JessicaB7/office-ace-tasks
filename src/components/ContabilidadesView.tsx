import { useState, useEffect, useMemo } from "react";
import { useClients, useCollaborators, useMonthlyObligations, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { Search, ChevronLeft, ChevronRight, Check, PartyPopper, Clock, CheckCircle2, AlertTriangle, UserCircle2, ChevronDown, CircleDashed, Loader, Table2, LayoutGrid, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import ClientDetailDialog from "@/components/ClientDetailDialog";
import ClientMonthlyHistoryDialog from "@/components/ClientMonthlyHistoryDialog";
import MonthlyNoteCell from "@/components/MonthlyNoteCell";
import ClientObligationCard from "@/components/ClientObligationCard";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getInitials, getAvatarPalette } from "@/lib/avatar";
import { SUB_PAGE_CONFIG, isObligationSatisfied, isColumnApplicable } from "@/lib/contabilidadesConfig";
import { toast } from "sonner";

const PENDING_FILTER_STORAGE_KEY = "contabilidadesShowOnlyPending";
const VIEW_MODE_STORAGE_KEY = "contabilidadesViewMode";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Últimos N dias do mês em que se considera "fim de mês próximo" (inclui o último dia). */
const END_OF_MONTH_URGENCY_DAYS = 3;

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

const GALLERY_SECTIONS: { tier: ClientTier; label: string; icon: typeof Check; className: string }[] = [
  { tier: "none", label: "Por começar", icon: CircleDashed, className: "text-muted-foreground" },
  { tier: "started", label: "Em curso", icon: Loader, className: "text-warning" },
  { tier: "done", label: "Concluídos", icon: CheckCircle2, className: "text-success" },
];

interface ContabilidadesViewProps {
  subPage?: string;
  /** Mudar de separador (regime) — atualiza a vista ativa da app. */
  onSubPageChange?: (subPage: string) => void;
}

const CheckboxCell = ({ done, started, onClick, label, detail }: { done: boolean; started?: boolean; onClick: () => void; label?: string; detail?: string }) => (
  <button onClick={onClick} title={label ? `${label}: ${done ? `concluído${detail ? ` — ${detail}` : ""}` : started ? "em andamento" : "por fazer"}` : undefined}
    aria-label={label}
    className={cn("w-6 h-6 rounded border-2 flex items-center justify-center transition-all mx-auto hover:scale-110",
      done ? "bg-success border-success text-success-foreground"
        : started ? "border-warning bg-warning/15 hover:border-primary"
        : "border-muted-foreground/30 hover:border-primary")}>
    {done && <Check className="w-4 h-4" />}
  </button>
);

/** Coluna que não se aplica ao cliente (ex.: Salários quando "Não tem"). */
const NotApplicableCell = () => (
  <span title="Não aplicável" className="inline-flex w-6 h-6 items-center justify-center text-muted-foreground/40 mx-auto">
    <Minus className="w-4 h-4" />
  </span>
);

const ProgressCell = ({ done, total }: { done: number; total: number }) => {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[96px]">
      <Progress value={pct} className={cn("h-1.5 w-14", pct === 100 && "[&>div]:bg-success")} />
      <span className={cn("text-xs font-medium whitespace-nowrap", pct === 100 ? "text-success" : "text-muted-foreground")}>
        {done}/{total}
      </span>
    </div>
  );
};

const CollabCell = ({ id, name }: { id: string | null; name: string }) => {
  if (!id || name === "—") return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarPalette(id))}>
        {getInitials(name)}
      </div>
      <span className="text-muted-foreground truncate">{name}</span>
    </div>
  );
};

const ContabilidadesView = ({ subPage, onSubPageChange }: ContabilidadesViewProps) => {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<string>(subPage || "TI_isento");
  const [collabFilter, setCollabFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  // Tabela (cliente × tarefas, marcável) é a vista por defeito: mostra logo o que
  // falta a cada cliente; os cartões ficam como alternativa.
  const [viewMode, setViewMode] = useState<"tabela" | "cartoes">(() => {
    try {
      return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "cartoes" ? "cartoes" : "tabela";
    } catch {
      return "tabela";
    }
  });
  const changeViewMode = (v: "tabela" | "cartoes") => {
    setViewMode(v);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, v);
    } catch {
      // localStorage indisponível — a preferência só dura esta sessão
    }
  };
  const [showOnlyPending, setShowOnlyPending] = useState(() => {
    try {
      return localStorage.getItem(PENDING_FILTER_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleShowOnlyPending = (v: boolean) => {
    setShowOnlyPending(v);
    try {
      localStorage.setItem(PENDING_FILTER_STORAGE_KEY, v ? "1" : "0");
    } catch {
      // localStorage indisponível — a preferência só dura esta sessão
    }
  };

  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligations(referenceMonth);
  const upsert = useUpsertObligation();
  // Filtro por tarefa (coluna): mostra só quem tem essa tarefa por fazer.
  const [columnFilter, setColumnFilter] = useState<number | null>(null);

  const config = SUB_PAGE_CONFIG[activeTab];
  const hideNif = config?.hideNif ?? false;
  const columns = config?.columns;
  const hasMultiColumns = !!columns && columns.length > 0;
  const hasGallery = config?.gallery ?? false;
  const isGallery = hasGallery && viewMode === "cartoes";
  // TI Simplificado - Isento de IVA não tem tarefas mensais a cumprir
  // (não há IVA a entregar) — não faz sentido mostrar pendentes/progresso.
  const noTasksTab = activeTab === "TI_isento";

  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage);
      setCollabFilter("all");
      setSearch("");
      setColumnFilter(null);
    }
  }, [subPage]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const activeClients = useMemo(() => clients.filter((c: any) => c.active), [clients]);

  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    return collaborators.find((c: any) => c.email?.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [user, collaborators]);

  // Alerta de fim de mês: só faz sentido quando se está a ver o mês corrente.
  const isViewingCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const daysLeftInMonth = new Date(year, month + 1, 0).getDate() - now.getDate();
  const isEndOfMonth = isViewingCurrentMonth && daysLeftInMonth <= END_OF_MONTH_URGENCY_DAYS;

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
  const [showDoneSection, setShowDoneSection] = useState(false);

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

  // Por coluna: quantos clientes (da lista filtrada) ainda têm essa tarefa por fazer.
  const pendingByColumn = useMemo(() => {
    if (!hasMultiColumns) return [];
    return columns!.map((col, i) => filteredClients.filter((c: any) =>
      isColumnApplicable(c, col) && colMaps[i][c.id]?.status !== "concluida").length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredClients, colMaps, hasMultiColumns, columns]);

  const doneCount = filteredClients.filter(isClientDone).length;
  const totalCount = filteredClients.length;
  const pendingCount = totalCount - doneCount;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  let displayedClients = showOnlyPending ? filteredClients.filter((c: any) => !isClientDone(c)) : filteredClients;
  if (columnFilter !== null && hasMultiColumns && columns![columnFilter]) {
    const col = columns![columnFilter];
    displayedClients = displayedClients.filter((c: any) => isColumnApplicable(c, col) && colMaps[columnFilter][c.id]?.status !== "concluida");
  }

  // Notas mensais só fazem sentido nos separadores em galeria (têm ficha do cliente).
  const showNotes = hasGallery;
  const totalCols = 2 + (hideNif ? 0 : 1) + (showNotes ? 1 : 0) + (hasMultiColumns ? columns!.length + 1 : noTasksTab ? 0 : 1);

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

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Regime">
        {REGIME_TABS.map((t) => {
          const total = activeClients.filter(SUB_PAGE_CONFIG[t.id].filter).length;
          const active = activeTab === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={active} type="button"
              onClick={() => {
                setActiveTab(t.id); setCollabFilter("all"); setSearch(""); setColumnFilter(null); setSelectedClient(null);
                onSubPageChange?.(t.id);
              }}
              className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
              <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}
                title="Clientes neste regime">{total}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-[260px]">
          <h2 className="text-2xl font-bold">{config?.label || "Gestão Mensal"}</h2>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg border px-2 py-1">
          <button onClick={prevMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

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

      <div className="flex gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={collabFilter} onChange={(e) => setCollabFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os responsáveis</option>
          {collaborators.filter((c: any) => c.active).map((col: any) => (
            <option key={col.id} value={col.id}>{col.name}</option>
          ))}
          <option value="none">Sem responsável</option>
        </select>
        {currentCollaborator && (
          <button
            type="button"
            onClick={() => setCollabFilter((f) => (f === currentCollaborator.id ? "all" : currentCollaborator.id))}
            className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border whitespace-nowrap transition-colors",
              collabFilter === currentCollaborator.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}
          >
            <UserCircle2 className="w-4 h-4" /> Só os meus clientes
          </button>
        )}
        <label className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-card cursor-pointer whitespace-nowrap">
          <Switch checked={showOnlyPending} onCheckedChange={toggleShowOnlyPending} />
          Só pendentes
        </label>
        {hasGallery && (
          <div className="flex rounded-lg border bg-card p-0.5" role="group" aria-label="Vista">
            {([["tabela", Table2, "Tabela"], ["cartoes", LayoutGrid, "Cartões"]] as const).map(([v, Icon, label]) => (
              <button key={v} type="button" onClick={() => changeViewMode(v)} aria-pressed={viewMode === v}
                className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md transition-colors",
                  viewMode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isGallery ? (
        displayedClients.length === 0 ? (
          <div className="bg-card rounded-xl border px-4 py-12 text-center text-muted-foreground">
            {showOnlyPending && filteredClients.length > 0 ? (
              <span className="flex items-center justify-center gap-2">
                <PartyPopper className="w-4 h-4" /> Tudo concluído este mês!
              </span>
            ) : (
              "Nenhum cliente encontrado"
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {GALLERY_SECTIONS.map(({ tier, label, icon: Icon, className }) => {
              const sectionClients = displayedClients.filter((c: any) => getClientTier(c) === tier);
              if (sectionClients.length === 0) return null;
              const collapsible = tier === "done";
              const expanded = !collapsible || showDoneSection;
              return (
                <section key={tier} className="space-y-3">
                  <button
                    type="button"
                    disabled={!collapsible}
                    onClick={() => setShowDoneSection((v) => !v)}
                    className={cn("flex items-center gap-2 text-sm font-semibold", collapsible && "hover:opacity-80")}
                  >
                    <Icon className={cn("w-4 h-4", className)} />
                    {label}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{sectionClients.length}</span>
                    {collapsible && <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />}
                  </button>
                  {expanded && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {sectionClients.map((client: any) => (
                        <ClientObligationCard
                          key={client.id}
                          client={client}
                          columns={columns!}
                          colOblTypes={colOblTypes}
                          colMaps={colMaps}
                          onOpen={() => setSelectedClient(client)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )
      ) : (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                  {!hideNif && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NIF</th>}
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                  {showNotes && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Notas</th>}
                  {hasMultiColumns ? (
                    <>
                      <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Progresso</th>
                      {columns!.map((col, i) => {
                        const n = pendingByColumn[i] ?? 0;
                        const active = columnFilter === i;
                        return (
                          <th key={col} className="text-center px-2 py-2 font-semibold text-muted-foreground w-20">
                            <button type="button" onClick={() => setColumnFilter((f) => (f === i ? null : i))}
                              title={active ? "Mostrar todos" : `Mostrar só quem tem ${col} por fazer`}
                              className={cn("flex flex-col items-center gap-0.5 mx-auto rounded-md px-2 py-1 transition-colors",
                                active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                              <span>{col}</span>
                              <span className={cn("text-[10px] font-medium",
                                active ? "text-primary-foreground" : n > 0 ? "text-warning" : "text-success")}>
                                {n > 0 ? `${n} por fazer` : "tudo feito"}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </>
                  ) : !noTasksTab && (
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-28">Estado</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayedClients.map((client: any) => {
                  const singleDone = oblMap[client.id]?.status === "concluida";
                  const applicableIdx = hasMultiColumns ? columns!.map((col, i) => (isColumnApplicable(client, col) ? i : -1)).filter((i) => i >= 0) : [];
                  const doneColsCount = applicableIdx.filter((i) => colMaps[i][client.id]?.status === "concluida").length;
                  const allDone = hasMultiColumns ? isClientDone(client) : !noTasksTab && singleDone;

                  return (
                    <tr key={client.id} className={cn("border-b last:border-0 transition-colors border-l-2",
                      allDone ? "bg-success/10 border-l-success" : "border-l-transparent hover:bg-muted/30")}>
                      <td className={cn("px-4 py-3 font-medium", allDone && "line-through text-muted-foreground")}>
                        <button type="button" onClick={() => setSelectedClient(client)} className="hover:underline text-left">
                          {client.name}
                        </button>
                      </td>
                      {!hideNif && <td className="px-4 py-3 text-muted-foreground">{client.nif || "—"}</td>}
                      <td className="px-4 py-3"><CollabCell id={client.responsavel_id} name={getCollabName(client.responsavel_id)} /></td>
                      {showNotes && (
                        <td className="px-4 py-3 align-top">
                          <MonthlyNoteCell
                            clientId={client.id}
                            referenceMonth={referenceMonth}
                            obligationId={notesMap[client.id]?.id}
                            initialNotes={notesMap[client.id]?.notes || ""}
                          />
                        </td>
                      )}
                      {hasMultiColumns ? (
                        <>
                          <td className="px-3 py-3"><ProgressCell done={doneColsCount} total={applicableIdx.length} /></td>
                          {colMaps.map((map, i) => {
                            const st = map[client.id]?.status;
                            return (
                              <td key={colOblTypes[i]} className="text-center px-3 py-3">
                                {isColumnApplicable(client, columns![i]) ? (
                                  <CheckboxCell done={st === "concluida"} started={st === "em_andamento"} label={columns![i]}
                                    detail={whoDid(map[client.id])}
                                    onClick={() => toggleObl(client.id, colOblTypes[i], map, columns![i])} />
                                ) : <NotApplicableCell />}
                              </td>
                            );
                          })}
                        </>
                      ) : !noTasksTab && (
                        <td className="text-center px-3 py-3">
                          <button type="button" onClick={() => toggleObl(client.id, oblType, oblMap)}>
                            <Badge variant="outline" className={cn("cursor-pointer transition-colors",
                              singleDone ? "bg-success/15 text-success border-success/30 hover:bg-success/25" : "bg-warning/15 text-warning border-warning/30 hover:bg-warning/25")}>
                              {singleDone ? "Concluído" : "Pendente"}
                            </Badge>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {displayedClients.length === 0 && (
                  <tr>
                    <td colSpan={totalCols} className="px-4 py-12 text-center text-muted-foreground">
                      {showOnlyPending && filteredClients.length > 0 ? (
                        <span className="flex items-center justify-center gap-2">
                          <PartyPopper className="w-4 h-4" /> Tudo concluído este mês!
                        </span>
                      ) : (
                        "Nenhum cliente encontrado"
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ClientDetailDialog client={selectedClient} open={!!selectedClient} onClose={() => setSelectedClient(null)} allowDelete={false} />
    </div>
  );
};

export default ContabilidadesView;
