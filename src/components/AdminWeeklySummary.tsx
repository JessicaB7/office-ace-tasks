import { useState, useMemo } from "react";
import { useClients, useCollaborators, useTasks, useMonthlyObligations } from "@/hooks/useSupabaseQuery";
import { Users, CheckCircle2, AlertTriangle, UserPlus, UserMinus, ChevronLeft, ChevronRight, Building2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const OBLIGATION_LABELS: Record<string, string> = {
  SAFT: "SAFT",
  DMR_AT: "DMR AT",
  DMR_SS: "DMR SS",
  IVA: "IVA Periódica",
  IVA_recapitulativa: "IVA Recapitulativa",
  retencao_fonte: "Retenção na Fonte",
  SS_TI: "SS TI",
  salarios: "Salários",
  emissao_faturas: "Emissão de Faturas",
};

type Tab = "clientes" | "tarefas" | "obrigacoes";

const AdminWeeklySummary = () => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: tasks = [] } = useTasks();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<Tab>("clientes");

  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: obligations = [] } = useMonthlyObligations(referenceMonth);

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Clients: entries based on inicio_contrato
  const newClientsCount = useMemo(() => {
    return clients.filter((c: any) => {
      if (!c.inicio_contrato) return false;
      const d = new Date(c.inicio_contrato);
      return d >= monthStart && d <= monthEnd;
    }).length;
  }, [clients, monthStart, monthEnd]);

  // Clients: exits (deactivated this month)
  const exitClientsCount = useMemo(() => {
    return clients.filter((c: any) => {
      if (c.active) return false;
      const d = new Date(c.updated_at);
      return d >= monthStart && d <= monthEnd;
    }).length;
  }, [clients, monthStart, monthEnd]);

  // Total active clients
  const totalActiveClients = useMemo(() => clients.filter((c: any) => c.active).length, [clients]);

  // Tasks by collaborator
  const collabTaskStats = useMemo(() => {
    const activeCollabs = collaborators.filter((c: any) => c.active);
    return activeCollabs.map((collab: any) => {
      const collabTasks = tasks.filter((t: any) => t.collaborator_id === collab.id);
      const completed = collabTasks.filter((t: any) => {
        if (t.status !== "concluida") return false;
        const d = new Date(t.updated_at);
        return d >= monthStart && d <= monthEnd;
      }).length;
      const pending = collabTasks.filter((t: any) => t.status === "pendente" || t.status === "em_progresso").length;
      const overdue = collabTasks.filter((t: any) => t.status !== "concluida" && t.status !== "cancelada" && new Date(t.due_date) < now).length;
      return { id: collab.id, name: collab.name, completed, pending, overdue };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, collaborators, monthStart, monthEnd, now]);

  const totalCompleted = collabTaskStats.reduce((s, c) => s + c.completed, 0);
  const totalPending = collabTaskStats.reduce((s, c) => s + c.pending, 0);
  const totalOverdue = collabTaskStats.reduce((s, c) => s + c.overdue, 0);

  // Obligations by collaborator
  const collabOblStats = useMemo(() => {
    const activeCollabs = collaborators.filter((c: any) => c.active);
    const activeClients = clients.filter((c: any) => c.active);

    // Group obligations by type
    const oblTypes = Object.keys(OBLIGATION_LABELS);

    return activeCollabs.map((collab: any) => {
      const myClients = activeClients.filter((c: any) => c.responsavel_id === collab.id);
      const myClientIds = new Set(myClients.map((c: any) => c.id));

      const typeStats = oblTypes.map((type) => {
        const typeObls = obligations.filter((o: any) => o.obligation_type === type && myClientIds.has(o.client_id));
        const done = typeObls.filter((o: any) => o.status === "concluida").length;
        return { type, label: OBLIGATION_LABELS[type], total: myClients.length, done };
      });

      const totalDone = typeStats.reduce((s, t) => s + t.done, 0);
      const totalAll = typeStats.reduce((s, t) => s + t.total, 0);

      return { id: collab.id, name: collab.name, typeStats, totalDone, totalAll, clientCount: myClients.length };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [collaborators, clients, obligations]);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "clientes", label: "Clientes", icon: Building2 },
    { id: "tarefas", label: "Tarefas", icon: ClipboardList },
    { id: "obrigacoes", label: "Obrigações", icon: CheckCircle2 },
  ];

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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Clientes Tab */}
      {activeTab === "clientes" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border p-5 text-center">
            <UserPlus className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold">{newClientsCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Entradas</p>
          </div>
          <div className="bg-card rounded-xl border p-5 text-center">
            <UserMinus className="w-6 h-6 text-destructive mx-auto mb-2" />
            <p className="text-3xl font-bold">{exitClientsCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Saídas</p>
          </div>
          <div className="bg-card rounded-xl border p-5 text-center">
            <Building2 className="w-6 h-6 text-foreground mx-auto mb-2" />
            <p className="text-3xl font-bold">{totalActiveClients}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Atual</p>
          </div>
        </div>
      )}

      {/* Tarefas Tab */}
      {activeTab === "tarefas" && (
        <div className="bg-card rounded-xl border overflow-hidden">
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
                {collabTaskStats.map((c) => (
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
                {collabTaskStats.length > 0 && (
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
      )}

      {/* Obrigações Tab */}
      {activeTab === "obrigacoes" && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Colaborador</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-16">Clientes</th>
                  {Object.values(OBLIGATION_LABELS).map((label) => (
                    <th key={label} className="text-center px-2 py-2.5 font-semibold text-muted-foreground text-xs w-16">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {collabOblStats.map((collab) => (
                  <tr key={collab.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{collab.name}</td>
                    <td className="text-center px-3 py-2.5 text-xs text-muted-foreground">{collab.clientCount}</td>
                    {collab.typeStats.map((ts) => (
                      <td key={ts.type} className="text-center px-2 py-2.5">
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                          ts.done === ts.total && ts.total > 0
                            ? "bg-success/10 text-success"
                            : ts.done > 0
                            ? "bg-warning/10 text-warning"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {ts.done}/{ts.total}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminWeeklySummary;
