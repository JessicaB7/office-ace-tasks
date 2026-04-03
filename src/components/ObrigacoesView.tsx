import { useState, useEffect } from "react";
import { useTasks } from "@/hooks/useSupabaseQuery";
import { STATUS_LABELS, CATEGORY_LABELS, type TaskStatus, type TaskCategory } from "@/types/database";
import { StatusBadge, PriorityBadge } from "@/components/TaskBadge";
import { Search, Filter } from "lucide-react";

const OBRIGACAO_CATEGORIES: { id: TaskCategory; label: string }[] = [
  { id: "SAFT", label: "SAFT" },
  { id: "salarios", label: "Salários" },
  { id: "DMR", label: "DMR" },
  { id: "SS_TI", label: "Segurança Social TI" },
  { id: "IVA", label: "IVA" },
  { id: "retencao_fonte", label: "Retenção na Fonte" },
  { id: "emissao_faturas", label: "Emissão de Faturas" },
];

interface ObrigacoesViewProps {
  subPage?: string;
  onEditTask: (task: any) => void;
}

const ObrigacoesView = ({ subPage, onEditTask }: ObrigacoesViewProps) => {
  const { data: tasks = [], isLoading } = useTasks();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [activeTab, setActiveTab] = useState<string>(subPage || OBRIGACAO_CATEGORIES[0].id);

  const filtered = tasks.filter((t: any) => {
    if (t.category !== activeTab) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.title.toLowerCase().includes(s) && !(t.clients?.name || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const getCategoryCount = (cat: string) => tasks.filter((t: any) => t.category === cat).length;

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Obrigações</h2>
        <p className="text-muted-foreground text-sm mt-1">Obrigações fiscais e contabilísticas</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b">
        {OBRIGACAO_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              activeTab === cat.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {cat.label} ({getCategoryCount(cat.id)})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "all")} className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">Todos os estados</option>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
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
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(task.due_date).toLocaleDateString("pt-PT")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{task.collaborators?.name || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhuma obrigação encontrada nesta categoria</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ObrigacoesView;
