import { useState } from "react";
import { Task, TaskStatus, TaskCategory, STATUS_LABELS, CATEGORY_LABELS } from "@/types/task";
import { StatusBadge, PriorityBadge } from "@/components/TaskBadge";
import { Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskListViewProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
}

const TaskListView = ({ tasks, onEditTask }: TaskListViewProps) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "all">("all");

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.client.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Tarefas</h2>
        <p className="text-muted-foreground text-sm mt-1">Gerir todas as tarefas do gabinete</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar tarefa ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "all")}
            className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todos os estados</option>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as TaskCategory | "all")}
            className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Todas as categorias</option>
            {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
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
              {filtered.map((task, i) => (
                <tr
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className={cn(
                    "border-b last:border-0 cursor-pointer hover:bg-muted/30 transition-colors animate-fade-in",
                  )}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <td className="px-4 py-3 font-medium max-w-[250px] truncate">{task.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{task.client}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">{CATEGORY_LABELS[task.category]}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(task.dueDate).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{task.assignee}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhuma tarefa encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TaskListView;
