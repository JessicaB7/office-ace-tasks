import { LayoutDashboard, ListTodo, Plus, Users, Building2, CalendarDays, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onNewTask: () => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tasks", label: "Tarefas", icon: ListTodo },
  { id: "clients", label: "Clientes", icon: Building2 },
  { id: "collaborators", label: "Colaboradores", icon: Users },
  { id: "calendar", label: "Calendário Fiscal", icon: CalendarDays },
];

const AppSidebar = ({ activeView, onViewChange, onNewTask }: AppSidebarProps) => {
  const { user, signOut } = useAuth();

  return (
    <aside className="w-64 bg-primary text-primary-foreground min-h-screen flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <img src={logo} alt="Contabilista Explica" className="h-8" />
      </div>
        </div>
      </div>

      <div className="px-4 mb-6">
        <button onClick={onNewTask} className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Nova Tarefa
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

      <div className="p-4 mx-3 mb-2 rounded-lg bg-sidebar-accent/50 text-xs text-primary-foreground/60">
        <p className="font-medium text-primary-foreground/80 mb-1">{user?.email}</p>
        <p>Período fiscal 2026</p>
      </div>
      <div className="px-4 mb-4">
        <button onClick={signOut} className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-primary-foreground/60 hover:text-primary-foreground hover:bg-sidebar-accent/50 transition-colors">
          <LogOut className="w-4 h-4" /> Terminar sessão
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
