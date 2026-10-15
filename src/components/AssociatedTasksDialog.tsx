import { useEffect, useMemo, useState } from "react";
import { useClients, useCollaborators, useTasks, useUpsertTask } from "@/hooks/useSupabaseQuery";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListPlus } from "lucide-react";
import { toast } from "sonner";
import { associatedTasksFor, onIvaApurado, type IvaApuradoEvent } from "@/lib/associatedTasks";

const inputClass = "text-xs px-2 py-1 rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface RowState { active: boolean; due: string; collaborator: string }

/** Pop-up depois de fechar o IVA (TI ou empresa): mostra as tarefas associadas
 * (e-Fatura, mapas de análise) para ativar com a data em que se conseguir fazê-las. */
const AssociatedTasksDialog = () => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: tasks = [] } = useTasks();
  const upsertTask = useUpsertTask();
  const [queue, setQueue] = useState<IvaApuradoEvent[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  useEffect(() => onIvaApurado((e) => setQueue((q) =>
    q.some((x) => x.client_id === e.client_id && x.reference_month === e.reference_month) ? q : [...q, e])), []);

  const current = queue[0];
  const client = current ? clients.find((c: any) => c.id === current.client_id) : null;

  const suggestions = useMemo(() => {
    if (!current || !client) return [];
    const existing = new Set(tasks.filter((t: any) => t.client_id === client.id).map((t: any) => t.description));
    return associatedTasksFor(current.obligation_type, client, current.reference_month)
      .map((s) => ({ ...s, alreadyActive: existing.has(s.marker) }));
  }, [current, client, tasks]);

  const pending = suggestions.filter((s) => !s.alreadyActive);

  // Valores iniciais de cada tarefa: ativa, daqui a 7 dias, responsável do cliente
  useEffect(() => {
    if (!current || !client) return;
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const init: Record<string, RowState> = {};
    associatedTasksFor(current.obligation_type, client, current.reference_month).forEach((s) => {
      init[s.marker] = { active: true, due: isoDate(due), collaborator: client.responsavel_id || "" };
    });
    setRows(init);
    // Só ao mudar de cliente/período — não repor o que já foi editado quando a lista de clientes recarrega
  }, [current, client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nada para ativar (já estão todas ativas): passa ao seguinte sem mostrar
  useEffect(() => {
    if (current && client && suggestions.length > 0 && pending.length === 0) setQueue((q) => q.slice(1));
  }, [current, client, suggestions.length, pending.length]);

  const next = () => setQueue((q) => q.slice(1));
  const setRow = (marker: string, patch: Partial<RowState>) =>
    setRows((r) => ({ ...r, [marker]: { ...r[marker], ...patch } }));

  const activate = async () => {
    if (!client) return;
    const chosen = pending.filter((s) => rows[s.marker]?.active);
    try {
      await Promise.all(chosen.map((s) => upsertTask.mutateAsync({
        title: s.title,
        description: s.marker,
        due_date: rows[s.marker].due,
        category: "contabilidade",
        priority: "media",
        status: "pendente",
        client_id: client.id,
        collaborator_id: rows[s.marker].collaborator || null,
      })));
      if (chosen.length) toast.success(`${chosen.length} tarefa${chosen.length !== 1 ? "s" : ""} ativada${chosen.length !== 1 ? "s" : ""} — ${client.name}`);
      next();
    } catch (e: any) {
      toast.error("Erro ao ativar tarefas: " + e.message);
    }
  };

  const open = !!current && !!client && pending.length > 0;
  const anyChosen = pending.some((s) => rows[s.marker]?.active);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) next(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="w-4 h-4 text-primary" /> Tarefas associadas ao IVA
          </DialogTitle>
          <DialogDescription>
            O IVA de <span className="font-medium text-foreground">{client?.name}</span> foi fechado. Estas tarefas estão
            associadas — ative as que quiser, com a data em que conseguir fazê-las.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {suggestions.map((s) => {
            const row = rows[s.marker];
            if (s.alreadyActive) {
              return (
                <div key={s.marker} className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                  {s.title} <span className="text-xs">· já ativada</span>
                </div>
              );
            }
            if (!row) return null;
            return (
              <div key={s.marker} className="rounded-lg border px-3 py-2 space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" checked={row.active} onChange={(e) => setRow(s.marker, { active: e.target.checked })} />
                  {s.title}
                </label>
                {row.active && (
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <span className="text-xs text-muted-foreground">Para</span>
                    <input type="date" value={row.due} onChange={(e) => setRow(s.marker, { due: e.target.value })} className={inputClass} />
                    <select value={row.collaborator} onChange={(e) => setRow(s.marker, { collaborator: e.target.value })} className={inputClass}>
                      <option value="">Sem responsável</option>
                      {collaborators.filter((c: any) => c.active).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={next}>Agora não</Button>
          <Button onClick={activate} disabled={!anyChosen || upsertTask.isPending || pending.some((s) => rows[s.marker]?.active && !rows[s.marker]?.due)}>
            Ativar tarefas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssociatedTasksDialog;
