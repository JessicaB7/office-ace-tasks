import { useState, useMemo } from "react";
import { useTasks, useMonthlyObligations, useClients } from "@/hooks/useSupabaseQuery";
import { STATUS_LABELS, type TaskStatus } from "@/types/database";
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, XCircle, CalendarDays } from "lucide-react";

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const QUARTER_REF: Record<number, string> = { 1: "4ºT", 4: "1ºT", 7: "2ºT", 10: "3ºT" };

interface FiscalDeadline {
  title: string;
  day: number;
  months: number[] | null;
  refType?: "month" | "quarter";
  obligationType?: string;
  checkExtra?: boolean; // true = check extra_done instead of status
  overrides?: Record<number, number>;
}

const FISCAL_DEADLINES: FiscalDeadline[] = [
  { title: "SAFT", day: 5, months: null, obligationType: "SAFT", overrides: { 4: 8 } },
  { title: "DMR AT - Guia", day: 10, months: null, obligationType: "DMR_AT" },
  { title: "DMR SS - Guia", day: 10, months: null, obligationType: "DMR_SS" },
  { title: "DMR AT - Pagamento", day: 20, months: null, obligationType: "DMR_AT", checkExtra: true },
  { title: "DMR SS - Pagamento", day: 20, months: null, obligationType: "DMR_SS", checkExtra: true },
  { title: "IVA Periódica Mensal", day: 20, months: null, refType: "month", obligationType: "IVA" },
  { title: "Recapitulativa Mensal", day: 20, months: null, refType: "month", obligationType: "IVA_recapitulativa" },
  { title: "IVA Periódica Trimestral", day: 20, months: [2, 5, 8, 11], obligationType: "IVA" },
  { title: "Recapitulativa Trimestral", day: 20, months: [1, 4, 7, 10], refType: "quarter", obligationType: "IVA_recapitulativa" },
  { title: "Retenção na Fonte", day: 20, months: null, obligationType: "retencao_fonte" },
  { title: "SS TI - Pagamento", day: 20, months: null, obligationType: "SS_TI" },
  { title: "Salários", day: 25, months: null, obligationType: "salarios" },
  { title: "SS TI - Declaração Trimestral", day: 31, months: [1, 7, 10], obligationType: "SS_TI_DT" },
  { title: "SS TI - Declaração Trimestral", day: 30, months: [4], obligationType: "SS_TI_DT" },
];

const DASHBOARD_STATUSES: TaskStatus[] = ["pendente", "em_progresso", "concluida"];

const statusConfig: Record<TaskStatus, { icon: typeof Clock; colorClass: string }> = {
  pendente: { icon: Clock, colorClass: "bg-warning/15 text-warning" },
  em_progresso: { icon: CalendarClock, colorClass: "bg-info/15 text-info" },
  concluida: { icon: CheckCircle2, colorClass: "bg-success/15 text-success" },
  cancelada: { icon: XCircle, colorClass: "bg-destructive/15 text-destructive" },
};

