import { useState } from "react";
import { LayoutDashboard, ListTodo, Plus, Users, Building2, CalendarDays, LogOut, ClipboardList, ChevronDown, BookOpen, BarChart3, Banknote, LineChart } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onNewTask: () => void;
}

const mainNavItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tasks", label: "Tarefas", icon: ListTodo },
];

const obrigacoesSubItems = [
  { id: "obrigacoes_SAFT", label: "SAFT" },
  { id: "obrigacoes_salarios", label: "Salários" },
  { id: "obrigacoes_DMR", label: "DMR" },
  { id: "obrigacoes_SS_TI", label: "Segurança Social TI" },
  { id: "obrigacoes_IVA", label: "IVA - Periódica" },
  { id: "obrigacoes_IVA_recapitulativa", label: "IVA - Recapitulativa" },
  { id: "obrigacoes_retencao_fonte", label: "Retenção na Fonte" },
  { id: "obrigacoes_emissao_faturas", label: "Emissão de Faturas" },
];

const contabilidadesSubItems = [
  { id: "contabilidades_TI_isento", label: "TI Simplificado - Isento IVA" },
  { id: "contabilidades_TI_iva", label: "TI Simplificado - Reg. IVA" },
  { id: "contabilidades_organizada", label: "TI Contabilidade Organizada" },
  { id: "contabilidades_empresas", label: "Empresas" },
];

const bottomNavItems = [
  { id: "collaborators", label: "Colaboradores", icon: Users },
  { id: "calendar", label: "Calendário Fiscal", icon: CalendarDays },
];

const AppSidebar = ({ activeView, onViewChange, onNewTask }: AppSidebarProps) => {
  const { user, isAdmin, signOut } = useAuth();
  const [obrigacoesOpen, setObrigacoesOpen] = useState(activeView.startsWith("obrigacoes"));
  const [contabilidadesOpen, setContabilidadesOpen] = useState(activeView.startsWith("contabilidades"));

  const isObrigacoesActive = activeView.startsWith("obrigacoes");
  const isContabilidadesActive = activeView.startsWith("contabilidades");

  const handleObrigacoesClick = () => {
    setObrigacoesOpen((prev) => !prev);
    if (!isObrigacoesActive) {
      onViewChange("obrigacoes_SAFT");
    }
  };

  const handleContabilidadesClick = () => {
    setContabilidadesOpen((prev) => !prev);
    if (!isContabilidadesActive) {
      onViewChange("contabilidades_TI_isento");
    }
  };

  const renderNavButton = (item: { id: string; label: string; icon: any }) => (
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
  );

  return (
    <aside className="w-64 bg-primary text-primary-foreground min-h-screen flex flex-col">
      <div className="p-6 flex items-center justify-center">
        <img src={logoWhite} alt="Contabilista Explica" className="w-full max-w-[240px]" />
      </div>


      <nav className="flex-1 px-3">
        {mainNavItems.map(renderNavButton)}

        {/* Obrigações with sub-items */}
        <button
          onClick={handleObrigacoesClick}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors",
            isObrigacoesActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <ClipboardList className="w-4 h-4" />
          <span className="flex-1 text-left">Obrigações</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", obrigacoesOpen && "rotate-180")} />
        </button>
        {obrigacoesOpen && (
          <div className="ml-4 pl-3 border-l border-primary-foreground/20 mb-1">
            {obrigacoesSubItems.map((sub) => (
              <button
                key={sub.id}
                onClick={() => onViewChange(sub.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium mb-0.5 transition-colors",
                  activeView === sub.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-sidebar-accent/50"
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {/* Contabilidades with sub-items */}
        <button
          onClick={handleContabilidadesClick}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors",
            isContabilidadesActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <BookOpen className="w-4 h-4" />
          <span className="flex-1 text-left">Contabilidades</span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", contabilidadesOpen && "rotate-180")} />
        </button>
        {contabilidadesOpen && (
          <div className="ml-4 pl-3 border-l border-primary-foreground/20 mb-1">
            {contabilidadesSubItems.map((sub) => (
              <button
                key={sub.id}
                onClick={() => onViewChange(sub.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium mb-0.5 transition-colors",
                  activeView === sub.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-sidebar-accent/50"
                )}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        {renderNavButton({ id: "clients", label: "Clientes", icon: Building2 })}
        {renderNavButton({ id: "extratos", label: "Extratos Bancários", icon: Banknote })}
        {isAdmin && renderNavButton({ id: "resumo", label: "Resumo Mensal", icon: BarChart3 })}
        {isAdmin && renderNavButton({ id: "collaborators", label: "Colaboradores", icon: Users })}
        {renderNavButton({ id: "calendar", label: "Calendário Fiscal", icon: CalendarDays })}
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
