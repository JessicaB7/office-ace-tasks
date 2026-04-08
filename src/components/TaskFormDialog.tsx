import { useState, useEffect } from "react";
import { useClients, useCollaborators, useUpsertTask, useDeleteTask } from "@/hooks/useSupabaseQuery";
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, type TaskStatus, type TaskPriority, type TaskCategory } from "@/types/database";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TaskFormDialogProps {
  open: boolean;
  task: any | null;
  onClose: () => void;
}

const emptyForm = {
  title: "",
  description: "",
  client_id: "",
  collaborator_id: "",
  status: "pendente" as TaskStatus,
  priority: "media" as TaskPriority,
  category: "contabilidade" as TaskCategory,
  due_date: new Date().toISOString().split("T")[0],
};

const TaskFormDialog = ({ open, task, onClose }: TaskFormDialogProps) => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertTask();
  const remove = useDeleteTask();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const isEditing = !!task;

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description || "",
        client_id: task.client_id || "",
        collaborator_id: task.collaborator_id || "",
        status: task.status,
        priority: task.priority,
        category: task.category,
        due_date: task.due_date,
      });
    } else {
      setForm(emptyForm);
    }
  }, [task, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const previousCollaboratorId = task?.collaborator_id || null;
      const isTodos = form.collaborator_id === "__todos__";
      
      if (isTodos && !task?.id) {
        // Create one task per active collaborator
        const activeCollabs = collaborators.filter(c => c.active);
        for (const collab of activeCollabs) {
          await upsert.mutateAsync({
            ...form,
            client_id: form.client_id || null,
            collaborator_id: collab.id,
          });
          // Send email notification
          const client = clients.find(c => c.id === form.client_id);
          if (collab.email) {
            supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "task-assignment",
                recipientEmail: collab.email,
                idempotencyKey: `task-assign-${crypto.randomUUID()}-${collab.id}`,
                templateData: {
                  collaboratorName: collab.name,
                  taskTitle: form.title,
                  clientName: client?.name || undefined,
                  dueDate: new Date(form.due_date).toLocaleDateString("pt-PT"),
                  priority: PRIORITY_LABELS[form.priority],
                  category: CATEGORY_LABELS[form.category],
                },
              },
            }).catch(err => console.error("Failed to send assignment email:", err));
          }
          // In-app notification
          if (collab.user_id) {
            supabase.from("notifications").insert({
              user_id: collab.user_id,
              title: "Nova tarefa atribuída",
              message: `${form.title}${client?.name ? ` — ${client.name}` : ""}`,
              type: "task_assigned",
            }).then(({ error }) => { if (error) console.error("Notification error:", error); });
          }
        }
      } else {
        const newCollaboratorId = isTodos ? null : (form.collaborator_id || null);
        await upsert.mutateAsync({
          ...form,
          client_id: form.client_id || null,
          collaborator_id: newCollaboratorId,
          ...(task?.id ? { id: task.id } : {}),
        });

        // Send email if collaborator was newly assigned or changed
        if (newCollaboratorId && newCollaboratorId !== previousCollaboratorId) {
          const collaborator = collaborators.find(c => c.id === newCollaboratorId);
          const client = clients.find(c => c.id === form.client_id);
          if (collaborator?.email) {
            supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "task-assignment",
                recipientEmail: collaborator.email,
                idempotencyKey: `task-assign-${task?.id || crypto.randomUUID()}-${newCollaboratorId}`,
                templateData: {
                  collaboratorName: collaborator.name,
                  taskTitle: form.title,
                  clientName: client?.name || undefined,
                  dueDate: new Date(form.due_date).toLocaleDateString("pt-PT"),
                  priority: PRIORITY_LABELS[form.priority],
                  category: CATEGORY_LABELS[form.category],
                },
              },
            }).catch(err => console.error("Failed to send assignment email:", err));
          }
          // In-app notification
          if (collaborator?.user_id) {
            supabase.from("notifications").insert({
              user_id: collaborator.user_id,
              title: "Nova tarefa atribuída",
              message: `${form.title}${client?.name ? ` — ${client.name}` : ""}`,
              type: "task_assigned",
            }).then(({ error }) => { if (error) console.error("Notification error:", error); });
          }
        }
      }

      onClose();
      toast({ title: isTodos && !task?.id ? "Tarefas criadas para todos" : isEditing ? "Tarefa atualizada" : "Tarefa criada", description: form.title });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(task.id);
      onClose();
      toast({ title: "Tarefa eliminada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold">{isEditing ? "Editar Tarefa" : "Nova Tarefa"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Título</label>
            <input required value={form.title} onChange={(e) => set("title", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Cliente</label>
              <select value={form.client_id} onChange={(e) => set("client_id", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Sem cliente</option>
                {clients.filter(c => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Responsável</label>
              <select value={form.collaborator_id} onChange={(e) => set("collaborator_id", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Sem responsável</option>
                {!isEditing && <option value="__todos__">Todos os colaboradores</option>}
                {collaborators.filter(c => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Estado</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Prazo</label>
            <input type="date" required value={form.due_date} onChange={(e) => set("due_date", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={upsert.isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
              {upsert.isPending ? "A guardar..." : isEditing ? "Guardar" : "Criar Tarefa"}
            </button>
            {isEditing && (
              <button type="button" onClick={handleDelete} className="px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive font-medium text-sm hover:bg-destructive/20 transition-colors">
                Eliminar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskFormDialog;
