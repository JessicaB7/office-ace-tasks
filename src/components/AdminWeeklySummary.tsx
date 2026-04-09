import { useMemo } from "react";
import { useClients, useCollaborators, useTasks } from "@/hooks/useSupabaseQuery";
import { Users, CheckCircle2, AlertTriangle, UserPlus } from "lucide-react";

const AdminWeeklySummary = () => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: tasks = [] } = useTasks();

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const newClients = useMemo(() => {
    return clients.filter((c: any) => new Date(c.created_at) >= weekAgo);
  }, [clients, weekAgo]);

  const completedByCollab = useMemo(() => {
    const completed = tasks.filter(
      (t: any) => t.status === "concluida" && new Date(t.updated_at) >= weekAgo
    );
    const map: Record<string, { name: string; count: number }> = {};
    completed.forEach((t: any) => {
      const collab = collaborators.find((c: any) => c.id === t.collaborator_id);
      const key = t.collaborator_id || "__none__";
      if (!map[key]) map[key] = { name: collab?.name || "Sem responsável", count: 0 };
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [tasks, collaborators, weekAgo]);

  const overdueByCollab = useMemo(() => {
    const overdue = tasks.filter(
      (t: any) => t.status !== "concluida" && t.status !== "cancelada" && new Date(t.due_date) < now
    );
    const map: Record<string, { name: string; tasks: { title: string; dueDate: string; clientName: string }[] }> = {};
    overdue.forEach((t: any) => {
      const collab = collaborators.find((c: any) => c.id === t.collaborator_id);
      const key = t.collaborator_id || "__none__";
      if (!map[key]) map[key] = { name: collab?.name || "Sem responsável", tasks: [] };
      map[key].tasks.push({
        title: t.title,
        dueDate: new Date(t.due_date).toLocaleDateString("pt-PT"),
        clientName: t.clients?.name || "—",
      });
    });
    return Object.values(map).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [tasks, collaborators, now]);

  const totalCompleted = completedByCollab.reduce((s, c) => s + c.count, 0);
  const totalOverdue = overdueByCollab.reduce((s, c) => s + c.tasks.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Resumo Semanal
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Últimos 7 dias</p>
      </div>

      {/* New Clients */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm">Novos Clientes</h4>
          <span className="ml-auto text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{newClients.length}</span>
        </div>
        {newClients.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum cliente adicionado esta semana</p>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {newClients.map((c: any) => (
              <div key={c.id} className="px-3 py-2 text-sm flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-PT")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Tasks by Collaborator */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <h4 className="font-semibold text-sm">Tarefas Concluídas por Colaborador</h4>
          <span className="ml-auto text-xs font-medium bg-success/10 text-success px-2 py-0.5 rounded-full">{totalCompleted}</span>
        </div>
        {completedByCollab.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma tarefa concluída esta semana</p>
        ) : (
          <div className="divide-y border rounded-lg overflow-hidden">
            {completedByCollab.map((c) => (
              <div key={c.name} className="px-3 py-2 text-sm flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs font-semibold bg-success/10 text-success px-2 py-0.5 rounded-full">{c.count} tarefas</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue Tasks by Collaborator */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h4 className="font-semibold text-sm">Tarefas em Atraso por Colaborador</h4>
          <span className="ml-auto text-xs font-medium bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{totalOverdue}</span>
        </div>
        {overdueByCollab.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma tarefa em atraso</p>
        ) : (
          <div className="space-y-2">
            {overdueByCollab.map((group) => (
              <div key={group.name} className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>{group.name}</span>
                  <span className="text-destructive">{group.tasks.length} em atraso</span>
                </div>
                {group.tasks.map((t, i) => (
                  <div key={i} className="px-3 py-1.5 text-xs border-t flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-muted-foreground ml-1">· {t.clientName}</span>
                    </div>
                    <span className="text-destructive text-xs ml-2 shrink-0">{t.dueDate}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminWeeklySummary;
