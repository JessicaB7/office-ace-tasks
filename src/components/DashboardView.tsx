import { Task, STATUS_LABELS, CATEGORY_LABELS, TaskStatus, TaskCategory } from "@/types/task";
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";

interface DashboardViewProps {
  tasks: Task[];
}

const statusConfig: Record<TaskStatus, { icon: typeof Clock; colorClass: string }> = {
  pendente: { icon: Clock, colorClass: "bg-warning/15 text-warning" },
  em_progresso: { icon: CalendarClock, colorClass: "bg-info/15 text-info" },
  concluida: { icon: CheckCircle2, colorClass: "bg-success/15 text-success" },
  cancelada: { icon: XCircle, colorClass: "bg-destructive/15 text-destructive" },
};

const DashboardView = ({ tasks }: DashboardViewProps) => {
  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryCounts = tasks.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const overdueTasks = tasks.filter(
    (t) => t.status !== "concluida" && t.status !== "cancelada" && new Date(t.dueDate) < new Date()
  );

  const upcomingTasks = tasks
    .filter((t) => t.status !== "concluida" && t.status !== "cancelada")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das tarefas do gabinete</p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((status, i) => {
          const config = statusConfig[status];
          const Icon = config.icon;
          return (
            <div
              key={status}
              className="bg-card rounded-xl border p-5 animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
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
        {/* Overdue */}
        {overdueTasks.length > 0 && (
          <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "250ms" }}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold">Tarefas em Atraso</h3>
              <span className="ml-auto text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                {overdueTasks.length}
              </span>
            </div>
            <div className="space-y-3">
              {overdueTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-muted-foreground text-xs">{task.client}</p>
                  </div>
                  <span className="text-destructive text-xs font-medium whitespace-nowrap ml-3">
                    {new Date(task.dueDate).toLocaleDateString("pt-PT")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "320ms" }}>
          <h3 className="font-semibold mb-4">Próximos Prazos</h3>
          <div className="space-y-3">
            {upcomingTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-muted-foreground text-xs">{task.client}</p>
                </div>
                <span className="text-muted-foreground text-xs whitespace-nowrap ml-3">
                  {new Date(task.dueDate).toLocaleDateString("pt-PT")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* By category */}
        <div className="bg-card rounded-xl border p-5 animate-fade-in" style={{ animationDelay: "390ms" }}>
          <h3 className="font-semibold mb-4">Por Categoria</h3>
          <div className="space-y-2">
            {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((cat) => {
              const count = categoryCounts[cat] || 0;
              const total = tasks.length;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-medium w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
