import { useEffect, useState, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Check, ChevronLeft, ChevronRight, Play, Square, User, History, ArrowLeft, Building2 } from "lucide-react";
import {
  useClientObligationsHistory, useCollaborators, useUpsertObligation, useUpsertClient,
  useRunningTimeEntry, useStartTimer, useStopTimer,
} from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { formatDurationClock } from "@/lib/formatDuration";
import MonthlyNoteCell from "@/components/MonthlyNoteCell";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface ClientMonthlyHistoryDialogProps {
  client: any | null;
  open: boolean;
  onClose: () => void;
  activeTab: string;
  columns?: string[];
  /** Mês de referência atual da página (para as notas do mês), formato "YYYY-MM-01". */
  referenceMonth?: string;
  showNotes?: boolean;
  notesObligation?: any;
  /** "modal" (omissão): diálogo sobreposto, como hoje. "page": ocupa a aba
   * inteira (usado em Empresas) — sem overlay, com botão "Voltar" e a
   * tabela de meses sempre visível, sem navegação lateral. */
  variant?: "modal" | "page";
}

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-sm truncate">{value || "—"}</div>
  </div>
);

/** Notas gerais do cliente (campo `clients.notas_internas`) — ao contrário das
 * notas do mês, não estão presas a um mês: aparecem sempre, em qualquer mês. */
const GeneralNotesField = ({ clientId, name, initialNotes }: { clientId: string; name: string; initialNotes: string }) => {
  const [value, setValue] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const upsertClient = useUpsertClient();
  const lastSavedRef = useRef(initialNotes || "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(initialNotes || "");
    lastSavedRef.current = initialNotes || "";
  }, [initialNotes, clientId]);

  const persist = (next: string) => {
    if (next === lastSavedRef.current) return;
    setSaving(true);
    upsertClient.mutate({ id: clientId, name, notas_internas: next || null }, {
      onSettled: () => setSaving(false),
    });
    lastSavedRef.current = next;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(v), 600);
  };

  const handleBlur = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    persist(value);
  };

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Notas gerais do cliente (aparecem em todos os meses)..."
        rows={2}
        className="w-full text-xs rounded border bg-background px-2 py-1 resize-y focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {saving && <span className="absolute top-1 right-1 text-[10px] text-muted-foreground">a guardar…</span>}
    </div>
  );
};

/** Cronómetro de trabalho neste cliente — mede quanto tempo o colaborador com
 * sessão iniciada passa realmente a tratar dele. Só um cronómetro por
 * colaborador de cada vez (garantido pela BD); se já houver um a decorrer
 * noutro cliente, oferece trocar para este. */
const TimerSection = ({ clientId, clientName, collaboratorId }: { clientId: string; clientName: string; collaboratorId: string | null }) => {
  const { data: runningEntry } = useRunningTimeEntry(collaboratorId);
  const start = useStartTimer();
  const stop = useStopTimer();
  const [tick, setTick] = useState(Date.now());

  const isRunningHere = runningEntry?.client_id === clientId;
  const isRunningElsewhere = !!runningEntry && !isRunningHere;

  useEffect(() => {
    if (!isRunningHere) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isRunningHere]);

  if (!collaboratorId) {
    return (
      <div className="text-xs text-muted-foreground">
        Não foi possível identificar o teu perfil de colaborador — o cronómetro fica indisponível.
      </div>
    );
  }

  const elapsedLabel = isRunningHere && runningEntry
    ? formatDurationClock(tick - new Date(runningEntry.started_at).getTime())
    : null;

  const handleStart = () => start.mutate({ clientId, collaboratorId });
  const handleStop = () => { if (runningEntry) stop.mutate(runningEntry.id); };
  const handleSwitch = () => {
    if (!runningEntry) return;
    stop.mutate(runningEntry.id, { onSuccess: () => start.mutate({ clientId, collaboratorId }) });
  };

  if (isRunningHere) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2">
        <span className="text-sm font-mono font-semibold text-success">{elapsedLabel}</span>
        <button type="button" onClick={handleStop} disabled={stop.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors disabled:opacity-50">
          <Square className="w-3 h-3 fill-current" /> Parar
        </button>
      </div>
    );
  }

  if (isRunningElsewhere) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">A decorrer noutro cliente</span>
        <button type="button" onClick={handleSwitch} disabled={start.isPending || stop.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50">
          <Play className="w-3 h-3 fill-current" /> Trocar para {clientName}
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={handleStart} disabled={start.isPending}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-card text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50">
      <Play className="w-3.5 h-3.5 fill-current text-success" /> Iniciar cronómetro
    </button>
  );
};

/** Ficha do cliente — abre ao clicar num "ícone" da galeria (TI RS Reg. IVA, TI CO,
 * Empresas): junta os dados do cliente com a grelha de meses/obrigações do ano,
 * já interativa (dá para marcar/desmarcar aqui, não só consultar). */
