import { useState } from "react";
import {
  LayoutDashboard,
  ListTodo,
  Users,
  Building2,
  CalendarDays,
  LogOut,
  ClipboardList,
  ChevronDown,
  BookOpen,
  BarChart3,
  Banknote,
  LineChart,
  Gauge,
} from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onNewTask: () => void;
}

type Item = { id: string; label: string; icon?: any; adminOnly?: boolean };
type Group = { id: string; label: string; icon: any; adminOnly?: boolean; items: Item[] };
type Entry = { kind: "item"; item: Item } | { kind: "group"; group: Group };

const SECTIONS: { title: string; entries: Entry[] }[] = [
  {
    title: "Visão geral",
    entries: [
      { kind: "item", item: { id: "business", label: "Painel do negócio", icon: Gauge } },
      { kind: "item", item: { id: "dashboard", label: "O meu dia", icon: LayoutDashboard } },
      { kind: "item", item: { id: "resumo", label: "Resumo Mensal", icon: BarChart3, adminOnly: true } },
    ],
  },
  {
    title: "Clientes",
    entries: [
      { kind: "item", item: { id: "clients", label: "Clientes", icon: Building2 } },
      {
        kind: "group",
        group: {
          id: "contabilidades",
          label: "Contabilidades",
          icon: BookOpen,
          items: [
            { id: "contabilidades_TI_isento", label: "TI Simplificado - Isento IVA" },
            { id: "contabilidades_TI_iva", label: "TI Simplificado - Reg. IVA" },
            { id: "contabilidades_organizada", label: "TI Contabilidade Organizada" },
            { id: "contabilidades_empresas", label: "Empresas" },
          ],
        },
      },
      {
        kind: "group",
        group: {
          id: "analise",
          label: "Análise Financeira",
          icon: LineChart,
          items: [
            { id: "analise_TI_simplificado", label: "TI Simplificado" },
            { id: "analise_TI_organizado", label: "TI Organizado" },
            { id: "analise_empresas", label: "Empresas" },
          ],
        },
      },
    ],
  },
  {
    title: "Trabalho",
    entries: [
      { kind: "item", item: { id: "tasks", label: "Tarefas", icon: ListTodo } },
      {
        kind: "group",
        group: {
          id: "obrigacoes",
          label: "Obrigações",
          icon: ClipboardList,
          items: [
            { id: "obrigacoes_SAFT", label: "SAFT" },
            { id: "obrigacoes_salarios", label: "Salários" },
            { id: "obrigacoes_DMR", label: "DMR" },
            { id: "obrigacoes_SS_TI", label: "Segurança Social TI" },
            { id: "obrigacoes_IVA", label: "IVA - Periódica" },
            { id: "obrigacoes_IVA_recapitulativa", label: "IVA - Recapitulativa" },
            { id: "obrigacoes_retencao_fonte", label: "Retenção na Fonte" },
            { id: "obrigacoes_emissao_faturas", label: "Emissão de Faturas" },
          ],
        },
      },
      { kind: "item", item: { id: "calendar", label: "Calendário Fiscal", icon: CalendarDays } },
    ],
  },
  {
    title: "Escritório",
    entries: [
      { kind: "item", item: { id: "collaborators", label: "Colaboradores", icon: Users, adminOnly: true } },
      { kind: "item", item: { id: "extratos", label: "Extratos Bancários", icon: Banknote } },
    ],
  },
];

const AppSidebar = ({ activeView, onViewChange }: AppSidebarProps) => {
  const { user, isAdmin, signOut } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    contabilidades: activeView.startsWith("contabilidades"),
    analise: activeView.startsWith("analise"),
    obrigacoes: activeView.startsWith("obrigacoes"),
  });

  const itemClass = (active: boolean) =>
    cn(
      "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-sidebar-accent/50"
    );

  const handleGroupClick = (group: Group) => {
    const isActive = activeView.startsWith(group.id);
    setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }));
    if (!isActive) onViewChange(group.items[0].id);
  };

  return (
    <aside className="w-64 bg-primary text-primary-foreground min-h-screen flex flex-col">
      <div className="p-6 flex items-center justify-center">
        <img src={logoWhite} alt="Contabilista Explica" className="w-full max-w-[240px]" />
      </div>

      <nav className="flex-1 px-3 pb-4 overflow-y-auto">
        {SECTIONS.map((section) => {
          const entries = section.entries.filter((e) =>
            e.kind === "item" ? !e.item.adminOnly || isAdmin : !e.group.adminOnly || isAdmin
          );
          if (entries.length === 0) return null;
          return (
            <div key={section.title} className="mb-4">
              <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/40">
                {section.title}
              </p>
              {entries.map((entry) => {
                if (entry.kind === "item") {
                  const item = entry.item;
                  return (
                    <button key={item.id} onClick={() => onViewChange(item.id)} className={itemClass(activeView === item.id)}>
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  );
                }
                const group = entry.group;
                const isActive = activeView.startsWith(group.id);
                const open = openGroups[group.id];
                return (
                  <div key={group.id}>
                    <button onClick={() => handleGroupClick(group)} className={itemClass(isActive)}>
                      <group.icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{group.label}</span>
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
                    </button>
                    {open && (
                      <div className="ml-4 pl-3 border-l border-primary-foreground/20 mb-1">
                        {group.items.map((sub) => (
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
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="p-4 mx-3 mb-2 rounded-lg bg-sidebar-accent/50 text-xs text-primary-foreground/60">
        <p className="font-medium text-primary-foreground/80 mb-1">{user?.email}</p>
        <p>Período fiscal 2026</p>
      </div>
      <div className="px-4 mb-4">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-primary-foreground/60 hover:text-primary-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Terminar sessão
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
