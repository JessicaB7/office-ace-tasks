import { useEffect, useMemo, useRef, useState } from "react";
import { useTasks, useCollaborators } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
import { PRIORITY_LABELS, type TaskPriority } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import { shouldShowPendingReminder, dueGroup, type DueGroup } from "@/lib/dailyReminder";

const CHECK_EVERY_MS = 60 * 1000; // verifica a cada minuto se já passaram 2 horas

const GROUPS: { key: DueGroup; label: string; cls: string }[] = [
  { key: "atrasadas", label: "Em atraso", cls: "text-destructive" },
  { key: "hoje", label: "Para hoje", cls: "text-primary" },
  { key: "proximas", label: "Próximas", cls: "text-muted-foreground" },
];

/** Pop-up com as tarefas pendentes do utilizador atual: ao abrir a app e depois de 2 em 2 horas
 * (o último instante fica guardado no browser, para não repetir ao recarregar a página). */
const DailyTasksReminderDialog = ({ onViewTasks }: { onViewTasks?: () => void }) => {
  const { user, isAdmin } = useAuth();
  const { data: tasks = [], isFetched } = useTasks();
  const { data: collaborators = [] } = useCollaborators();
  const [open, setOpen] = useState(false);

  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    const byEmail = collaborators.find((c: any) => c.email.toLowerCase() === user.email!.toLowerCase());
    // A admin (geral@) não tem ficha de colaborador própria: vê as tarefas da Responsável.
    return byEmail || (isAdmin ? collaborators.find((c: any) => c.role === "Responsável") : null) || null;
  }, [user, collaborators, isAdmin]);

  const pendingTasks = useMemo(() => {
    if (!currentCollaborator) return [];
    return tasks
      .filter((t: any) => t.collaborator_id === currentCollaborator.id)
      .filter((t: any) => t.status !== "concluida" && t.status !== "cancelada")
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [tasks, currentCollaborator]);

  const now = new Date();
  const grouped = useMemo(() => {
    const g: Record<DueGroup, any[]> = { atrasadas: [], hoje: [], proximas: [] };
    pendingTasks.forEach((t: any) => g[dueGroup(t.due_date, new Date())].push(t));
    return g;
  }, [pendingTasks, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contagem mais recente numa ref, para o intervalo não depender da lista de tarefas.
  const countRef = useRef(0);
  countRef.current = pendingTasks.length;

  useEffect(() => {
    if (!currentCollaborator || !isFetched) return;
    const storageKey = `pendingTasksReminder:${currentCollaborator.id}`;

    const maybeShow = () => {
      let last: number | null = null;
      try { const v = localStorage.getItem(storageKey); last = v ? Number(v) : null; } catch { /* sem localStorage */ }
      const now = Date.now();
      if (!shouldShowPendingReminder(now, last)) return;
      if (countRef.current === 0) return;
      try { localStorage.setItem(storageKey, String(now)); } catch { /* sem localStorage */ }
      setOpen(true);
    };

    maybeShow();
    const id = setInterval(maybeShow, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [currentCollaborator, isFetched]);

  const dismiss = () => setOpen(false);
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 20 ? "Boa tarde" : "Boa noite";
  const firstName = currentCollaborator?.name?.split(" ")[0];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" /> Tarefas pendentes
          </DialogTitle>
          <DialogDescription>
            {greeting}{firstName ? `, ${firstName}` : ""}. Tem {pendingTasks.length} tarefa{pendingTasks.length !== 1 ? "s" : ""} pendente{pendingTasks.length !== 1 ? "s" : ""}
            {grouped.atrasadas.length > 0 && `, ${grouped.atrasadas.length} em atraso`}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[360px] overflow-y-auto border rounded-lg">
          {GROUPS.filter((g) => grouped[g.key].length > 0).map((g) => (
            <div key={g.key}>
              <div className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide bg-muted/40 ${g.cls}`}>
                {g.label} ({grouped[g.key].length})
              </div>
              <div className="divide-y">
                {grouped[g.key].map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {task.clients?.name || "—"} · {PRIORITY_LABELS[task.priority as TaskPriority]}
                      </p>
                    </div>
                    <span className={`text-xs whitespace-nowrap ml-3 ${g.key === "atrasadas" ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {new Date(task.due_date).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>Fechar</Button>
          {onViewTasks && (
            <Button onClick={() => { dismiss(); onViewTasks(); }}>Ver tarefas</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DailyTasksReminderDialog;
