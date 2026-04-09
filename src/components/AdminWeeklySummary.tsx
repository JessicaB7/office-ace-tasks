import { useState, useMemo } from "react";
import { useClients, useCollaborators, useTasks } from "@/hooks/useSupabaseQuery";
import { Users, CheckCircle2, AlertTriangle, UserPlus, UserMinus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const AdminWeeklySummary = () => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: tasks = [] } = useTasks();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Clients added this month
  const newClients = useMemo(() => {
    return clients.filter((c: any) => {
      const d = new Date(c.created_at);
      return d >= monthStart && d <= monthEnd;
    });
  }, [clients, monthStart, monthEnd]);

  // Clients deactivated this month
  const deactivatedClients = useMemo(() => {
    return clients.filter((c: any) => {
      if (c.active) return false;
      const d = new Date(c.updated_at);
      return d >= monthStart && d <= monthEnd;
    });
  }, [clients, monthStart, monthEnd]);

  // Tasks by collaborator for this month
  const collabStats = useMemo(() => {
    const activeCollabs = collaborators.filter((c: any) => c.active);
    return activeCollabs.map((collab: any) => {
      const collabTasks = tasks.filter((t: any) => t.collaborator_id === collab.id);

      const completed = collabTasks.filter((t: any) => {
        if (t.status !== "concluida") return false;
        const d = new Date(t.updated_at);
        return d >= monthStart && d <= monthEnd;
      }).length;

      const pending = collabTasks.filter((t: any) =>
        t.status === "pendente" || t.status === "em_progresso"
      ).length;

      const overdue = collabTasks.filter((t: any) =>
        t.status !== "concluida" && t.status !== "cancelada" && new Date(t.due_date) < now
      ).length;

      return { id: collab.id, name: collab.name, completed, pending, overdue };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, collaborators, monthStart, monthEnd, now]);

  const totalCompleted = collabStats.reduce((s, c) => s + c.completed, 0);
  const totalPending = collabStats.reduce((s, c) => s + c.pending, 0);
  const totalOverdue = collabStats.reduce((s, c) => s + c.overdue, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Resumo Mensal</h2>
          <p className="text-muted-foreground text-sm mt-1">Visão geral do gabinete</p>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg border px-2 py-1">
          <button onClick={prevMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border p-4 text-center">
          <UserPlus className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{newClients.length}</p>
          <p className="text-xs text-muted-foreground">Entradas</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <UserMinus className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold">{deactivatedClients.length}</p>
          <p className="text-xs text-muted-foreground">Saídas</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalCompleted}</p>
          <p className="text-xs text-muted-foreground">Concluídas</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalOverdue}</p>
          <p className="text-xs text-muted-foreground">Em Atraso</p>
        </div>
      </div>

      {/* Client entries */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Clientes — Entradas</h3>
          <span className="ml-auto text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{newClients.length}</span>
        </div>
        {newClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente adicionado neste mês</p>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {newClients.map((c: any) => (
              <div key={c.id} className="px-3 py-2 text-sm flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-PT")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client exits */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserMinus className="w-4 h-4 text-destructive" />
          <h3 className="font-semibold">Clientes — Saídas</h3>
          <span className="ml-auto text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{deactivatedClients.length}</span>
        </div>
        {deactivatedClients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma saída registada neste mês</p>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {deactivatedClients.map((c: any) => (
              <div key={c.id} className="px-3 py-2 text-sm flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString("pt-PT")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks by collaborator */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Tarefas por Colaborador</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Colaborador</th>
                <th className="text-center px-3 py-2.5 font-semibold text-success w-28">Concluídas</th>
                <th className="text-center px-3 py-2.5 font-semibold text-warning w-28">Pendentes</th>
                <th className="text-center px-3 py-2.5 font-semibold text-destructive w-28">Em Atraso</th>
              </tr>
            </thead>
            <tbody>
              {collabStats.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="text-center px-3 py-2.5">
                    <span className="text-xs font-semibold bg-success/10 text-success px-2 py-0.5 rounded-full">{c.completed}</span>
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <span className="text-xs font-semibold bg-warning/10 text-warning px-2 py-0.5 rounded-full">{c.pending}</span>
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", c.overdue > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{c.overdue}</span>
                  </td>
                </tr>
              ))}
              {collabStats.length > 0 && (
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="text-center px-3 py-2.5"><span className="text-xs font-semibold bg-success/10 text-success px-2 py-0.5 rounded-full">{totalCompleted}</span></td>
                  <td className="text-center px-3 py-2.5"><span className="text-xs font-semibold bg-warning/10 text-warning px-2 py-0.5 rounded-full">{totalPending}</span></td>
                  <td className="text-center px-3 py-2.5"><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", totalOverdue > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{totalOverdue}</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminWeeklySummary;
