import { useState, useMemo } from "react";
import { useTasks, useMonthlyObligations, useClients, useCollaborators } from "@/hooks/useSupabaseQuery";
import { STATUS_LABELS, CATEGORY_LABELS, type TaskStatus, type TaskCategory } from "@/types/database";
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, XCircle, CalendarDays, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const QUARTER_REF: Record<number, string> = { 1: "4ºT", 4: "1ºT", 7: "2ºT", 10: "3ºT" };

const hasSalarios = (c: any) => c.salarios && c.salarios !== "Não tem" && c.salarios !== "";
const isTI = (c: any) => c.tipo_contabilidade === "TI RS" || c.tipo_contabilidade === "TI CO";

interface FiscalDeadline {
  title: string;
  day: number;
  months: number[] | null;
  refType?: "month" | "quarter";
  obligationType?: string;
  checkExtra?: boolean;
  overrides?: Record<number, number>;
  clientFilter?: (c: any) => boolean;
  refMonthOffset?: number; // how many months back from current month is the reference (default 1)
}

const FISCAL_DEADLINES: FiscalDeadline[] = [
  { title: "SAFT", day: 5, months: null, obligationType: "SAFT", overrides: { 4: 8 }, clientFilter: (c) => c.saft && c.saft !== "" },
  { title: "DMR AT - Guia", day: 10, months: null, obligationType: "DMR_AT", clientFilter: (c) => hasSalarios(c) },
  { title: "DMR SS - Guia", day: 10, months: null, obligationType: "DMR_SS", clientFilter: (c) => hasSalarios(c) },
  { title: "Pedir documentação clientes", day: 15, months: null },
  { title: "DMR AT - Pagamento", day: 20, months: null, obligationType: "DMR_AT", checkExtra: true, clientFilter: (c) => hasSalarios(c) },
  { title: "DMR SS - Pagamento", day: 20, months: null, obligationType: "DMR_SS", checkExtra: true, clientFilter: (c) => hasSalarios(c) },
  { title: "IVA Periódica Mensal", day: 20, months: null, refType: "month", obligationType: "IVA", clientFilter: (c) => c.iva === "Mensal", refMonthOffset: 2 },
  { title: "Recapitulativa Mensal", day: 20, months: null, refType: "month", obligationType: "IVA_recapitulativa", clientFilter: (c) => c.recapitulativa === "Mensal", refMonthOffset: 1 },
  { title: "IVA Periódica Trimestral", day: 20, months: [2, 5, 8, 11], obligationType: "IVA", clientFilter: (c) => c.iva === "Trimestral", refMonthOffset: 2 },
  { title: "Recapitulativa Trimestral", day: 20, months: [1, 4, 7, 10], refType: "quarter", obligationType: "IVA_recapitulativa", clientFilter: (c) => c.recapitulativa && c.recapitulativa !== "" && c.recapitulativa !== "Não Aplicável" && c.iva !== "Mensal", refMonthOffset: 2 },
  { title: "Retenção na Fonte", day: 20, months: null, obligationType: "retencao_fonte", clientFilter: (c) => c.tipo_contabilidade === "SQ" || c.tipo_contabilidade === "TI CO" },
  { title: "SS TI - Pagamento", day: 20, months: null, obligationType: "SS_TI", clientFilter: (c) => isTI(c) && !hasSalarios(c) },
  { title: "Salários - Processamento", day: 25, months: null, obligationType: "salarios", clientFilter: (c) => hasSalarios(c) },
  { title: "SS TI - Declaração Trimestral", day: 31, months: [1, 7, 10], obligationType: "SS_TI_DT", clientFilter: (c) => isTI(c) },
  { title: "SS TI - Declaração Trimestral", day: 30, months: [4], obligationType: "SS_TI_DT", clientFilter: (c) => isTI(c) },
  { title: "IVA OSS", day: 15, months: [1, 4, 7, 10], refType: "quarter", obligationType: "IVA_OSS", clientFilter: (c) => c.iva_oss === "Sim", refMonthOffset: 3 },
];

const getFridaysInMonth = (year: number, monthIndex: number): number[] => {
  const fridays: number[] = [];
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) {
    if (new Date(year, monthIndex, d).getDay() === 5) fridays.push(d);
  }
  return fridays;
};

