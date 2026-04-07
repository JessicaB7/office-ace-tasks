import { useState, useMemo } from "react";
import { useTasks, useCollaborators } from "@/hooks/useSupabaseQuery";
import { STATUS_LABELS, CATEGORY_LABELS, type TaskStatus, type TaskCategory } from "@/types/database";
import { StatusBadge, PriorityBadge } from "@/components/TaskBadge";
import { Search, Filter, Plus, Clock, CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";

interface TaskListViewProps {
  onEditTask: (task: any) => void;
  onNewTask: () => void;
}

const TaskListView = ({ onEditTask, onNewTask }: TaskListViewProps) => {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: collaborators = [] } = useCollaborators();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all" | "atrasada">("all");
  const [filterCollaborator, setFilterCollaborator] = useState<string>("all");

  const now = new Date();

  const counts = useMemo(() => {
    const pendente = tasks.filter((t: any) => t.status === "pendente").length;
    const em_progresso = tasks.filter((t: any) => t.status === "em_progresso").length;
    const concluida = tasks.filter((t: any) => t.status === "concluida").length;
    const atrasada = tasks.filter((t: any) => t.status !== "concluida" && t.status !== "cancelada" && new Date(t.due_date) < now).length;
    return { pendente, em_progresso, concluida, atrasada };
  }, [tasks]);

  const filtered = tasks.filter((t: any) => {
    if (filterStatus === "atrasada") {
      if (t.status === "concluida" || t.status === "cancelada" || new Date(t.due_date) >= now) return false;
    } else if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterCollaborator !== "all" && t.collaborator_id !== filterCollaborator) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.title.toLowerCase().includes(s) && !(t.clients?.name || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  const statusCards = [
    { key: "pendente", label: "Pendente", count: counts.pendente, icon: Clock, colorClass: "bg-warning/15 text-warning" },
    { key: "em_progresso", label: "Em Progresso", count: counts.em_progresso, icon: CalendarClock, colorClass: "bg-info/15 text-info" },
    { key: "concluida", label: "Concluída", count: counts.concluida, icon: CheckCircle2, colorClass: "bg-success/15 text-success" },
    { key: "atrasada", label: "Atrasada", count: counts.atrasada, icon: AlertTriangle, colorClass: "bg-destructive/15 text-destructive" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tarefas</h2>
          <p className="text-muted-foreground text-sm mt-1">Gerir todas as tarefas do gabinete</p>
        </div>
        <button onClick={onNewTask} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Nova Tarefa
        </button>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statusCards.map((card) => {
          const Icon = card.icon;
          const isActive = filterStatus === card.key;
          return (
            <button
              key={card.key}
              onClick={() => setFilterStatus(isActive ? "all" : card.key as any)}
              className={`bg-card rounded-xl border p-4 text-left transition-all ${isActive ? "ring-2 ring-primary" : "hover:shadow-sm"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${card.colorClass}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-bold">{card.count}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar tarefa ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={filterCollaborator} onChange={(e) => setFilterCollaborator(e.target.value)} className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">Todos os responsáveis</option>
            {collaborators.filter(c => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tarefa</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Categoria</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Prioridade</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Prazo</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task: any, i: number) => (
                <tr key={task.id} onClick={() => onEditTask(task)} className="border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <td className="px-4 py-3 font-medium max-w-[250px] truncate">{task.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{task.clients?.name || "—"}</td>
                  <td className="px-4 py-3"><span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">{CATEGORY_LABELS[task.category as TaskCategory]}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(task.due_date).toLocaleDateString("pt-PT")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{task.collaborators?.name || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhuma tarefa encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TaskListView;
