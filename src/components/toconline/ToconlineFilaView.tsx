import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Play, Check, Trash2, Bot, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCollaborators, useMonthlyObligationsRange, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { useToconlineJobs, useActivateToconlineJobs, useUpdateToconlineJob, useDeleteToconlineJob, type ToconlineJob } from "@/hooks/useToconlineJobs";
import {
  TOCONLINE_REGIMES, TOCONLINE_TAREFAS, procedureById, procedureFor, STATUS_LABELS, STATUS_CLASSES,
  tipoFaturacao, TIPO_FATURACAO_LABELS,
  type ToconlineJobStatus, type ToconlineRegime, type ToconlineTarefa, type TipoFaturacao,
} from "@/lib/toconlineProcedures";
import { parcelasDevidasEm, metodoPagamentoIva } from "@/lib/ivaFlex";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const STATUS_ORDER: ToconlineJobStatus[] = ["pendente", "em_curso", "bloqueada", "erro", "concluida", "cancelada"];
const STATUS_TABS: { id: ToconlineJobStatus | "ativas" | "todas"; label: string }[] = [
  { id: "ativas", label: "Por tratar" },
  { id: "bloqueada", label: "Bloqueadas" },
  { id: "erro", label: "Erro" },
  { id: "concluida", label: "Concluídas" },
  { id: "todas", label: "Todas" },
];

const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}-01`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};
const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const inputClass = "px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring";
const FATURACAO_CLASSES: Record<TipoFaturacao, string> = {
  recibos_verdes: "bg-success/15 text-success",
  programa: "bg-primary/15 text-primary",
  ambos: "bg-warning/15 text-warning",
  sem_info: "bg-muted text-muted-foreground",
};
const FaturacaoBadge = ({ tipo }: { tipo: TipoFaturacao }) => (
  <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap", FATURACAO_CLASSES[tipo])}>{TIPO_FATURACAO_LABELS[tipo]}</span>
);

const tabClass = (active: boolean) => cn("px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted");

const ToconlineFilaView = () => {
  const { user, isAdmin } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: jobs = [], isLoading } = useToconlineJobs();
  const activate = useActivateToconlineJobs();
  const updateJob = useUpdateToconlineJob();
  const deleteJob = useDeleteToconlineJob();
  const upsertObligation = useUpsertObligation();

  // ---- Ativar ----
  const now = new Date();
  const [year, setYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1);
  const [regime, setRegime] = useState<ToconlineRegime>("ti_rs");
  const [tarefa, setTarefa] = useState<ToconlineTarefa>("vendas");
  const [collabFilter, setCollabFilter] = useState("all");
  const [clientSearch, setClientSearch] = useState("");
  // Nos regimes TI, a tarefa depende de o cliente passar recibos verdes ou usar programa de faturação
  const [faturacaoFilter, setFaturacaoFilter] = useState<TipoFaturacao | "all">("all");
  const isTI = regime === "ti_rs" || regime === "ti_co";
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const procedure = procedureFor(regime, tarefa);
  const procedureId = procedure?.id || "";
  const refMonth = monthKey(year, month);
  const prevMonth = () => { setSelected(new Set()); if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { setSelected(new Set()); if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);
  const collabName = (id: string | null) => collaborators.find((c: any) => c.id === id)?.name || "—";
  const userName = (uid: string | null) => collaborators.find((c: any) => c.user_id === uid)?.name || "";

  // Guias flexibilização IVA: parcelas que vencem no mês e planos (IVA trimestral com Flexibilização) desses trimestres
  const parcelasDoMes = useMemo(() => (procedure?.ivaFlex ? parcelasDevidasEm(year, month) : []), [procedure, year, month]);
  const { data: flexObligations = [] } = useMonthlyObligationsRange([...new Set(parcelasDoMes.map((p) => p.quarterEndMonth))]);
  const flexInfo = useMemo(() => {
    const map = new Map<string, { label: string; metodo: string }[]>();
    parcelasDoMes.forEach((p) => {
      flexObligations.forEach((o: any) => {
        if (o.obligation_type !== "IVA" || o.reference_month !== p.quarterEndMonth || o.extra_done !== true) return;
        const metodo = metodoPagamentoIva(o.notes) || (o.notes ? `Método por definir (${o.notes})` : "Método por definir");
        map.set(o.client_id, [...(map.get(o.client_id) || []), { label: p.label, metodo }]);
      });
    });
    return map;
  }, [parcelasDoMes, flexObligations]);

  const jobFor = useMemo(() => {
    const map = new Map<string, ToconlineJob>();
    jobs.forEach((j) => { if (j.procedure_id === procedureId && j.reference_month === refMonth) map.set(j.client_id, j); });
    return map;
  }, [jobs, procedureId, refMonth]);

  const eligibleClients = useMemo(() => {
    if (!procedure) return [];
    let list = clients.filter((c: any) => c.active
      && (procedure.tipoContabilidade === null || c.tipo_contabilidade === procedure.tipoContabilidade)
      && (!procedure.filter || procedure.filter(c))
      && (!procedure.ivaFlex || (c.iva === "Trimestral" && flexInfo.has(c.id))));
    if (collabFilter === "none") list = list.filter((c: any) => !c.responsavel_id);
    else if (collabFilter !== "all") list = list.filter((c: any) => c.responsavel_id === collabFilter);
    if (isTI && faturacaoFilter !== "all") list = list.filter((c: any) => tipoFaturacao(c.programa_faturacao) === faturacaoFilter);
    if (clientSearch.trim()) {
      const s = clientSearch.trim().toLowerCase();
      list = list.filter((c: any) => c.name.toLowerCase().includes(s));
    }
    return list;
  }, [clients, procedure, collabFilter, clientSearch, isTI, faturacaoFilter, flexInfo]);

  // Por omissão só se podem selecionar clientes sem tarefa ativa neste mês
  const selectable = eligibleClients.filter((c: any) => {
    const st = jobFor.get(c.id)?.status;
    return !st || st === "cancelada" || st === "erro" || st === "bloqueada";
  });
  const allSelected = selectable.length > 0 && selectable.every((c: any) => selected.has(c.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((c: any) => c.id)));
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleActivate = async () => {
    if (!procedure || selected.size === 0) return;
    await activate.mutateAsync({ procedureId: procedure.id, clientIds: [...selected], referenceMonth: refMonth, userId: user?.id });
    setSelected(new Set());
  };

  // ---- Fila ----
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]["id"]>("ativas");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueRegime, setQueueRegime] = useState<ToconlineRegime | "todos">("todos");
  const regimeJobs = useMemo(
    () => queueRegime === "todos" ? jobs : jobs.filter((j) => procedureById(j.procedure_id)?.regime === queueRegime),
    [jobs, queueRegime],
  );
  const activeCount = (list: ToconlineJob[]) => list.filter((j) => j.status === "pendente" || j.status === "em_curso").length;

  const countFor = (tab: (typeof STATUS_TABS)[number]["id"]) =>
    tab === "todas" ? regimeJobs.length
      : tab === "ativas" ? activeCount(regimeJobs)
      : regimeJobs.filter((j) => j.status === tab).length;

  const queue = useMemo(() => {
    let list = regimeJobs;
    if (statusTab === "ativas") list = list.filter((j) => j.status === "pendente" || j.status === "em_curso");
    else if (statusTab !== "todas") list = list.filter((j) => j.status === statusTab);
    if (queueSearch.trim()) {
      const s = queueSearch.trim().toLowerCase();
      list = list.filter((j) => (clientById.get(j.client_id)?.name || "").toLowerCase().includes(s));
    }
    // Mais antigas primeiro (ordem de execução); dentro do mês, por cliente
    return [...list].sort((a, b) =>
      STATUS_ORDER.indexOf(a.status as ToconlineJobStatus) - STATUS_ORDER.indexOf(b.status as ToconlineJobStatus)
      || a.reference_month.localeCompare(b.reference_month)
      || (clientById.get(a.client_id)?.name || "").localeCompare(clientById.get(b.client_id)?.name || "", "pt"));
  }, [regimeJobs, statusTab, queueSearch, clientById]);

  // Estado da obrigação da Gestão Mensal ligada às tarefas concluídas
  const concludedMonths = useMemo(
    () => [...new Set(jobs.filter((j) => j.status === "concluida").map((j) => j.reference_month))].sort(),
    [jobs],
  );
  const { data: monthObligations = [] } = useMonthlyObligationsRange(concludedMonths);
  const obligationFor = (job: ToconlineJob) => {
    const type = procedureById(job.procedure_id)?.gestaoMensal?.obligationType;
    if (!type) return undefined;
    return monthObligations.find((o: any) => o.client_id === job.client_id && o.reference_month === job.reference_month && o.obligation_type === type);
  };

  const markGestaoMensal = async (job: ToconlineJob) => {
    const type = procedureById(job.procedure_id)?.gestaoMensal?.obligationType;
    if (!type) return;
    const existing: any = obligationFor(job);
    await upsertObligation.mutateAsync({
      ...(existing ? { id: existing.id } : {}),
      client_id: job.client_id, obligation_type: type, reference_month: job.reference_month,
      status: "concluida", completed_at: new Date().toISOString(), completed_by: user?.id || null,
    });
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Fila TOConline</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Ative aqui os procedimentos a fazer no TOConline. As tarefas são executadas pelo Claude (Claude in Chrome, com a
          sessão do TOConline iniciada) — no Claude Code, escrever <code className="px-1 rounded bg-muted">/toconline-fila</code>.
        </p>
      </div>

      {/* ---- Ativar tarefas ---- */}
      <section className="bg-card rounded-xl border p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold flex items-center gap-2"><Play className="w-4 h-4 text-primary" /> Ativar tarefas</h3>
          <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
            <button onClick={prevMonth} className="p-1 hover:bg-muted rounded" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className="p-1 hover:bg-muted rounded" aria-label="Mês seguinte"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap border-b pb-3" role="tablist" aria-label="Regime">
          {TOCONLINE_REGIMES.map((r) => (
            <button key={r.id} role="tab" aria-selected={regime === r.id} onClick={() => { setRegime(r.id); if (!procedureFor(r.id, tarefa)) setTarefa(TOCONLINE_TAREFAS.find((t) => procedureFor(r.id, t.id))?.id || "vendas"); setSelected(new Set()); }} className={tabClass(regime === r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Tarefa">
          {TOCONLINE_TAREFAS.filter((t) => procedureFor(regime, t.id)).map((t) => (
            <button key={t.id} role="tab" aria-selected={tarefa === t.id} onClick={() => { setTarefa(t.id); setSelected(new Set()); }}
              className={cn("px-3 py-1 text-sm rounded-full border transition-colors", tarefa === t.id ? "border-primary bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted")}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap items-center">
          <select value={collabFilter} onChange={(e) => setCollabFilter(e.target.value)} className={inputClass} aria-label="Responsável">
            <option value="all">Todos os responsáveis</option>
            {collaborators.filter((c: any) => c.active).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Sem responsável</option>
          </select>
          {isTI && (
            <select value={faturacaoFilter} onChange={(e) => { setFaturacaoFilter(e.target.value as TipoFaturacao | "all"); setSelected(new Set()); }} className={inputClass} aria-label="Faturação">
              <option value="all">Recibos verdes e programa</option>
              {(Object.keys(TIPO_FATURACAO_LABELS) as TipoFaturacao[]).map((t) => <option key={t} value={t}>{TIPO_FATURACAO_LABELS[t]}</option>)}
            </select>
          )}
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Pesquisar cliente..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className={cn(inputClass, "w-full pl-9")} />
          </div>
        </div>
        {procedure && (
          procedure.docPath
            ? <p className="text-xs text-muted-foreground">{procedure.description}</p>
            : <p className="text-xs text-warning flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{procedure.description}</p>
        )}

        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="w-10 px-3 py-2 text-center">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0} aria-label="Selecionar todos" />
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Cliente</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Responsável</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">{procedure?.ivaFlex ? "Parcela · Método de pagamento" : "Programa Faturação"}</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Na fila ({MONTH_NAMES[month]})</th>
                </tr>
              </thead>
              <tbody>
                {eligibleClients.map((c: any) => {
                  const job = jobFor.get(c.id);
                  const canSelect = selectable.includes(c);
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} disabled={!canSelect} aria-label={`Selecionar ${c.name}`} />
                      </td>
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{collabName(c.responsavel_id)}</td>
                      {procedure?.ivaFlex ? (
                        <td className="px-3 py-2 text-muted-foreground text-xs">
                          {(flexInfo.get(c.id) || []).map((f) => <div key={f.label}>{f.label} · <span className="font-medium text-foreground">{f.metodo}</span></div>)}
                        </td>
                      ) : (
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isTI && <FaturacaoBadge tipo={tipoFaturacao(c.programa_faturacao)} />}
                          <span>{c.programa_faturacao || "—"}</span>
                        </div>
                      </td>
                      )}
                      <td className="px-3 py-2">
                        {job ? (
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded", STATUS_CLASSES[job.status as ToconlineJobStatus])}>
                            {STATUS_LABELS[job.status as ToconlineJobStatus]}
                          </span>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {eligibleClients.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{procedure?.ivaFlex ? "Nenhum cliente com parcela de IVA flexibilizado a vencer neste mês." : "Nenhum cliente deste regime."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleActivate} disabled={selected.size === 0 || activate.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            Ativar {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </section>

      {/* ---- Fila ---- */}
      <section className="bg-card rounded-xl border overflow-hidden">
        <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Fila de tarefas</h3>
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Pesquisar cliente..." value={queueSearch} onChange={(e) => setQueueSearch(e.target.value)} className={cn(inputClass, "w-full pl-9")} />
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-3" role="tablist" aria-label="Regime da fila">
          {([{ id: "todos", label: "Todos" }, ...TOCONLINE_REGIMES] as { id: ToconlineRegime | "todos"; label: string }[]).map((r) => {
            const n = activeCount(r.id === "todos" ? jobs : jobs.filter((j) => procedureById(j.procedure_id)?.regime === r.id));
            return (
              <button key={r.id} role="tab" aria-selected={queueRegime === r.id} onClick={() => setQueueRegime(r.id)} className={tabClass(queueRegime === r.id)}>
                {r.label}{n > 0 ? ` (${n})` : ""}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 border-b">
          {STATUS_TABS.map((t) => (
            <button key={t.id} onClick={() => setStatusTab(t.id)}
              className={cn("px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                statusTab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              {t.label} ({countFor(t.id)})
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tarefa</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Mês</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground min-w-[260px]">Resultado</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Gestão Mensal</th>
                {isAdmin && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {queue.map((job) => {
                const client: any = clientById.get(job.client_id);
                const proc = procedureById(job.procedure_id);
                const status = job.status as ToconlineJobStatus;
                const obl: any = status === "concluida" ? obligationFor(job) : undefined;
                return (
                  <tr key={job.id} className="border-b last:border-0 hover:bg-muted/30 align-top" data-job-id={job.id}>
                    <td className="px-4 py-3 font-medium">
                      {client?.name || "—"}
                      {proc && (proc.regime === "ti_rs" || proc.regime === "ti_co") && client && <div className="mt-0.5"><FaturacaoBadge tipo={tipoFaturacao(client.programa_faturacao)} /></div>}
                      <div className="text-xs text-muted-foreground font-normal">
                        {userName(job.requested_by) ? `Ativada por ${userName(job.requested_by)} · ` : ""}{fmtDateTime(job.requested_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {proc ? proc.label : job.procedure_id}
                      {proc && queueRegime === "todos" && <div className="text-xs text-muted-foreground">{proc.regimeLabel}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{monthLabel(job.reference_month)}</td>
                    <td className="px-4 py-3">
                      <select value={status} aria-label={`Estado de ${client?.name || "tarefa"}`}
                        onChange={(e) => updateJob.mutate({ id: job.id, status: e.target.value as ToconlineJobStatus })}
                        className={cn("text-xs font-medium px-2 py-1 rounded border-0 focus:outline-none focus:ring-2 focus:ring-ring", STATUS_CLASSES[status])}>
                        {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                      {job.finished_at && <div className="text-xs text-muted-foreground mt-1">{fmtDateTime(job.finished_at)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        key={`${job.id}-${job.updated_at}`}
                        defaultValue={job.result_notes || ""}
                        placeholder="O que foi feito / o que ficou pendente..."
                        rows={2}
                        aria-label={`Resultado de ${client?.name || "tarefa"}`}
                        className="w-full text-xs px-2 py-1 rounded border bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val !== (job.result_notes || "")) updateJob.mutate({ id: job.id, result_notes: val || null });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {proc?.gestaoMensal && status === "concluida" ? (
                        obl?.status === "concluida" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><Check className="w-3.5 h-3.5" /> Marcado</span>
                        ) : (
                          <button onClick={() => markGestaoMensal(job)} disabled={upsertObligation.isPending} title={proc.gestaoMensal.label}
                            className="text-xs font-medium px-2 py-1 rounded border hover:bg-muted transition-colors">
                            Marcar {proc.gestaoMensal.label.split("→").pop()?.trim()}
                          </button>
                        )
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-3">
                        <button onClick={() => deleteJob.mutate(job.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive" aria-label={`Apagar tarefa de ${client?.name || ""}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {queue.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Sem tarefas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ToconlineFilaView;