const DashboardView = () => {
  const { user } = useAuth();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<"pendentes" | "concluidos">("pendentes");

  const today = new Date();
  const curMonth = today.getMonth();
  const curYear = today.getFullYear();

  // Build reference months for offsets 1, 2, 3
  const getRefMonth = (offset: number) => {
    const m = (curMonth - offset + 12) % 12;
    const y = curYear + Math.floor((curMonth - offset) / 12);
    return `${y}-${String(m + 1).padStart(2, "0")}-01`;
  };
  const refMonth1 = getRefMonth(1);
  const refMonth2 = getRefMonth(2);
  const refMonth3 = getRefMonth(3);

  const { data: obligations1 = [] } = useMonthlyObligations(refMonth1);
  const { data: obligations2 = [] } = useMonthlyObligations(refMonth2);
  const { data: obligations3 = [] } = useMonthlyObligations(refMonth3);

  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    return collaborators.find(c => c.email.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [user, collaborators]);

  const myTasks = useMemo(() => {
    if (!currentCollaborator) return [];
    return tasks.filter((t: any) => t.collaborator_id === currentCollaborator.id);
  }, [tasks, currentCollaborator]);

  const overdueTasks = myTasks.filter(
    (t: any) => t.status !== "concluida" && t.status !== "cancelada" && new Date(t.due_date) < new Date()
  );

  const obligationsByOffset: Record<number, any[]> = useMemo(() => ({
    1: obligations1,
    2: obligations2,
    3: obligations3,
  }), [obligations1, obligations2, obligations3]);

  // Count pending obligations per type — filtered to current collaborator's clients only
  const obligationData = useMemo(() => {
    const data: Record<string, { total: number; done: number; pendingClients: { id: string; name: string; responsavel_id: string | null }[]; doneClients: { id: string; name: string; responsavel_id: string | null }[] }> = {};
    const activeClients = clients.filter((c: any) => c.active);
    const myActiveClients = currentCollaborator
      ? activeClients.filter((c: any) => c.responsavel_id === currentCollaborator.id)
      : activeClients;

    FISCAL_DEADLINES.forEach((dl, idx) => {
      if (!dl.obligationType) return;
      const key = dl.checkExtra ? `${dl.obligationType}_extra_${idx}` : `${dl.obligationType}_${idx}`;
      if (data[key]) return;
      
      const offset = dl.refMonthOffset ?? 1;
      const obligations = obligationsByOffset[offset] || obligations1;
      const typeObligations = obligations.filter((o: any) => o.obligation_type === dl.obligationType);

      const myClients = dl.clientFilter
        ? myActiveClients.filter(dl.clientFilter)
        : myActiveClients;

      let doneClientIds: Set<string>;
      if (dl.checkExtra) {
        doneClientIds = new Set(typeObligations.filter((o: any) => o.extra_done).map((o: any) => o.client_id));
      } else {
        doneClientIds = new Set(typeObligations.filter((o: any) => o.status === "concluida").map((o: any) => o.client_id));
      }

      const pendingClients = myClients
        .filter((c: any) => !doneClientIds.has(c.id))
        .map((c: any) => ({ id: c.id, name: c.name, responsavel_id: c.responsavel_id }));
      const doneClients = myClients
        .filter((c: any) => doneClientIds.has(c.id))
        .map((c: any) => ({ id: c.id, name: c.name, responsavel_id: c.responsavel_id }));
      data[key] = {
        total: myClients.length,
        done: doneClients.length,
        pendingClients,
        doneClients,
      };
    });
    return data;
  }, [obligations1, obligations2, obligations3, clients, currentCollaborator]);

  const getWeekDeadlines = (mondayDate: Date) => {
    const monday = new Date(mondayDate);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const result: { title: string; date: Date; obligationKey?: string }[] = [];

    const monthsToCheck = new Set<number>();
    for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
      monthsToCheck.add(d.getMonth());
    }

    monthsToCheck.forEach((monthIndex) => {
      const month1 = monthIndex + 1;
      const yr = monday.getMonth() === 11 && monthIndex === 0 ? monday.getFullYear() + 1 : monday.getFullYear();
      const daysInMonth = new Date(yr, monthIndex + 1, 0).getDate();

      FISCAL_DEADLINES.forEach((dl, dlIdx) => {
        if (dl.months === null || dl.months.includes(month1)) {
          let day = dl.overrides?.[month1] ?? dl.day;
          day = Math.min(day, daysInMonth);
          const deadlineDate = new Date(yr, monthIndex, day);

          if (deadlineDate >= monday && deadlineDate <= sunday) {
            let title = dl.title;
            if (dl.refType === "month") {
              const refIdx = (monthIndex - (dl.refMonthOffset ?? 1) + 12) % 12;
              title = `${dl.title} (${MONTH_NAMES_SHORT[refIdx]})`;
            } else if (dl.refType === "quarter") {
              title = `${dl.title} (${QUARTER_REF[month1] || ""})`;
            }
            const obligationKey = dl.obligationType
              ? (dl.checkExtra ? `${dl.obligationType}_extra_${dlIdx}` : `${dl.obligationType}_${dlIdx}`)
              : undefined;
            result.push({ title, date: deadlineDate, obligationKey });
          }
        }
      });

      // Salários - Envio on last day of month
      const salariosIdx = FISCAL_DEADLINES.findIndex(d => d.obligationType === "salarios" && !d.checkExtra);
      const lastDayDate = new Date(yr, monthIndex, daysInMonth);
      if (lastDayDate >= monday && lastDayDate <= sunday) {
        result.push({ title: "Salários - Envio", date: lastDayDate, obligationKey: salariosIdx >= 0 ? `salarios_${salariosIdx}` : undefined });
      }

      // Emissão de faturas on every Friday
      getFridaysInMonth(yr, monthIndex).forEach((fri) => {
        const friDate = new Date(yr, monthIndex, fri);
        if (friDate >= monday && friDate <= sunday) {
          result.push({ title: "Emissão de faturas", date: friDate });
        }
      });
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const currentMonday = useMemo(() => {
    const dayOfWeek = (today.getDay() + 6) % 7;
    const m = new Date(today);
    m.setDate(today.getDate() - dayOfWeek);
    return m;
  }, []);

  const nextMonday = useMemo(() => {
    const m = new Date(currentMonday);
    m.setDate(m.getDate() + 7);
    return m;
  }, [currentMonday]);

  const weekDeadlines = useMemo(() => getWeekDeadlines(currentMonday), [currentMonday]);
  const nextWeekDeadlines = useMemo(() => getWeekDeadlines(nextMonday), [nextMonday]);

  // Helper: get collaborator name by id
  const getCollabName = (id: string | null) => {
    if (!id) return "Sem responsável";
    const col = collaborators.find((c: any) => c.id === id);
    return col ? col.name : "Sem responsável";
  };

  // Group clients by collaborator for a given obligation info
  const groupByCollaborator = (clientList: { id: string; name: string; responsavel_id: string | null }[]) => {
    const groups: Record<string, { collabName: string; clients: { id: string; name: string }[] }> = {};
    clientList.forEach((c) => {
      const key = c.responsavel_id || "__none__";
      if (!groups[key]) {
        groups[key] = { collabName: getCollabName(c.responsavel_id), clients: [] };
      }
      groups[key].clients.push({ id: c.id, name: c.name });
    });
    return Object.values(groups).sort((a, b) => a.collabName.localeCompare(b.collabName));
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  const renderDeadlineSection = (deadlines: { title: string; date: Date; obligationKey?: string }[], title: string, icon: string, delay: string) => (
    <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: delay }}>
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className={`w-4 h-4 ${icon === "primary" ? "text-primary" : "text-muted-foreground"}`} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="space-y-1">
        {deadlines.length === 0 && <p className="text-sm text-muted-foreground">Sem prazos fiscais</p>}
        {deadlines.map((dl, idx) => {
          const info = dl.obligationKey && obligationData[dl.obligationKey]
            ? obligationData[dl.obligationKey]
            : null;
          const pending = info ? info.total - info.done : null;
          const allDone = info ? info.total > 0 && info.done === info.total : false;
          const expandKey = `${title}-${dl.obligationKey}-${idx}`;
          const isExpanded = expandedType === expandKey;
          return (
            <div key={idx}>
              <div
                className={`flex items-center justify-between text-sm px-3 py-2.5 rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${isExpanded ? "bg-muted/50" : ""} ${allDone ? "bg-green-50 dark:bg-green-950/20" : ""}`}
                onClick={() => {
                  if (isExpanded) {
                    setExpandedType(null);
                  } else {
                    setExpandedType(expandKey);
                    setExpandedTab("pendentes");
                  }
                }}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <CalendarDays className={`w-3.5 h-3.5 shrink-0 ${allDone ? "text-success" : "text-destructive"}`} />
                  <p className={`font-medium truncate ${allDone ? "line-through text-muted-foreground" : ""}`}>{dl.title}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {info && (
                    <>
                      <span className="text-[10px] font-semibold bg-success/15 text-success px-1.5 py-0.5 rounded-full">
                        {info.done} ✓
                      </span>
                      {pending !== null && pending > 0 && (
                        <span className="text-[10px] font-semibold bg-warning/15 text-warning px-1.5 py-0.5 rounded-full">
                          {pending} ○
                        </span>
                      )}
                    </>
                  )}
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {dl.date.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
              {isExpanded && info && (
                <div className="mt-1 mb-2 border rounded-lg overflow-hidden animate-fade-in">
                  <div className="flex border-b">
                    <button
                      onClick={() => setExpandedTab("pendentes")}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                        expandedTab === "pendentes"
                          ? "bg-warning/10 text-warning border-b-2 border-warning"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      Pendentes ({info.pendingClients.length})
                    </button>
                    <button
                      onClick={() => setExpandedTab("concluidos")}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                        expandedTab === "concluidos"
                          ? "bg-success/10 text-success border-b-2 border-success"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      Concluídos ({info.doneClients.length})
                    </button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {expandedTab === "pendentes" && (
                      info.pendingClients.length > 0 ? (
                        groupByCollaborator(info.pendingClients).map((group) => (
                          <div key={group.collabName}>
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/30 uppercase tracking-wide">
                              {group.collabName} ({group.clients.length})
                            </div>
                            {group.clients.map((c) => (
                              <div key={c.id} className="px-3 py-1.5 text-xs border-b last:border-b-0 flex items-center gap-2 pl-5">
                                <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                                {c.name}
                              </div>
                            ))}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-xs text-success text-center">✓ Todos concluídos</div>
                      )
                    )}
                    {expandedTab === "concluidos" && (
                      info.doneClients.length > 0 ? (
                        groupByCollaborator(info.doneClients).map((group) => (
                          <div key={group.collabName}>
                            <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/30 uppercase tracking-wide">
                              {group.collabName} ({group.clients.length})
                            </div>
                            {group.clients.map((c) => (
                              <div key={c.id} className="px-3 py-1.5 text-xs border-b last:border-b-0 flex items-center gap-2 pl-5">
                                <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                                {c.name}
                              </div>
                            ))}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhum concluído</div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das tarefas do gabinete</p>
      </div>

      {overdueTasks.length > 0 && (
        <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h3 className="font-semibold">Tarefas em Atraso</h3>
            <span className="ml-auto text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{overdueTasks.length}</span>
          </div>
          <div className="space-y-3">
            {overdueTasks.map((task: any) => (
              <div key={task.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-muted-foreground text-xs">{task.clients?.name || "—"}</p>
                </div>
                <span className="text-destructive text-xs font-medium whitespace-nowrap ml-3">
                  {new Date(task.due_date).toLocaleDateString("pt-PT")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {renderDeadlineSection(weekDeadlines, "Prazos desta Semana", "primary", "120ms")}
      {renderDeadlineSection(nextWeekDeadlines, "Prazos da Próxima Semana", "muted", "200ms")}

      {/* As Minhas Tarefas */}
      {(() => {
        const myPendente = myTasks.filter((t: any) => t.status === "pendente").length;
        const myEmProgresso = myTasks.filter((t: any) => t.status === "em_progresso").length;
        const myConcluida = myTasks.filter((t: any) => t.status === "concluida").length;
        const myAtrasada = myTasks.filter((t: any) => t.status !== "concluida" && t.status !== "cancelada" && new Date(t.due_date) < new Date()).length;
        return (
          <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "280ms" }}>
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">As Minhas Tarefas</h3>
              {currentCollaborator && <span className="text-xs text-muted-foreground ml-1">({currentCollaborator.name})</span>}
            </div>
            {!currentCollaborator ? (
              <p className="text-sm text-muted-foreground">O seu email não está associado a nenhum colaborador.</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center p-2 rounded-lg bg-warning/10">
                    <p className="text-lg font-bold text-warning">{myPendente}</p>
                    <p className="text-[10px] text-muted-foreground">Pendente</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-info/10">
                    <p className="text-lg font-bold text-info">{myEmProgresso}</p>
                    <p className="text-[10px] text-muted-foreground">Em Progresso</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-success/10">
                    <p className="text-lg font-bold text-success">{myConcluida}</p>
                    <p className="text-[10px] text-muted-foreground">Concluída</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-destructive/10">
                    <p className="text-lg font-bold text-destructive">{myAtrasada}</p>
                    <p className="text-[10px] text-muted-foreground">Atrasada</p>
                  </div>
                </div>
                {myTasks.filter((t: any) => t.status !== "concluida" && t.status !== "cancelada").length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem tarefas pendentes</p>
                ) : (
                  <div className="divide-y border rounded-lg overflow-hidden">
                    {myTasks
                      .filter((t: any) => t.status !== "concluida" && t.status !== "cancelada")
                      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                      .map((task: any) => {
                        const isOverdue = new Date(task.due_date) < new Date();
                        return (
                          <div key={task.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{task.title}</p>
                              <p className="text-xs text-muted-foreground">{task.clients?.name || "—"} · {CATEGORY_LABELS[task.category as TaskCategory]}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${task.status === "pendente" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}>
                                {STATUS_LABELS[task.status as TaskStatus]}
                              </span>
                              <span className={`text-xs whitespace-nowrap ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                {new Date(task.due_date).toLocaleDateString("pt-PT")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default DashboardView;
