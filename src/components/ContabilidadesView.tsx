import { useState, useEffect, useMemo } from "react";
import { useClients, useCollaborators, useMonthlyObligations, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { Search, ChevronLeft, ChevronRight, Check, PartyPopper, Clock, CheckCircle2, AlertTriangle, UserCircle2 } from "lucide-react";
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
import { SUB_PAGE_CONFIG, isObligationSatisfied } from "@/lib/contabilidadesConfig";

const PENDING_FILTER_STORAGE_KEY = "contabilidadesShowOnlyPending";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Últimos N dias do mês em que se considera "fim de mês próximo" (inclui o último dia). */
const END_OF_MONTH_URGENCY_DAYS = 3;

interface ContabilidadesViewProps {
  subPage?: string;
}

const CheckboxCell = ({ done, onClick }: { done: boolean; onClick: () => void }) => (
  <button onClick={onClick}
    className={cn("w-6 h-6 rounded border-2 flex items-center justify-center transition-all mx-auto hover:scale-110",
      done ? "bg-success border-success text-success-foreground" : "border-muted-foreground/30 hover:border-primary")}>
    {done && <Check className="w-4 h-4" />}
  </button>
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

const ContabilidadesView = ({ subPage }: ContabilidadesViewProps) => {
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

  const config = SUB_PAGE_CONFIG[activeTab];
  const hideNif = config?.hideNif ?? false;
  const columns = config?.columns;
  const hasMultiColumns = !!columns && columns.length > 0;
  const isGallery = config?.gallery ?? false;
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

  const isClientDone = (c: any) => {
    if (noTasksTab) return false;
    if (hasMultiColumns) {
      return colMaps.every((map, i) => isObligationSatisfied(c, columns![i], map[c.id]?.status));
    }
    return oblMap[c.id]?.status === "concluida";
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

  const toggleObl = (clientId: string, type: string, map: Record<string, any>) => {
    const obl = map[clientId];
    const done = obl?.status === "concluida";
    upsert.mutate({
      client_id: clientId,
      obligation_type: type,
      reference_month: referenceMonth,
      status: done ? "pendente" : "concluida",
      completed_at: done ? null : new Date().toISOString(),
      completed_by: done ? null : user?.id || null,
      ...(obl?.id ? { id: obl.id } : {}),
    });
  };

  const doneCount = filteredClients.filter(isClientDone).length;
  const totalCount = filteredClients.length;
  const pendingCount = totalCount - doneCount;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const displayedClients = showOnlyPending ? filteredClients.filter((c: any) => !isClientDone(c)) : filteredClients;

  // Notas mensais só fazem sentido nos separadores em galeria (têm ficha do cliente).
  const showNotes = isGallery;
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-[260px]">
          <h2 className="text-2xl font-bold">{config?.label || "Gestão Mensal"}</h2>
          {!noTasksTab && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {pendingCount > 0 && isEndOfMonth ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full bg-destructive/15 text-destructive animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" /> {pendingCount} por concluir — fim do mês!
                </span>
              ) : pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full bg-warning/15 text-warning">
                  <Clock className="w-3.5 h-3.5" /> {pendingCount} por concluir
                </span>
              ) : totalCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full bg-success/15 text-success">
                  <PartyPopper className="w-3.5 h-3.5" /> Tudo concluído
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> {doneCount} concluídos
              </span>
              <div className="flex items-center gap-1.5">
                <Progress value={progressPct} className={cn("h-1.5 w-20", progressPct === 100 && "[&>div]:bg-success")} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{progressPct}%</span>
              </div>
            </div>
          )}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {displayedClients.map((client: any) => (
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
                      {columns!.map((col) => (
                        <th key={col} className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">{col}</th>
                      ))}
                    </>
                  ) : !noTasksTab && (
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-28">Estado</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayedClients.map((client: any) => {
                  const singleDone = oblMap[client.id]?.status === "concluida";
                  const doneColsCount = hasMultiColumns ? colMaps.filter((map) => map[client.id]?.status === "concluida").length : 0;
                  const allDone = hasMultiColumns ? doneColsCount === columns!.length : !noTasksTab && singleDone;

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
                          <td className="px-3 py-3"><ProgressCell done={doneColsCount} total={columns!.length} /></td>
                          {colMaps.map((map, i) => {
                            const done = map[client.id]?.status === "concluida";
                            return (
                              <td key={colOblTypes[i]} className="text-center px-3 py-3">
                                <CheckboxCell done={done} onClick={() => toggleObl(client.id, colOblTypes[i], map)} />
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
