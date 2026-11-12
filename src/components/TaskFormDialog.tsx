import { useState, useEffect } from "react";
import { useClients, useCollaborators, useUpsertTask, useDeleteTask } from "@/hooks/useSupabaseQuery";
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, type TaskStatus, type TaskPriority, type TaskCategory } from "@/types/database";
import { X, ExternalLink, MessageCircle, Repeat } from "lucide-react";
import ClientDetailDialog from "./ClientDetailDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RecurrenceFields from "./RecurrenceFields";
import { useCreateTaskRecurrence, useTaskRecurrences, ruleOf, type TaskRecurrenceInput } from "@/hooks/useTaskRecurrences";
import { defaultRepeat, describeRecurrence, firstOccurrence, nextOccurrence, repeatToRule, type RecurrenceRule, type RepeatForm } from "@/lib/taskRecurrence";
import type { DbTaskInsert } from "@/types/database";

interface TaskFormDialogProps {
  open: boolean;
  task: any | null;
  onClose: () => void;
  /** Abre já com «Repetir: Mensal» (botão «Nova tarefa periódica»). */
  initialRepeat?: boolean;
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

const TaskFormDialog = ({ open, task, onClose, initialRepeat }: TaskFormDialogProps) => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertTask();
  const remove = useDeleteTask();
  const createRecurrence = useCreateTaskRecurrence();
  const { data: recurrences = [] } = useTaskRecurrences();
  const { toast } = useToast();
  const [currentCollaboratorId, setCurrentCollaboratorId] = useState<string | null>(null);

