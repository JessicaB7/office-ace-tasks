import { useEffect, useMemo, useRef, useState } from "react";
import { useNotifications, useMarkRead } from "@/hooks/useNotifications";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListTodo, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const DIAS = 14; // avisos mais antigos ficam só no sino

const titulo = (lista: any[]) => {
  const novas = lista.filter((n) => n.type === "task_assigned").length;
  const feitas = lista.length - novas;
  const partes = [
    novas && (novas === 1 ? "1 tarefa nova" : `${novas} tarefas novas`),
    feitas && (feitas === 1 ? "1 tarefa concluída" : `${feitas} tarefas concluídas`),
  ].filter(Boolean);
  return `Tens ${partes.join(" e ")}`;
};
const fmt = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-PT") : null);

/** Pop-up "Novas tarefas atribuídas": aparece ao abrir a app (e quando chega uma nova) enquanto houver
 * avisos de tarefa atribuída por ler. Cada aviso marca-se como visto ou abre a tarefa. */
const NewTasksReminder = ({ onOpenTask }: { onOpenTask: (task: any) => void }) => {
  const { data: notifications = [], isFetched } = useNotifications();
  const markRead = useMarkRead();
  const [open, setOpen] = useState(false);
  const shown = useRef<Set<string>>(new Set());

  const pending = useMemo(() => {
    const limite = Date.now() - DIAS * 86400000;
    return notifications.filter(
      (n: any) => (n.type === "task_assigned" || n.type === "task_completed") && !n.read && new Date(n.created_at).getTime() >= limite,
    );
  }, [notifications]);

  // Abre quando há avisos que ainda não foram mostrados nesta sessão.
  useEffect(() => {
    if (!isFetched) return;
    const novos = pending.filter((n: any) => !shown.current.has(n.id));
    if (novos.length === 0) return;
    novos.forEach((n: any) => shown.current.add(n.id));
    setOpen(true);
  }, [pending, isFetched]);

  const vista = (id: string) => markRead.mutate(id);

  const abrir = async (n: any) => {
    const taskId = n.data?.task_id;
    vista(n.id);
    if (!taskId) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("*, created_by_collaborator:collaborators!tasks_created_by_fkey(name)")
      .eq("id", taskId)
      .maybeSingle();
    if (error || !data) {
      toast.error("A tarefa já não existe.");
      return;
    }
    setOpen(false);
    onOpenTask(data);
  };

  const todasVistas = () => {
    pending.forEach((n: any) => vista(n.id));
    setOpen(false);
  };

  return (
    <Dialog open={open && pending.length > 0} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-primary" />
            {titulo(pending)}
          </DialogTitle>
          <DialogDescription>Tarefas que te foram atribuídas e tarefas que atribuíste e já foram concluídas. Abre cada uma ou marca como vista.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {pending.map((n: any) => {
            const d = n.data || {};
            const concluida = n.type === "task_completed";
            const detalhes = [
              d.client_name,
              concluida ? d.completed_by && `Concluída por ${d.completed_by}` : fmt(d.due_date) && `Prazo ${fmt(d.due_date)}`,
              !concluida && d.assigned_by && `Atribuída por ${d.assigned_by}`,
            ].filter(Boolean).join(" · ");
            return (
              <div key={n.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {concluida ? <span className="text-success">✓ Concluída · </span> : <span className="text-primary">Nova · </span>}
                    {d.task_title || n.message}
                  </div>
                  <div className="text-xs text-muted-foreground">{detalhes || new Date(n.created_at).toLocaleDateString("pt-PT")}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {d.task_id && (
                    <Button size="sm" variant="outline" onClick={() => abrir(n)}>
                      <ExternalLink className="w-4 h-4 mr-1" /> Abrir
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => vista(n.id)} title="Marcar como vista">
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={todasVistas}>Marcar todas como vistas</Button>
          <Button onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewTasksReminder;
