import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useCollaborators, useTasks, useUpsertTask, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { associatedTasksFor, onIvaApurado, periodLabel, type IvaApuradoEvent } from "@/lib/associatedTasks";

const inputClass = "text-xs px-2 py-1 rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface RowState { due: string; collaborator: string }

/** Pop-up depois de fechar o IVA (TI ou empresa): pergunta pelo IVA Periódica do mesmo
 * período (Entregue e, no trimestral, Flexibilização — o mesmo registo "IVA" da vista
 * IVA Periódica) e mostra as tarefas associadas (e-Fatura, mapas de análise). Cada tarefa
 * é autónoma — tem a sua data, o seu responsável e o seu botão Ativar. */
const AssociatedTasksDialog = () => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: tasks = [] } = useTasks();
  const upsertTask = useUpsertTask();
  const upsertObl = useUpsertObligation();
  const { user } = useAuth();
  const [queue, setQueue] = useState<IvaApuradoEvent[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState<string | null>(null);

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

  // IVA Periódica do mesmo mês (mesma chave de cache que useMonthlyObligations)
  const month = current?.reference_month;
  const { data: monthObls = [] } = useQuery({
    queryKey: ["monthly_obligations", month],
    enabled: !!month,
    queryFn: async () => {
      const { data, error } = await supabase.from("monthly_obligations").select("*").eq("reference_month", month!);
      if (error) throw error;
      return data;
    },
  });
  const ivaObl: any = client ? monthObls.find((o: any) => o.client_id === client.id && o.obligation_type === "IVA") : null;
  const entregue = ivaObl?.status === "concluida";
  const flex = ivaObl?.extra_done === true;
  const isTrimestral = client?.iva === "Trimestral";

  const saveIva = async (patch: { entregue?: boolean; flex?: boolean }) => {
    if (!client || !month) return;
    const nextEntregue = patch.entregue ?? entregue;
    try {
      await upsertObl.mutateAsync({
        ...(ivaObl?.id ? { id: ivaObl.id } : {}),
        client_id: client.id,
        obligation_type: "IVA",
        reference_month: month,
        status: nextEntregue ? "concluida" : "pendente",
        completed_at: nextEntregue ? (entregue ? ivaObl?.completed_at ?? new Date().toISOString() : new Date().toISOString()) : null,
        completed_by: nextEntregue ? (entregue ? ivaObl?.completed_by ?? user?.id ?? null : user?.id || null) : null,
        extra_done: patch.flex ?? flex,
      });
    } catch (e: any) {
      toast.error("Erro ao gravar o IVA Periódica: " + e.message);
    }
  };

  // Valores iniciais de cada tarefa: daqui a 7 dias, responsável do cliente
  useEffect(() => {
    if (!current || !client) return;
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const init: Record<string, RowState> = {};
    associatedTasksFor(current.obligation_type, client, current.reference_month).forEach((s) => {
      init[s.marker] = { due: isoDate(due), collaborator: client.responsavel_id || "" };
    });
    setRows(init);
    // Só ao mudar de cliente/período — não repor o que já foi editado quando a lista de clientes recarrega
  }, [current, client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => setQueue((q) => q.slice(1));
  const setRow = (marker: string, patch: Partial<RowState>) =>
    setRows((r) => ({ ...r, [marker]: { ...r[marker], ...patch } }));

  const activate = async (s: (typeof suggestions)[number]) => {
    if (!client) return;
    const row = rows[s.marker];
    setSaving(s.marker);
    try {
      await upsertTask.mutateAsync({
        title: s.title,
        description: s.marker,
        due_date: row.due,
        category: "contabilidade",
        priority: "media",
        status: "pendente",
        client_id: client.id,
        collaborator_id: row.collaborator || null,
      });
      toast.success(`Tarefa ativada — ${s.title}`);
    } catch (e: any) {
      toast.error("Erro ao ativar a tarefa: " + e.message);
    } finally {
      setSaving(null);
    }
  };

  const open = !!current && !!client;

  const ivaToggle = (label: string, active: boolean, onClick: () => void, activeCls: string) => (
    <button type="button" onClick={onClick} disabled={upsertObl.isPending} aria-pressed={active}
      className={cn("flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors disabled:opacity-60",
        active ? activeCls : "bg-card hover:bg-muted text-muted-foreground")}>
      <span className={cn("w-4 h-4 rounded border-2 flex items-center justify-center", active ? "border-current" : "border-muted-foreground/40")}>
        {active && <Check className="w-3 h-3" />}
      </span>
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) next(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="w-4 h-4 text-primary" /> IVA fechado
          </DialogTitle>
          <DialogDescription>
            O IVA de <span className="font-medium text-foreground">{client?.name}</span> foi fechado. Indique o estado
            do IVA Periódica e ative as tarefas associadas que quiser, com a data em que conseguir fazê-las.
          </DialogDescription>
        </DialogHeader>
        {client && month && (
          <div className="rounded-lg border px-3 py-2 space-y-2">
            <div className="text-sm font-medium">IVA Periódica — {periodLabel(client, month)}</div>
            <div className="flex flex-wrap gap-2">
              {ivaToggle("Entregue", entregue, () => saveIva({ entregue: !entregue }), "bg-success/15 text-success border-success/30")}
              {isTrimestral && ivaToggle("Flexibilização", flex, () => saveIva({ flex: !flex }), "bg-primary/10 text-primary border-primary/30")}
            </div>
          </div>
        )}
        {suggestions.length > 0 && <div className="text-xs font-semibold text-muted-foreground pt-1">Tarefas associadas</div>}
        <div className="space-y-2">
          {suggestions.map((s) => {
            const row = rows[s.marker];
            if (s.alreadyActive) {
              return (
                <div key={s.marker} className="rounded-lg border px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" /> {s.title} <span className="text-xs">· já ativada</span>
                </div>
              );
            }
            if (!row) return null;
            return (
              <div key={s.marker} className="rounded-lg border px-3 py-2 space-y-2">
                <div className="text-sm font-medium">{s.title}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Para</span>
                  <input type="date" value={row.due} onChange={(e) => setRow(s.marker, { due: e.target.value })} className={inputClass} />
                  <select value={row.collaborator} onChange={(e) => setRow(s.marker, { collaborator: e.target.value })} className={inputClass}>
                    <option value="">Sem responsável</option>
                    {collaborators.filter((c: any) => c.active).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button size="sm" className="ml-auto h-7" onClick={() => activate(s)} disabled={!row.due || saving !== null}>
                    {saving === s.marker ? "A ativar…" : "Ativar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={next}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssociatedTasksDialog;
