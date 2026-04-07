import { X, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTasks, useClients, useMonthlyObligations } from "@/hooks/useSupabaseQuery";
import type { Collaborator } from "@/types/database";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { pt } from "date-fns/locale";
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS } from "@/types/database";

interface Props {
  collaborator: Collaborator;
  onClose: () => void;
}

const CollaboratorDetailDialog = ({ collaborator, onClose }: Props) => {
  const { data: tasks = [] } = useTasks();
  const { data: clients = [] } = useClients();

  const now = new Date();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  const currentMonth = format(now, "yyyy-MM-01");

  const { data: obligations = [] } = useMonthlyObligations(currentMonth);

  // Pending tasks for this collaborator
  const pendingTasks = tasks.filter(
    (t: any) => t.collaborator_id === collaborator.id && (t.status === "pendente" || t.status === "em_progresso")
  );

  // This week's tasks
  const thisWeekTasks = pendingTasks.filter((t: any) => {
    const due = new Date(t.due_date);
    return due <= weekEnd;
  });

  // Next week's tasks
  const nextWeekTasks = pendingTasks.filter((t: any) => {
    const due = new Date(t.due_date);
    return due > weekEnd && due <= nextWeekEnd;
  });

  // Other pending tasks
  const otherTasks = pendingTasks.filter((t: any) => {
    const due = new Date(t.due_date);
    return due > nextWeekEnd;
  });

  // Clients assigned to this collaborator
  const collabClientIds = clients
    .filter((c) => c.responsavel_id === collaborator.id && c.active)
    .map((c) => c.id);

  // Pending obligations for collaborator's clients
  const pendingObligations = obligations.filter(
    (o: any) => collabClientIds.includes(o.client_id) && o.status === "pendente"
  );

  // Get client name
  const clientName = (clientId: string) => clients.find((c) => c.id === clientId)?.name || "—";

  const priorityColor: Record<string, string> = {
    urgente: "text-destructive",
    alta: "text-warning",
    media: "text-foreground",
    baixa: "text-muted-foreground",
  };

  const clientCounts = (() => {
    const collabClients = clients.filter(c => c.responsavel_id === collaborator.id && c.active);
    let totalMensalidade = 0;
    const byType: Record<string, number> = {};
    for (const c of collabClients) {
      const tipo = c.tipo_contabilidade || "Sem tipo";
      byType[tipo] = (byType[tipo] || 0) + 1;
      if (c.mensalidade) totalMensalidade += Number(c.mensalidade);
    }
    return { total: collabClients.length, byType, totalMensalidade };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h3 className="text-lg font-bold">{collaborator.name}</h3>
            <p className="text-sm text-muted-foreground">{collaborator.role} · {collaborator.email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground">Tarefas pendentes</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{pendingObligations.length}</p>
              <p className="text-xs text-muted-foreground">Obrigações pendentes</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-primary">{clientCounts.totalMensalidade.toFixed(0)}€</p>
              <p className="text-xs text-muted-foreground">{clientCounts.total} clientes</p>
            </div>
          </div>

          {/* This week's tasks */}
          <Section title="Tarefas desta semana" count={thisWeekTasks.length} icon={<AlertTriangle className="w-4 h-4 text-warning" />}>
            {thisWeekTasks.map((t: any) => (
              <TaskRow key={t.id} task={t} clientName={t.clients?.name} priorityColor={priorityColor} />
            ))}
          </Section>

          {/* Next week's tasks */}
          <Section title="Tarefas da próxima semana" count={nextWeekTasks.length} icon={<Clock className="w-4 h-4 text-muted-foreground" />}>
            {nextWeekTasks.map((t: any) => (
              <TaskRow key={t.id} task={t} clientName={t.clients?.name} priorityColor={priorityColor} />
            ))}
          </Section>

          {/* Other pending */}
          {otherTasks.length > 0 && (
            <Section title="Outras tarefas pendentes" count={otherTasks.length} icon={<Clock className="w-4 h-4 text-muted-foreground" />}>
              {otherTasks.map((t: any) => (
                <TaskRow key={t.id} task={t} clientName={t.clients?.name} priorityColor={priorityColor} />
              ))}
            </Section>
          )}

          {/* Pending obligations */}
          <Section title={`Obrigações pendentes — ${format(now, "MMMM yyyy", { locale: pt })}`} count={pendingObligations.length} icon={<CheckCircle2 className="w-4 h-4 text-accent" />}>
            {pendingObligations.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 text-sm">
                <div>
                  <span className="font-medium">{o.obligation_type}</span>
                  <span className="text-muted-foreground ml-2">· {clientName(o.client_id)}</span>
                </div>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, count, icon, children }: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h4 className="text-sm font-semibold">{title}</h4>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
    {count === 0 ? (
      <p className="text-xs text-muted-foreground pl-6">Nenhum item</p>
    ) : (
      <div className="space-y-0.5">{children}</div>
    )}
  </div>
);

const TaskRow = ({ task, clientName, priorityColor }: { task: any; clientName?: string; priorityColor: Record<string, string> }) => (
  <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 text-sm">
    <div className="flex-1 min-w-0">
      <span className="font-medium">{task.title}</span>
      {clientName && <span className="text-muted-foreground ml-2">· {clientName}</span>}
    </div>
    <div className="flex items-center gap-2 shrink-0 ml-3">
      <span className={`text-xs font-medium ${priorityColor[task.priority] || ""}`}>
        {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS] || task.priority}
      </span>
      <span className="text-xs text-muted-foreground">
        {format(new Date(task.due_date), "dd/MM")}
      </span>
    </div>
  </div>
);

export default CollaboratorDetailDialog;
