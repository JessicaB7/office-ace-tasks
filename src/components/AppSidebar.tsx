import { LayoutDashboard, ListTodo, Plus, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onNewTask: () => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tasks", label: "Tarefas", icon: ListTodo },
];

const AppSidebar = ({ activeView, onViewChange, onNewTask }: AppSidebarProps) => {
  return (
    <aside className="w-64 bg-primary text-primary-foreground min-h-screen flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
          <Calculator className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">ContaTask</h1>
          <p className="text-xs opacity-70">Gestão de Tarefas</p>
        </div>
      </div>

      <div className="px-4 mb-6">
        <button
          onClick={onNewTask}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nova Tarefa
        </button>
      </div>

      <nav className="flex-1 px-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors",
              activeView === item.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 mx-3 mb-4 rounded-lg bg-sidebar-accent/50 text-xs text-primary-foreground/60">
        <p className="font-medium text-primary-foreground/80 mb-1">Gabinete Contabilidade</p>
        <p>Período fiscal 2026</p>
      </div>
    </aside>
  );
};

export default AppSidebar;