const DashboardView = () => {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: clients = [] } = useClients();
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<"pendentes" | "concluidos">("pendentes");

  const today = new Date();
  const referenceMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const { data: obligations = [] } = useMonthlyObligations(referenceMonth);

  const statusCounts = tasks.reduce((acc, t: any) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const overdueTasks = tasks.filter(
    (t: any) => t.status !== "concluida" && t.status !== "cancelada" && new Date(t.due_date) < new Date()
  );

  // Count pending obligations per type and track which clients are pending/done
  // Build a unique key per deadline entry (type + checkExtra) for obligation data
  const obligationData = useMemo(() => {
    const data: Record<string, { total: number; done: number; pendingClients: { id: string; name: string }[]; doneClients: { id: string; name: string }[] }> = {};
    const activeClients = clients.filter((c: any) => c.active);

    FISCAL_DEADLINES.forEach((dl) => {
      if (!dl.obligationType) return;
      const key = dl.checkExtra ? `${dl.obligationType}_extra` : dl.obligationType;
      if (data[key]) return;
      const typeObligations = obligations.filter((o: any) => o.obligation_type === dl.obligationType);

      let doneClientIds: Set<string>;
      if (dl.checkExtra) {
        doneClientIds = new Set(typeObligations.filter((o: any) => o.extra_done).map((o: any) => o.client_id));
      } else {
        doneClientIds = new Set(typeObligations.filter((o: any) => o.status === "concluida").map((o: any) => o.client_id));
      }

      const pendingClients = activeClients
        .filter((c: any) => !doneClientIds.has(c.id))
        .map((c: any) => ({ id: c.id, name: c.name }));
      const doneClients = activeClients
        .filter((c: any) => doneClientIds.has(c.id))
        .map((c: any) => ({ id: c.id, name: c.name }));
      data[key] = {
        total: activeClients.length,
        done: doneClientIds.size,
        pendingClients,
        doneClients,
      };
    });
    return data;
  }, [obligations, clients]);

  // Helper to get deadlines for a specific week
  const getWeekDeadlines = (mondayDate: Date) => {
    const monday = new Date(mondayDate);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const result: { title: string; date: Date; obligationKey?: string }[] = [];

    // Check both months that could fall in this week
    const monthsToCheck = new Set<number>();
    for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
      monthsToCheck.add(d.getMonth());
    }

    monthsToCheck.forEach((monthIndex) => {
      const month1 = monthIndex + 1;
      const yr = monday.getMonth() === 11 && monthIndex === 0 ? monday.getFullYear() + 1 : monday.getFullYear();
      const daysInMonth = new Date(yr, monthIndex + 1, 0).getDate();

      FISCAL_DEADLINES.forEach((dl) => {
        if (dl.months === null || dl.months.includes(month1)) {
          let day = dl.overrides?.[month1] ?? dl.day;
          day = Math.min(day, daysInMonth);
          const deadlineDate = new Date(yr, monthIndex, day);

          if (deadlineDate >= monday && deadlineDate <= sunday) {
            let title = dl.title;
            if (dl.refType === "month") {
              const refIdx = (monthIndex - 2 + 12) % 12;
              title = `${dl.title} (${MONTH_NAMES_SHORT[refIdx]})`;
            } else if (dl.refType === "quarter") {
              title = `${dl.title} (${QUARTER_REF[month1] || ""})`;
            }
            const obligationKey = dl.obligationType
              ? (dl.checkExtra ? `${dl.obligationType}_extra` : dl.obligationType)
              : undefined;
            result.push({ title, date: deadlineDate, obligationKey });
          }
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

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das tarefas do gabinete</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DASHBOARD_STATUSES.map((status, i) => {
          const config = statusConfig[status];
          const Icon = config.icon;
          return (
            <div key={status} className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground font-medium">{STATUS_LABELS[status]}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-bold">{statusCounts[status] || 0}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {overdueTasks.length > 0 && (
          <div className="bg-card rounded-xl border p-5 animate-fade-in lg:col-span-2" style={{ animationDelay: "250ms" }}>
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
      </div>

      {/* Prazos desta Semana - full width */}
      <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "320ms" }}>
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Prazos desta Semana</h3>
        </div>
        <div className="space-y-1">
          {weekDeadlines.length === 0 && <p className="text-sm text-muted-foreground">Sem prazos fiscais esta semana</p>}
          {weekDeadlines.map((dl, idx) => {
            const info = dl.obligationKey && obligationData[dl.obligationKey]
              ? obligationData[dl.obligationKey]
              : null;
            const pending = info ? info.total - info.done : null;
            const expandKey = `${dl.obligationKey}-${idx}`;
            const isExpanded = expandedType === expandKey;
            return (
              <div key={idx}>
                <div
                  className={`flex items-center justify-between text-sm px-3 py-2.5 rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${isExpanded ? "bg-muted/50" : ""}`}
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
                    <CalendarDays className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <p className="font-medium truncate">{dl.title}</p>
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
                    {/* Tabs */}
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
                    <div className="max-h-[250px] overflow-y-auto">
                      {expandedTab === "pendentes" && (
                        info.pendingClients.length > 0 ? (
                          info.pendingClients.map((c) => (
                            <div key={c.id} className="px-3 py-1.5 text-xs border-b last:border-b-0 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                              {c.name}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-3 text-xs text-success text-center">✓ Todos concluídos</div>
                        )
                      )}
                      {expandedTab === "concluidos" && (
                        info.doneClients.length > 0 ? (
                          info.doneClients.map((c) => (
                            <div key={c.id} className="px-3 py-1.5 text-xs border-b last:border-b-0 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                              {c.name}
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
    </div>
  );
};

export default DashboardView;
