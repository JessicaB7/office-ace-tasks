import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, XCircle, CheckCircle2, Layers, List, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCollaborators } from "@/hooks/useSupabaseQuery";
import { useCurrentCollaborator } from "@/hooks/useCurrentCollaborator";
import { useToconlineJobs, useUpdateToconlineJob, type ToconlineJob } from "@/hooks/useToconlineJobs";
import { procedureById, STATUS_LABELS, STATUS_CLASSES, TOCONLINE_PROCEDURES, type ToconlineJobStatus } from "@/lib/toconlineProcedures";
import { agruparErros } from "@/lib/toconlineErros";

const selectClass = "px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring";
const fmtMes = (d: string | null) => (d ? new Date(`${d.slice(0, 7)}-01T12:00:00`).toLocaleDateString("pt-PT", { month: "short", year: "numeric" }) : "—");
const fmtData = (d: string | null) => (d ? new Date(d).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

/** Painel de erros das automações TOConline: tarefas com erro ou bloqueadas. */
const ToconlineAutomacoesView = () => {
  const { isAdmin, user } = useAuth();
  const me = useCurrentCollaborator();
  const qc = useQueryClient();
  const { data: jobs = [], isLoading } = useToconlineJobs();
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const update = useUpdateToconlineJob();
  const [estado, setEstado] = useState<"todos" | "erro" | "bloqueada">("todos");
  const [procedimento, setProcedimento] = useState("");
  const [cliente, setCliente] = useState("");
  // Colaboradores começam pelos próprios clientes; a admin vê todos.
  const [responsavel, setResponsavel] = useState<string>(isAdmin ? "" : "me");
  // O papel de admin é confirmado em segundo plano: quando chega, mostrar todos.
  useEffect(() => { if (isAdmin) setResponsavel((r) => (r === "me" ? "" : r)); }, [isAdmin]);
  const [agrupar, setAgrupar] = useState(true);
  const [aProcessar, setAProcessar] = useState(false);

  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);
  const collabName = (id: string | null | undefined) => collaborators.find((c: any) => c.id === id)?.name || "Sem responsável";

  const comErro = useMemo(() => jobs.filter((j) => j.status === "erro" || j.status === "bloqueada"), [jobs]);
  const filtrados = useMemo(() => {
    const respId = responsavel === "me" ? me?.id ?? "__none__" : responsavel;
    return comErro
      .filter((j) => estado === "todos" || j.status === estado)
      .filter((j) => !procedimento || j.procedure_id === procedimento)
      .filter((j) => !cliente || j.client_id === cliente)
      .filter((j) => !respId || (respId === "none" ? !(clientById.get(j.client_id) as any)?.responsavel_id : (clientById.get(j.client_id) as any)?.responsavel_id === respId))
      .sort((a, b) => (b.finished_at || b.updated_at || "").localeCompare(a.finished_at || a.updated_at || ""));
  }, [comErro, estado, procedimento, cliente, responsavel, me, clientById]);
  const grupos = useMemo(() => agruparErros(filtrados), [filtrados]);

  const repetir = async (ids: string[]) => {
    setAProcessar(true);
    try {
      const { data, error } = await (supabase as any).rpc("toconline_job_retry", { p_job_ids: ids });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["toconline_jobs"] });
      toast.success(`${data ?? ids.length} ${(data ?? ids.length) === 1 ? "tarefa voltou" : "tarefas voltaram"} à fila (pendente). A tentativa anterior fica guardada.`);
    } catch (e) {
      toast.error("Não foi possível repetir: " + (e as Error).message);
    } finally {
      setAProcessar(false);
    }
  };

  const cancelar = (ids: string[]) =>
    Promise.all(ids.map((id) => update.mutateAsync({ id, status: "cancelada" }))).then(() =>
      toast.success(ids.length === 1 ? "Tarefa cancelada." : `${ids.length} tarefas canceladas.`));

  const resolvido = (list: ToconlineJob[]) => {
    const nota = window.prompt("Nota (opcional) — o que foi feito manualmente:", "");
    if (nota === null) return;
    const quem = me?.name || user?.email || "equipa";
    const data = new Date().toLocaleDateString("pt-PT");
    Promise.all(list.map((j) =>
      update.mutateAsync({
        id: j.id,
        status: "concluida",
        result_notes: `Resolvido manualmente por ${quem} a ${data}${nota.trim() ? ` — ${nota.trim()}` : ""}${j.result_notes ? `\n(Motivo anterior: ${j.result_notes})` : ""}`,
      }),
    )).then(() => toast.success(list.length === 1 ? "Marcada como resolvida." : `${list.length} marcadas como resolvidas.`));
  };

  const Acoes = ({ list }: { list: ToconlineJob[] }) => (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" onClick={() => repetir(list.map((j) => j.id))} disabled={aProcessar}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border hover:bg-primary/10 hover:text-primary disabled:opacity-50" title="Criar de novo a tarefa na fila (pendente)">
        <RotateCcw className="w-3.5 h-3.5" /> Repetir
      </button>
      <button type="button" onClick={() => cancelar(list.map((j) => j.id))}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border hover:bg-muted" title="Cancelar a tarefa">
        <XCircle className="w-3.5 h-3.5" /> Cancelar
      </button>
      <button type="button" onClick={() => resolvido(list)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border hover:bg-success/10 hover:text-success" title="Feito à mão — marcar como concluída com uma nota">
        <CheckCircle2 className="w-3.5 h-3.5" /> Resolvido manualmente
      </button>
    </div>
  );

  const Linha = ({ j }: { j: ToconlineJob }) => {
    const c = clientById.get(j.client_id) as any;
    return (
      <tr className="border-t align-top">
        <td className="px-3 py-2 font-medium">{c?.name || "—"}<div className="text-[11px] text-muted-foreground font-normal">{collabName(c?.responsavel_id)}</div></td>
        <td className="px-3 py-2">{procedureById(j.procedure_id)?.label || j.procedure_id}</td>
        <td className="px-3 py-2 whitespace-nowrap">{fmtMes(j.reference_month)}</td>
        <td className="px-3 py-2"><span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_CLASSES[j.status as ToconlineJobStatus])}>{STATUS_LABELS[j.status as ToconlineJobStatus]}</span></td>
        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">{fmtData(j.finished_at || j.updated_at)}</td>
        <td className="px-3 py-2 text-xs max-w-sm whitespace-pre-wrap break-words">{j.result_notes || "—"}</td>
        <td className="px-3 py-2"><Acoes list={[j]} /></td>
      </tr>
    );
  };

  const procedimentosUsados = [...new Set(comErro.map((j) => j.procedure_id))];
  const clientesUsados = [...new Set(comErro.map((j) => j.client_id))].map((id) => clientById.get(id) as any).filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, "pt"));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-6 h-6 text-destructive" />
        <h2 className="text-2xl font-bold">Automações TOConline — erros</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Tarefas da Fila TOConline com erro ou bloqueadas. «Repetir» volta a pôr a tarefa na fila (a tentativa falhada fica guardada no histórico).
      </p>

      <div className="flex gap-2 flex-wrap items-center">
        <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className={selectClass} aria-label="Estado">
          <option value="todos">Erro e bloqueadas</option>
          <option value="erro">Só com erro</option>
          <option value="bloqueada">Só bloqueadas</option>
        </select>
        <select value={procedimento} onChange={(e) => setProcedimento(e.target.value)} className={selectClass} aria-label="Procedimento">
          <option value="">Todos os procedimentos</option>
          {TOCONLINE_PROCEDURES.filter((p) => procedimentosUsados.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select value={cliente} onChange={(e) => setCliente(e.target.value)} className={selectClass} aria-label="Cliente">
          <option value="">Todos os clientes</option>
          {clientesUsados.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={selectClass} aria-label="Responsável">
          <option value="">Todos os responsáveis</option>
          {me && <option value="me">Os meus clientes</option>}
          {collaborators.filter((c: any) => c.active).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="none">Sem responsável</option>
        </select>
        <div className="flex rounded-lg border bg-card p-0.5 ml-auto">
          <button type="button" onClick={() => setAgrupar(true)} aria-pressed={agrupar}
            className={cn("px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1", agrupar ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <Layers className="w-4 h-4" /> Agrupar por motivo
          </button>
          <button type="button" onClick={() => setAgrupar(false)} aria-pressed={!agrupar}
            className={cn("px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1", !agrupar ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            <List className="w-4 h-4" /> Lista
          </button>
        </div>
      </div>

      {isLoading ? <p className="text-center py-12 text-muted-foreground">A carregar...</p> : filtrados.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-6 text-sm font-medium text-success">
          <PartyPopper className="w-4 h-4" /> Sem automações com erro{comErro.length > 0 ? " com estes filtros" : ""}.
        </div>
      ) : (
        <div className="space-y-4">
          {(agrupar ? grupos : [{ motivo: "", procedureId: "", jobs: filtrados }]).map((g, gi) => (
            <div key={gi} className="bg-card rounded-xl border overflow-hidden">
              {agrupar && (
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-muted/40">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{procedureById(g.procedureId)?.label || g.procedureId} · {g.jobs.length} {g.jobs.length === 1 ? "tarefa" : "tarefas"}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{g.motivo}</p>
                  </div>
                  {g.jobs.length > 1 && <Acoes list={g.jobs} />}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">Cliente</th>
                      <th className="text-left font-semibold px-3 py-2">Procedimento</th>
                      <th className="text-left font-semibold px-3 py-2">Mês</th>
                      <th className="text-left font-semibold px-3 py-2">Estado</th>
                      <th className="text-left font-semibold px-3 py-2">Data</th>
                      <th className="text-left font-semibold px-3 py-2">Motivo</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>{g.jobs.map((j) => <Linha key={j.id} j={j} />)}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToconlineAutomacoesView;
