import { useMemo } from "react";
import { useTasks } from "@/hooks/useSupabaseQuery";
import { STATUS_LABELS, type TaskStatus } from "@/types/database";
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, XCircle, CalendarDays } from "lucide-react";

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const QUARTER_REF: Record<number, string> = { 1: "4ºT", 4: "1ºT", 7: "2ºT", 10: "3ºT" };

interface FiscalDeadline {
  title: string;
  day: number;
  months: number[] | null;
  refType?: "month" | "quarter";
}

const FISCAL_DEADLINES: FiscalDeadline[] = [
  { title: "SAFT", day: 5, months: null },
  { title: "DMR AT - Guia", day: 10, months: null },
  { title: "DMR SS - Guia", day: 10, months: null },
  { title: "DMR AT - Pagamento", day: 20, months: null },
  { title: "DMR SS - Pagamento", day: 20, months: null },
  { title: "IVA Periódica Mensal", day: 20, months: null, refType: "month" },
  { title: "Recapitulativa Mensal", day: 20, months: null, refType: "month" },
  { title: "IVA Periódica Trimestral", day: 20, months: [2, 5, 8, 11] },
  { title: "Recapitulativa Trimestral", day: 20, months: [1, 4, 7, 10], refType: "quarter" },
  { title: "Retenção na Fonte", day: 20, months: null },
  { title: "SS TI - Pagamento", day: 20, months: null },
  { title: "Salários", day: 25, months: null },
  { title: "SS TI - Declaração Trimestral", day: 31, months: [1, 7, 10] },
  { title: "SS TI - Declaração Trimestral", day: 30, months: [4] },
];

const statusConfig: Record<TaskStatus, { icon: typeof Clock; colorClass: string }> = {
  pendente: { icon: Clock, colorClass: "bg-warning/15 text-warning" },
  em_progresso: { icon: CalendarClock, colorClass: "bg-info/15 text-info" },
  concluida: { icon: CheckCircle2, colorClass: "bg-success/15 text-success" },
  cancelada: { icon: XCircle, colorClass: "bg-destructive/15 text-destructive" },
};

const DashboardView = () => {
  const { data: tasks = [], isLoading } = useTasks();

  const statusCounts = tasks.reduce((acc, t: any) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const overdueTasks = tasks.filter(
    (t: any) => t.status !== "concluida" && t.status !== "cancelada" && new Date(t.due_date) < new Date()
  );

  // Get current week boundaries (Monday to Sunday)
  const weekDeadlines = useMemo(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday=0
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const monthIndex = today.getMonth();
    const month1 = monthIndex + 1;
    const daysInMonth = new Date(today.getFullYear(), monthIndex + 1, 0).getDate();

    const result: { title: string; date: Date }[] = [];

    FISCAL_DEADLINES.forEach((dl) => {
      if (dl.months === null || dl.months.includes(month1)) {
        const day = Math.min(dl.day, daysInMonth);
        const deadlineDate = new Date(today.getFullYear(), monthIndex, day);

        if (deadlineDate >= monday && deadlineDate <= sunday) {
          let title = dl.title;
          if (dl.refType === "month") {
            const refIdx = (monthIndex - 2 + 12) % 12;
            title = `${dl.title} (${MONTH_NAMES_SHORT[refIdx]})`;
          } else if (dl.refType === "quarter") {
            title = `${dl.title} (${QUARTER_REF[month1] || ""})`;
          }
          result.push({ title, date: deadlineDate });
        }
      }
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, []);

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das tarefas do gabinete</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((status, i) => {
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
          <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "250ms" }}>
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

        <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "320ms" }}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Prazos desta Semana</h3>
          </div>
          <div className="space-y-3">
            {weekDeadlines.length === 0 && <p className="text-sm text-muted-foreground">Sem prazos fiscais esta semana</p>}
            {weekDeadlines.map((dl, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <p className="font-medium">{dl.title}</p>
                </div>
                <span className="text-muted-foreground text-xs whitespace-nowrap ml-3">
                  {dl.date.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