const ClientMonthlyHistoryDialog = ({
  client, open, onClose, activeTab, columns, referenceMonth, showNotes, notesObligation, variant = "modal",
}: ClientMonthlyHistoryDialogProps) => {
  const oblPrefix = `contabilidade_${activeTab}`;
  const { data: obligations = [], isLoading } = useClientObligationsHistory(
    client?.id || null,
    oblPrefix
  );
  const { data: collaborators = [] } = useCollaborators();
  const { user } = useAuth();
  const upsert = useUpsertObligation();
  const qc = useQueryClient();

  const hasMultiColumns = !!columns && columns.length > 0;

  const responsavelName = useMemo(() => {
    if (!client?.responsavel_id) return null;
    return collaborators.find((c: any) => c.id === client.responsavel_id)?.name || null;
  }, [collaborators, client]);

  // Colaborador correspondente ao utilizador com sessão iniciada — é o dono
  // do cronómetro (cada um só regista o próprio tempo).
  const currentCollaboratorId = useMemo(() => {
    if (!user?.email) return null;
    return collaborators.find((c: any) => c.email?.toLowerCase() === user.email!.toLowerCase())?.id || null;
  }, [user, collaborators]);

  // Build column obligation type keys
  const colOblTypes = useMemo(() => {
    if (!columns) return [];
    return columns.map((col) => `contabilidade_${activeTab}_${col.toLowerCase().replace(/[- ]/g, "_")}`);
  }, [columns, activeTab]);

  // Secção ativa — navegação lateral em vez de tudo empilhado.
  const [section, setSection] = useState<"dados" | "historico">("dados");

  // Group obligations by month
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());

  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; year: number; month: number }[] = [];

    // Show Jan-Dec for selected year
    for (let m = 0; m < 12; m++) {
      months.push({
        key: `${historyYear}-${String(m + 1).padStart(2, "0")}-01`,
        label: `${MONTH_NAMES[m]} ${historyYear}`,
        year: historyYear,
        month: m,
      });
    }

    return months.map((monthInfo) => {
      const monthObls = obligations.filter((o: any) => o.reference_month === monthInfo.key);

      if (hasMultiColumns) {
        const colObls = colOblTypes.map((type) => monthObls.find((o: any) => o.obligation_type === type));
        const colStatus = colObls.map((o: any) => o?.status === "concluida");
        return { ...monthInfo, colObls, colStatus, allDone: colStatus.every(Boolean) };
      } else {
        const obl = monthObls.find((o: any) => o.obligation_type === oblPrefix);
        const done = obl?.status === "concluida";
        return { ...monthInfo, singleObl: obl, colStatus: [] as boolean[], done, allDone: done };
      }
    });
  }, [obligations, oblPrefix, hasMultiColumns, colOblTypes, historyYear]);

  const invalidateHistory = () => {
    qc.invalidateQueries({ queryKey: ["client_obligations_history", client?.id, oblPrefix] });
  };

  const toggleCell = (monthKey: string, type: string, existing: any | undefined) => {
    if (!client) return;
    const done = existing?.status === "concluida";
    upsert.mutate({
      client_id: client.id,
      obligation_type: type,
      reference_month: monthKey,
      status: done ? "pendente" : "concluida",
      completed_at: done ? null : new Date().toISOString(),
      completed_by: done ? null : user?.id || null,
      ...(existing?.id ? { id: existing.id } : {}),
    }, { onSuccess: invalidateHistory });
  };

  if (!open || !client) return null;

  if (variant === "page") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{client.name}</h2>
              <p className="text-sm text-muted-foreground">Ficha do cliente</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-card border rounded-lg px-2 py-1">
            <button onClick={() => setHistoryYear(y => y - 1)} className="p-1 hover:bg-muted rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium min-w-[60px] text-center">{historyYear}</span>
            <button onClick={() => setHistoryYear(y => y + 1)} className="p-1 hover:bg-muted rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3">
            <Field label="NIF" value={client.nif} />
            <Field label="NISS" value={client.niss} />
            <Field label="Programa de Faturação" value={client.programa_faturacao} />
            <Field label="IVA" value={client.iva} />
            <Field label="Salários" value={client.salarios} />
            <Field label="Responsável" value={responsavelName} />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Tempo de trabalho
              </div>
              <TimerSection clientId={client.id} clientName={client.name} collaboratorId={currentCollaboratorId} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Notas gerais
              </div>
              <GeneralNotesField clientId={client.id} name={client.name} initialNotes={client.notas_internas || ""} />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border p-5 space-y-4">
          <h3 className="font-semibold text-sm">Meses — {historyYear}</h3>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">A carregar...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Mês</th>
                    {hasMultiColumns ? (
                      columns!.map((col) => (
                        <th key={col} className="text-center px-2 py-2 font-semibold text-muted-foreground text-xs">{col}</th>
                      ))
                    ) : (
                      <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Estado</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((row: any) => (
                    <tr key={row.key} className={cn("border-b last:border-0", row.key === referenceMonth && "bg-primary/5")}>
                      <td className={cn("px-3 py-2.5 font-medium", row.allDone && "text-muted-foreground")}>{row.label}</td>
                      {hasMultiColumns ? (
                        row.colStatus.map((done: boolean, i: number) => (
                          <td key={colOblTypes[i]} className="text-center px-2 py-2.5">
                            <button type="button" onClick={() => toggleCell(row.key, colOblTypes[i], row.colObls[i])}
                              className={cn(
                                "w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors hover:border-primary",
                                done ? "bg-success border-success text-success-foreground" : "border-muted-foreground/20"
                              )}>
                              {done && <Check className="w-3 h-3" />}
                            </button>
                          </td>
                        ))
                      ) : (
                        <td className="text-center px-3 py-2.5">
                          <button type="button" onClick={() => toggleCell(row.key, oblPrefix, row.singleObl)}
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors hover:border-primary",
                              row.done ? "bg-success border-success text-success-foreground" : "border-muted-foreground/20"
                            )}>
                            {row.done && <Check className="w-3 h-3" />}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-bold">{client.name}</h3>
            <p className="text-sm text-muted-foreground">Ficha do cliente</p>
          </div>
          <div className="flex items-center gap-2">
            {section === "historico" && (
              <div className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1">
                <button onClick={() => setHistoryYear(y => y - 1)} className="p-0.5 hover:bg-background rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-medium min-w-[50px] text-center">{historyYear}</span>
                <button onClick={() => setHistoryYear(y => y + 1)} className="p-0.5 hover:bg-background rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row">
          <nav className="flex sm:flex-col gap-1 shrink-0 overflow-x-auto sm:overflow-visible p-3 sm:w-40 sm:border-r">
            <button type="button" onClick={() => setSection("dados")}
              className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                section === "dados" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <User className="w-4 h-4" /> Dados
            </button>
            <button type="button" onClick={() => setSection("historico")}
              className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                section === "historico" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <History className="w-4 h-4" /> Histórico
            </button>
          </nav>

          <div className="flex-1 min-w-0">
            {section === "dados" ? (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                  <Field label="NIF" value={client.nif} />
                  <Field label="NISS" value={client.niss} />
                  <Field label="Programa de Faturação" value={client.programa_faturacao} />
                  <Field label="IVA" value={client.iva} />
                  <Field label="Salários" value={client.salarios} />
                  <Field label="Responsável" value={responsavelName} />
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Tempo de trabalho
                  </div>
                  <TimerSection clientId={client.id} clientName={client.name} collaboratorId={currentCollaboratorId} />
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Notas gerais
                  </div>
                  <GeneralNotesField clientId={client.id} name={client.name} initialNotes={client.notas_internas || ""} />
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {showNotes && referenceMonth && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      Notas do mês atual
                    </div>
                    <MonthlyNoteCell
                      clientId={client.id}
                      referenceMonth={referenceMonth}
                      obligationId={notesObligation?.id}
                      initialNotes={notesObligation?.notes || ""}
                    />
                  </div>
                )}

                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">A carregar...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Mês</th>
                        {hasMultiColumns ? (
                          columns!.map((col) => (
                            <th key={col} className="text-center px-2 py-2 font-semibold text-muted-foreground text-xs">{col}</th>
                          ))
                        ) : (
                          <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Estado</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((row: any) => (
                        <tr key={row.key} className={cn("border-b last:border-0", row.key === referenceMonth && "bg-primary/5")}>
                          <td className={cn("px-3 py-2.5 font-medium", row.allDone && "text-muted-foreground")}>{row.label}</td>
                          {hasMultiColumns ? (
                            row.colStatus.map((done: boolean, i: number) => (
                              <td key={colOblTypes[i]} className="text-center px-2 py-2.5">
                                <button type="button" onClick={() => toggleCell(row.key, colOblTypes[i], row.colObls[i])}
                                  className={cn(
                                    "w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors hover:border-primary",
                                    done ? "bg-success border-success text-success-foreground" : "border-muted-foreground/20"
                                  )}>
                                  {done && <Check className="w-3 h-3" />}
                                </button>
                              </td>
                            ))
                          ) : (
                            <td className="text-center px-3 py-2.5">
                              <button type="button" onClick={() => toggleCell(row.key, oblPrefix, row.singleObl)}
                                className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-colors hover:border-primary",
                                  row.done ? "bg-success border-success text-success-foreground" : "border-muted-foreground/20"
                                )}>
                                {row.done && <Check className="w-3 h-3" />}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientMonthlyHistoryDialog;
