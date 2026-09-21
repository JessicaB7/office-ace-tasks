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
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  BarChart3,
  Banknote,
  LineChart,
  Gauge,
  TrendingUp,
  Filter,
  UserPlus,
  FileText,
  CalendarClock,
  MessageSquareQuote,


} from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useContabilidadesPending } from "@/hooks/useContabilidadesPending";

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
      { kind: "item", item: { id: "dashboard", label: "O meu dia a dia", icon: LayoutDashboard } },
      { kind: "item", item: { id: "tasks", label: "Tarefas", icon: ListTodo } },
      { kind: "item", item: { id: "calendar", label: "Calendário Fiscal", icon: CalendarDays } },
    ],
  },
  {
    title: "Comercial",
    entries: [
      { kind: "item", item: { id: "pipeline", label: "Pipeline", icon: Filter } },
      { kind: "item", item: { id: "leads", label: "Leads", icon: UserPlus } },
      { kind: "item", item: { id: "propostas", label: "Propostas enviadas", icon: FileText } },
      { kind: "item", item: { id: "followups", label: "Follow ups", icon: CalendarClock } },
      { kind: "item", item: { id: "scripts", label: "Scripts", icon: MessageSquareQuote } },
    ],
  },
  {
    title: "Consultorias",
    entries: [
      { kind: "item", item: { id: "consultoria_leads", label: "Leads", icon: UserPlus } },
      { kind: "item", item: { id: "consultoria_followups", label: "Follow ups", icon: CalendarClock } },
    ],
  },
  {
    title: "Clientes",
    entries: [
      { kind: "item", item: { id: "clients", label: "Dados de clientes", icon: Building2 } },
      {
        kind: "group",
        group: {
          id: "contabilidades",
          label: "Gestão Mensal",
          icon: BookOpen,
          items: [
            { id: "contabilidades_painel", label: "Painel" },
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
          id: "obrigacoes",
          label: "Obrigações Mensais",
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
      { kind: "item", item: { id: "extratos", label: "Extratos Bancários", icon: Banknote } },
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
    title: "Gestão de negócio",
    entries: [
      { kind: "item", item: { id: "business", label: "Painel do negócio", icon: Gauge, adminOnly: true } },
      { kind: "item", item: { id: "comercial", label: "Painel comercial", icon: TrendingUp, adminOnly: true } },
      { kind: "item", item: { id: "consultorias_painel", label: "Painel de consultorias", icon: MessageSquareQuote, adminOnly: true } },
      { kind: "item", item: { id: "collaborators", label: "Colaboradores", icon: Users, adminOnly: true } },
      { kind: "item", item: { id: "resumo", label: "Resumo Mensal", icon: BarChart3, adminOnly: true } },
    ],
  },
];

const SIDEBAR_COLLAPSED_KEY = "appSidebarCollapsed";

const AppSidebar = ({ activeView, onViewChange }: AppSidebarProps) => {

  const { user, isAdmin, signOut } = useAuth();
  const { perTab: contabPending, totalPending: contabTotalPending } = useContabilidadesPending();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    contabilidades: activeView.startsWith("contabilidades"),
    analise: activeView.startsWith("analise"),
    obrigacoes: activeView.startsWith("obrigacoes"),
  });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage indisponível — a preferência só dura esta sessão
      }
      return next;
    });
  };

  const itemClass = (active: boolean) =>
    cn(
      "w-full flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors",
      collapsed ? "justify-center px-0" : "px-4",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-sidebar-accent/50"
    );

  const handleGroupClick = (group: Group) => {
    if (collapsed) {
      setCollapsed(false);
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "0"); } catch { /* ignora */ }
      setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
      return;
    }
    const isActive = activeView.startsWith(group.id);
    setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }));
    if (!isActive) onViewChange(group.items[0].id);
  };

  return (
    <aside className={cn("bg-primary text-primary-foreground min-h-screen flex flex-col transition-[width] duration-200",
      collapsed ? "w-[68px]" : "w-64")}>
      <div className={cn("flex items-center", collapsed ? "flex-col gap-2 p-3" : "justify-between p-4")}>
        {collapsed ? (
          <div className="w-9 h-9 rounded-lg bg-primary-foreground/15 flex items-center justify-center font-bold text-xs shrink-0" title="Contabilista Explica">
            CE
          </div>
        ) : (
          <img src={logoWhite} alt="Contabilista Explica" className="max-w-[190px]" />
        )}
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg text-primary-foreground/60 hover:text-primary-foreground hover:bg-sidebar-accent/50 transition-colors shrink-0"
          title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 px-3 pb-4 overflow-y-auto overflow-x-hidden">
        {SECTIONS.map((section) => {
          const entries = section.entries.filter((e) =>
            e.kind === "item" ? !e.item.adminOnly || isAdmin : !e.group.adminOnly || isAdmin
          );
          if (entries.length === 0) return null;
          return (
            <div key={section.title} className="mb-4">
              {collapsed ? (
                <div className="mx-2 mb-1.5 border-t border-primary-foreground/15" />
              ) : (
                <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/40">
                  {section.title}
                </p>
              )}
              {entries.map((entry) => {
                if (entry.kind === "item") {
                  const item = entry.item;
                  return (
                    <button key={item.id} onClick={() => onViewChange(item.id)} className={itemClass(activeView === item.id)}
                      title={collapsed ? item.label : undefined}>
                      {item.icon && <item.icon className="w-4 h-4 shrink-0" />}
                      {!collapsed && item.label}
                    </button>
                  );
                }
                const group = entry.group;
                const isActive = activeView.startsWith(group.id);
                const open = openGroups[group.id] && !collapsed;
                const isContabilidades = group.id === "contabilidades";
                return (
                  <div key={group.id}>
                    <button onClick={() => handleGroupClick(group)} className={cn(itemClass(isActive), "relative")}
                      title={collapsed ? group.label : undefined}>
                      <group.icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="flex-1 text-left">{group.label}</span>}
                      {isContabilidades && contabTotalPending > 0 && (
                        collapsed ? (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-warning" />
                        ) : (
                          <span className="text-[10px] font-semibold bg-warning text-warning-foreground px-1.5 py-0.5 rounded-full mr-1">
                            {contabTotalPending}
                          </span>
                        )
                      )}
                      {!collapsed && <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />}
                    </button>
                    {open && (
                      <div className="ml-4 pl-3 border-l border-primary-foreground/20 mb-1">
                        {group.items.map((sub) => {
                          const subPending = isContabilidades
                            ? contabPending[sub.id.replace("contabilidades_", "")]?.pending
                            : undefined;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => onViewChange(sub.id)}
                              className={cn(
                                "w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-lg text-xs font-medium mb-0.5 transition-colors",
                                activeView === sub.id
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                  : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-sidebar-accent/50"
                              )}
                            >
                              <span className="flex-1 truncate">{sub.label}</span>
                              {!!subPending && (
                                <span className="text-[10px] font-semibold bg-primary-foreground/15 px-1.5 py-0.5 rounded-full shrink-0">
                                  {subPending}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 mx-3 mb-2 rounded-lg bg-sidebar-accent/50 text-xs text-primary-foreground/60">
          <p className="font-medium text-primary-foreground/80 mb-1 truncate">{user?.email}</p>
          <p>Período fiscal 2026</p>
        </div>
      )}
      <div className={cn("mb-4", collapsed ? "px-3" : "px-4")}>
        <button
          onClick={signOut}
          title={collapsed ? "Terminar sessão" : undefined}
          className={cn(
            "w-full flex items-center gap-2 py-2 rounded-lg text-sm text-primary-foreground/60 hover:text-primary-foreground hover:bg-sidebar-accent/50 transition-colors",
            collapsed ? "justify-center px-0" : "px-4"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" /> {!collapsed && "Terminar sessão"}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
