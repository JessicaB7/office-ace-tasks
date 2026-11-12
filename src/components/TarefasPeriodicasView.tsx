import { useMemo, useState } from "react";
import { Pause, Play, Pencil, Plus, Repeat, Search, Trash2, X } from "lucide-react";
import { untypedSupabase } from "@/hooks/useTaskRecurrences";
import { useClients, useCollaborators, useTasks } from "@/hooks/useSupabaseQuery";
import {
  ruleOf,
  useDeleteTaskRecurrence,
  useStartTaskRecurrence,
  useTaskRecurrences,
  useUpdateTaskRecurrence,
  type TaskRecurrence,
} from "@/hooks/useTaskRecurrences";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORY_LABELS, PRIORITY_LABELS, type TaskCategory, type TaskPriority } from "@/types/database";
import { describeRecurrence, firstOccurrence, nextOccurrence, repeatToRule, type RepeatForm } from "@/lib/taskRecurrence";
import RecurrenceFields from "./RecurrenceFields";
import { cn } from "@/lib/utils";

interface Props {
  onNewRecurring: () => void;
}

const OPEN = ["pendente", "em_progresso"];
type SeriesTask = { recurrence_id?: string | null; status: string; due_date: string };
const errMsg = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));
const fmt = (iso: string | null | undefined) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-PT") : "—");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const inputCls = "w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

const TarefasPeriodicasView = ({ onNewRecurring }: Props) => {
  const { data: recurrences = [], isLoading } = useTaskRecurrences();
  const { data: tasks = [] } = useTasks();
  const { data: collaborators = [] } = useCollaborators();
  const update = useUpdateTaskRecurrence();
  const start = useStartTaskRecurrence();
  const remove = useDeleteTaskRecurrence();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterCollab, setFilterCollab] = useState("all");
  const [filterEstado, setFilterEstado] = useState<"ativas" | "pausadas" | "todas">("ativas");
  const [editing, setEditing] = useState<TaskRecurrence | null>(null);

  // Ocorrência em aberto e prazo da última ocorrência de cada série.
  const { openBySeries, lastDueBySeries } = useMemo(() => {
    const open = new Map<string, SeriesTask>();
    const last = new Map<string, string>();
    for (const t of tasks as SeriesTask[]) {
      if (!t.recurrence_id) continue;
      if (OPEN.includes(t.status)) open.set(t.recurrence_id, t);
      const prev = last.get(t.recurrence_id);
      if (!prev || t.due_date > prev) last.set(t.recurrence_id, t.due_date);
    }
    return { openBySeries: open, lastDueBySeries: last };
  }, [tasks]);

  const filtered = recurrences.filter((r) => {
    if (filterEstado === "ativas" && !r.active) return false;
    if (filterEstado === "pausadas" && r.active) return false;
    if (filterCollab !== "all" && r.collaborator_id !== filterCollab) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!r.title.toLowerCase().includes(s) && !(r.clients?.name || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const fail = (err: unknown) => toast({ title: "Erro", description: errMsg(err), variant: "destructive" });

  const togglePause = async (r: TaskRecurrence) => {
    try {
      if (r.active) {
        await update.mutateAsync({ id: r.id, patch: { active: false } });
        toast({ title: "Série pausada", description: "Não são criadas novas ocorrências até retomares." });
        return;
      }
      // Ao retomar, os períodos que passaram durante a pausa são saltados.
      const today = todayISO();
      let next = r.next_due_date;
      if (next && next < today && !openBySeries.has(r.id)) next = nextOccurrence(ruleOf(r), today, true);
      await update.mutateAsync({ id: r.id, patch: { active: true, next_due_date: next } });
      toast({ title: "Série retomada", description: next ? `Próxima ocorrência: ${fmt(next)}` : undefined });
    } catch (err) {
      fail(err);
    }
  };

  const createNow = async (r: TaskRecurrence) => {
    try {
      const id = await start.mutateAsync(r.id);
      toast({ title: id ? "Ocorrência criada" : "Nada a criar", description: id ? r.title : "A série já tem uma ocorrência em aberto ou terminou." });
    } catch (err) {
      fail(err);
    }
  };

  const handleDelete = async (r: TaskRecurrence) => {
    if (!window.confirm(`Apagar a tarefa periódica «${r.title}»? As tarefas já criadas ficam.`)) return;
    try {
      await remove.mutateAsync(r.id);
      toast({ title: "Tarefa periódica apagada" });
    } catch (err) {
      fail(err);
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Tarefas periódicas</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Tarefas que se repetem. Cada ocorrência aparece nas Tarefas uns dias antes do prazo; ao concluí-la é criada a seguinte.
          </p>
        </div>
        <button onClick={onNewRecurring} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Nova tarefa periódica
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar tarefa ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterCollab} onChange={(e) => setFilterCollab(e.target.value)} className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os responsáveis</option>
          {collaborators.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value as typeof filterEstado)} className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="ativas">Ativas</option>
          <option value="pausadas">Pausadas</option>
          <option value="todas">Todas</option>
        </select>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tarefa</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Repetição</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Em aberto</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Próxima</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const open = openBySeries.get(r.id);
                const terminada = !r.next_due_date && !open;
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-[240px]">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{r.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.clients?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.collaborators?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{describeRecurrence(ruleOf(r))}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{open ? fmt(open.due_date) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmt(r.next_due_date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          terminada ? "bg-muted text-muted-foreground" : r.active ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                        )}
                      >
                        {terminada ? "Terminada" : r.active ? "Ativa" : "Pausada"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.active && !open && r.next_due_date && (
                          <button onClick={() => createNow(r)} className="px-2 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10" title="Criar já a próxima ocorrência">
                            Criar já
                          </button>
                        )}
                        <button onClick={() => togglePause(r)} className="p-1.5 rounded-lg hover:bg-muted" title={r.active ? "Pausar" : "Retomar"}>
                          {r.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setEditing(r)} className="p-1.5 rounded-lg hover:bg-muted" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10" title="Apagar série">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    Sem tarefas periódicas. Cria uma em «Nova tarefa periódica» ou escolhe «Repetir» numa tarefa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <SeriesDialog series={editing} lastDue={lastDueBySeries.get(editing.id) ?? null} onClose={() => setEditing(null)} />
      )}
    </div>
  );
};

