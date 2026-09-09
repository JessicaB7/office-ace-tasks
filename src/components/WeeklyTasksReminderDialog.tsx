import { useEffect, useMemo, useRef, useState } from "react";
import { useTasks, useCollaborators } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
import { PRIORITY_LABELS, type TaskPriority } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";

const STORAGE_KEY = "tasksReminderLastShownAt";
const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 em 2 horas
const CHECK_EVERY_MS = 60 * 1000; // verifica a cada minuto se já passaram as 2h

/** Pop-up com as tarefas da semana do utilizador atual — reaparece de 2 em 2 horas enquanto a app estiver aberta. */
const WeeklyTasksReminderDialog = ({ onViewTasks }: { onViewTasks?: () => void }) => {
  const { user } = useAuth();
  const { data: tasks = [] } = useTasks();
  const { data: collaborators = [] } = useCollaborators();
  const [open, setOpen] = useState(false);

  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    return collaborators.find((c: any) => c.email.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [user, collaborators]);

  const weekTasks = useMemo(() => {
    if (!currentCollaborator) return [];
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return tasks
      .filter((t: any) => t.collaborator_id === currentCollaborator.id)
      .filter((t: any) => t.status !== "concluida" && t.status !== "cancelada")
      .filter((t: any) => {
        const due = new Date(t.due_date);
        return due <= sunday; // inclui atrasadas + esta semana
      })
      .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [tasks, currentCollaborator]);

  // Guarda a contagem mais recente de tarefas numa ref para o intervalo não
  // depender de recriar o timer sempre que a lista de tarefas muda.
  const weekTasksCountRef = useRef(0);
  weekTasksCountRef.current = weekTasks.length;

  useEffect(() => {
    if (!currentCollaborator) return;

    const maybeShow = () => {
      if (weekTasksCountRef.current === 0) return;
      const lastShownAt = Number(localStorage.getItem(STORAGE_KEY) || 0);
      const now = Date.now();
      if (now - lastShownAt >= INTERVAL_MS) {
        setOpen(true);
        try {
          localStorage.setItem(STORAGE_KEY, String(now));
        } catch {
          // localStorage indisponível — o pop-up ainda assim é mostrado nesta sessão
        }
      }
    };

    maybeShow(); // mostra logo ao abrir a app, se já passaram 2h desde a última vez
    const id = setInterval(maybeShow, CHECK_EVERY_MS);
    return () => clearInterval(id);
  }, [currentCollaborator]);

  const dismiss = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" /> Tarefas da semana
          </DialogTitle>
          <DialogDescription>
            {currentCollaborator?.name ? `Olá, ${currentCollaborator.name.split(" ")[0]}. ` : ""}
            Tem {weekTasks.length} tarefa{weekTasks.length !== 1 ? "s" : ""} pendente{weekTasks.length !== 1 ? "s" : ""} para esta semana.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[320px] overflow-y-auto divide-y border rounded-lg">
          {weekTasks.map((task: any) => {
            const isOverdue = new Date(task.due_date) < new Date(new Date().toDateString());
            return (
              <div key={task.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.clients?.name || "—"} · {PRIORITY_LABELS[task.priority as TaskPriority]}
                  </p>
                </div>
                <span className={`text-xs whitespace-nowrap ml-3 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {new Date(task.due_date).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>Fechar</Button>
          {onViewTasks && (
            <Button
              onClick={() => {
                dismiss();
                onViewTasks();
              }}
            >
              Ver tarefas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyTasksReminderDialog;