  const { isAdmin } = useAuth();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        // A admin (geral@) não tem ficha de colaborador própria: conta como a Responsável.
        const collab = collaborators.find(c => c.user_id === data.user.id)
          || (isAdmin ? collaborators.find((c: any) => c.role === "Responsável") : undefined);
        setCurrentCollaboratorId(collab?.id || null);
      }
    });
  }, [collaborators, isAdmin]);
  const [form, setForm] = useState(emptyForm);
  const [repeat, setRepeat] = useState<RepeatForm>(() => defaultRepeat(emptyForm.due_date));
  const [clientDetailOpen, setClientDetailOpen] = useState(false);
  const isEditing = !!task;
  const series = task?.recurrence_id ? recurrences.find((r) => r.id === task.recurrence_id) : undefined;

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
    setRepeat(defaultRepeat(task?.due_date || emptyForm.due_date, !task && initialRepeat ? "mensal" : "nao"));
  }, [task, open, initialRepeat]);

  if (!open) return null;

  // Dados guardados no aviso, para o pop-up "Novas tarefas" mostrar prazo e quem atribuiu.
  const assignmentData = (taskId: string | undefined, clientName: string | undefined) => ({
    task_id: taskId ?? null,
    task_title: form.title,
    client_name: clientName ?? null,
    due_date: form.due_date,
    priority: form.priority,
    assigned_by: collaborators.find((c) => c.id === currentCollaboratorId)?.name ?? null,
  });

  // Mensagem pronta para o WhatsApp (sem número: o WhatsApp deixa escolher o contacto).
  const whatsappLink = () => {
    const pessoa = collaborators.find((c) => c.id === form.collaborator_id);
    const cliente = clients.find((c) => c.id === form.client_id);
    const linhas = [
      `Olá ${pessoa?.name?.split(" ")[0] || ""}! Atribuí-te uma tarefa na app:`,
      `• ${form.title}`,
      cliente ? `• Cliente: ${cliente.name}` : null,
      form.due_date ? `• Prazo: ${new Date(`${form.due_date}T12:00:00`).toLocaleDateString("pt-PT")}` : null,
      "https://gestao.contabilistaexplica.pt",
    ].filter(Boolean);
    return `https://wa.me/?text=${encodeURIComponent(linhas.join("\n"))}`;
  };

  // Linha da série (task_recurrences) a partir do formulário e da regra.
  const recurrenceRow = (rule: RecurrenceRule, collaboratorId: string | null, nextDue: string | null): TaskRecurrenceInput => ({
    title: form.title,
    description: form.description || null,
    client_id: form.client_id || null,
    collaborator_id: collaboratorId,
    category: form.category,
    priority: form.priority,
    frequency: rule.frequency,
    interval_n: rule.interval,
    day_mode: rule.day_mode,
    day_of_month: rule.day_of_month,
    weekday: rule.weekday,
    start_date: rule.start_date,
    end_date: rule.end_date ?? null,
    lead_days: 7,
    next_due_date: nextDue,
    active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const previousCollaboratorId = task?.collaborator_id || null;
      const isTodos = form.collaborator_id === "__todos__";

      // Tarefa periódica: a série gera as ocorrências (a 1.ª é criada já, com aviso à responsável).
      const rule = !task?.recurrence_id ? repeatToRule(repeat, form.due_date) : null;
      if (rule && !firstOccurrence(rule)) {
        toast({ title: "Data de fim inválida", description: "A data de fim é anterior à primeira ocorrência.", variant: "destructive" });
        return;
      }
      if (rule && !task?.id) {
        const ids = isTodos ? collaborators.filter((c) => c.active).map((c) => c.id) : [form.collaborator_id || null];
        for (const collaboratorId of ids) {
          await createRecurrence.mutateAsync({ row: recurrenceRow(rule, collaboratorId, firstOccurrence(rule)), startNow: true });
        }
        onClose();
        toast({ title: ids.length > 1 ? "Tarefas periódicas criadas para todos" : "Tarefa periódica criada", description: `${form.title} · ${describeRecurrence(rule)}` });
        return;
      }
      // Tarefa existente que passa a repetir: fica como 1.ª ocorrência da série.
      let newRecurrenceId: string | null = null;
      if (rule && task?.id) {
        newRecurrenceId = await createRecurrence.mutateAsync({
          row: recurrenceRow(rule, isTodos ? null : form.collaborator_id || null, nextOccurrence(rule, form.due_date)),
          startNow: false,
        });
      }

      if (isTodos && !task?.id) {
        // Create one task per active collaborator
        const activeCollabs = collaborators.filter(c => c.active);
        for (const collab of activeCollabs) {
          const created: any = await upsert.mutateAsync({
            ...form,
            client_id: form.client_id || null,
            collaborator_id: collab.id,
            created_by: currentCollaboratorId,
          } as any);
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
          // In-app notification (não avisa quem atribui a tarefa a si próprio)
          if (collab.user_id && collab.id !== currentCollaboratorId) {
            supabase.from("notifications").insert({
              user_id: collab.user_id,
              title: "Nova tarefa atribuída",
              message: `${form.title}${client?.name ? ` — ${client.name}` : ""}`,
              type: "task_assigned",
              data: assignmentData(created?.id, client?.name),
            }).then(({ error }) => { if (error) console.error("Notification error:", error); });
          }
        }
      } else {
        const newCollaboratorId = isTodos ? null : (form.collaborator_id || null);
        // recurrence_id ainda não está nos tipos gerados.
        const payload: DbTaskInsert & { id?: string; recurrence_id?: string } = {
          ...form,
          client_id: form.client_id || null,
          collaborator_id: newCollaboratorId,
          ...(!task?.id ? { created_by: currentCollaboratorId } : {}),
          ...(task?.id ? { id: task.id } : {}),
          ...(newRecurrenceId ? { recurrence_id: newRecurrenceId } : {}),
        };
        const saved: any = await upsert.mutateAsync(payload);

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
          // In-app notification (não avisa quem atribui a tarefa a si próprio)
          if (collaborator?.user_id && collaborator.id !== currentCollaboratorId) {
            supabase.from("notifications").insert({
              user_id: collaborator.user_id,
              title: "Nova tarefa atribuída",
              message: `${form.title}${client?.name ? ` — ${client.name}` : ""}`,
              type: "task_assigned",
              data: assignmentData(saved?.id || task?.id, client?.name),
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium block">Cliente</label>
                {form.client_id && (
                  <button type="button" onClick={() => setClientDetailOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" /> Ver ficha
                  </button>
                )}
              </div>
              <select value={form.client_id} onChange={(e) => set("client_id", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Sem cliente</option>
                {clients.filter(c => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium block">Responsável</label>
                {form.collaborator_id && form.collaborator_id !== "__todos__" && form.title && (
                  <a
                    href={whatsappLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    title="Abre o WhatsApp com a mensagem pronta; escolhe a colega e envia"
                  >
                    <MessageCircle className="w-3 h-3" /> Avisar no WhatsApp
                  </a>
                )}
              </div>
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
            <label className="text-sm font-medium mb-1 block">{repeat.frequency !== "nao" && !task?.recurrence_id ? "Prazo da 1.ª ocorrência (a partir de)" : "Prazo"}</label>
            <input type="date" required value={form.due_date} onChange={(e) => set("due_date", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {task?.recurrence_id ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Repeat className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
              <span>
                Tarefa periódica{series ? <> · <span className="font-medium text-foreground">{describeRecurrence(ruleOf(series))}</span></> : null}.
                {" "}Ao concluir, é criada a seguinte. A regra gere-se em Visão geral → Tarefas periódicas.
              </span>
            </div>
          ) : (
            <RecurrenceFields
              value={repeat}
              startDate={form.due_date}
              onChange={(next) => setRepeat(repeat.frequency === "nao" && next.frequency !== "nao" ? defaultRepeat(form.due_date, next.frequency) : next)}
            />
          )}
          {isEditing && task?.created_by_collaborator?.name && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Atribuída por: <span className="font-medium text-foreground">{task.created_by_collaborator.name}</span>
            </div>
          )}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={upsert.isPending || createRecurrence.isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
              {upsert.isPending || createRecurrence.isPending ? "A guardar..." : isEditing ? "Guardar" : repeat.frequency !== "nao" ? "Criar tarefa periódica" : "Criar Tarefa"}
            </button>
            {isEditing && (
              <button type="button" onClick={handleDelete} className="px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive font-medium text-sm hover:bg-destructive/20 transition-colors">
                Eliminar
              </button>
            )}
          </div>
        </form>
      </div>
      <ClientDetailDialog
        client={clientDetailOpen ? clients.find((c) => c.id === form.client_id) ?? null : null}
        open={clientDetailOpen}
        onClose={() => setClientDetailOpen(false)}
        allowDelete={false}
      />
    </div>
  );
};

export default TaskFormDialog;