// ---- Editar uma série (modelo da tarefa + regra) ----
const SeriesDialog = ({ series, lastDue, onClose }: { series: TaskRecurrence; lastDue: string | null; onClose: () => void }) => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const update = useUpdateTaskRecurrence();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: series.title,
    description: series.description || "",
    client_id: series.client_id || "",
    collaborator_id: series.collaborator_id || "",
    category: series.category,
    priority: series.priority,
    lead_days: series.lead_days,
    start_date: series.start_date,
  });
  const [repeat, setRepeat] = useState<RepeatForm>({
    frequency: series.frequency,
    interval: series.interval_n,
    day_mode: series.day_mode,
    day_of_month: series.day_of_month ?? Number(series.start_date.slice(8, 10)),
    weekday: series.weekday ?? 1,
    end_date: series.end_date || "",
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const rule = repeatToRule(repeat, form.start_date);
    if (!rule) return;
    if (!firstOccurrence(rule)) {
      toast({ title: "Data de fim inválida", description: "A data de fim é anterior à primeira ocorrência.", variant: "destructive" });
      return;
    }
    // Próxima ocorrência pela nova regra: depois da última já criada (ou a partir da data de referência).
    const next = lastDue && lastDue >= rule.start_date ? nextOccurrence(rule, lastDue) : firstOccurrence(rule);
    const template = {
      title: form.title,
      description: form.description || null,
      client_id: form.client_id || null,
      collaborator_id: form.collaborator_id || null,
      category: form.category,
      priority: form.priority,
    };
    try {
      await update.mutateAsync({
        id: series.id,
        patch: {
          ...template,
          frequency: rule.frequency,
          interval_n: rule.interval,
          day_mode: rule.day_mode,
          day_of_month: rule.day_of_month,
          weekday: rule.weekday,
          start_date: rule.start_date,
          end_date: rule.end_date ?? null,
          lead_days: Math.min(90, Math.max(0, Number(form.lead_days) || 0)),
          next_due_date: next,
        },
      });
      // A ocorrência em aberto acompanha o modelo (título, responsável, …); o prazo mantém-se.
      const { error } = await untypedSupabase.from("tasks").update(template).eq("recurrence_id", series.id).in("status", OPEN);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa periódica atualizada", description: describeRecurrence(rule) });
      onClose();
    } catch (err) {
      toast({ title: "Erro", description: errMsg(err), variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold">Editar tarefa periódica</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Título</label>
            <input required value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Cliente</label>
              <select value={form.client_id} onChange={(e) => set("client_id", e.target.value)} className={inputCls}>
                <option value="">Sem cliente</option>
                {clients.filter((c) => c.active || c.id === form.client_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Responsável</label>
              <select value={form.collaborator_id} onChange={(e) => set("collaborator_id", e.target.value)} className={inputCls}>
                <option value="">Sem responsável</option>
                {collaborators.filter((c) => c.active || c.id === form.collaborator_id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Categoria</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value as TaskCategory)} className={inputCls}>
                {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Prioridade</label>
              <select value={form.priority} onChange={(e) => set("priority", e.target.value as TaskPriority)} className={inputCls}>
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Data de referência</label>
              <input type="date" required value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Criar com antecedência (dias)</label>
              <input type="number" min={0} max={90} value={form.lead_days} onChange={(e) => set("lead_days", Number(e.target.value))} className={inputCls} />
            </div>
          </div>
          <RecurrenceFields value={repeat} onChange={setRepeat} startDate={form.start_date} required />
          <p className="text-xs text-muted-foreground">
            A data de referência fixa o mês de partida (trimestral/anual). A ocorrência em aberto mantém o prazo; as seguintes usam a nova regra.
          </p>
          <button type="submit" disabled={update.isPending} className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            {update.isPending ? "A guardar..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TarefasPeriodicasView;
