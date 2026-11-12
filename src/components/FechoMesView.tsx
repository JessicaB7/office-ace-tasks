import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Gauge, ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCollaborators, useDeadlineOverrides, useMonthlyObligations } from "@/hooks/useSupabaseQuery";
import { useCurrentCollaborator } from "@/hooks/useCurrentCollaborator";
import { makeDayResolver } from "@/lib/deadlineOverrides";
import { computeFecho, mesReferenciaPadrao, diasAte, type FechoGrupo, type Semaforo } from "@/lib/fechoMes";
import { OBRIGACAO_GROUPS, fmtPrazo, todayYmd } from "@/lib/obrigacoesControlo";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthLabel = (key: string) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
const shiftMonth = (key: string, n: number) => {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export const SEMAFORO_CLASSES: Record<Semaforo, { dot: string; bar: string; text: string; label: string }> = {
  verde: { dot: "bg-success", bar: "bg-success", text: "text-success", label: "Em dia" },
  amarelo: { dot: "bg-warning", bar: "bg-warning", text: "text-warning", label: "Atenção" },
  vermelho: { dot: "bg-destructive", bar: "bg-destructive", text: "text-destructive", label: "Urgente" },
};

export const prazoTexto = (prazo: string | null, today: string) => {
  if (!prazo) return "Tudo feito";
  const d = diasAte(today, prazo);
  if (d < 0) return `Prazo ${fmtPrazo(prazo)} ultrapassado`;
  if (d === 0) return "Prazo hoje";
  return `Próximo prazo ${fmtPrazo(prazo)} (${d} ${d === 1 ? "dia" : "dias"})`;
};

/** Cartão de um grupo (responsável ou obrigação) com barra de progresso e semáforo. */
export const FechoCard = ({ titulo, g, today, onClick, active }: { titulo: string; g: FechoGrupo; today: string; onClick?: () => void; active?: boolean }) => {
  const s = SEMAFORO_CLASSES[g.semaforo];
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("text-left rounded-xl border px-4 py-3 transition-colors w-full",
        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card hover:bg-muted/40")}>
      <div className="flex items-center gap-2">
        <span className={cn("w-3 h-3 rounded-full shrink-0", s.dot)} title={s.label} />
        <span className="font-semibold truncate flex-1">{titulo}</span>
        <span className="text-lg font-bold tabular-nums">{g.pct}%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all", s.bar)} style={{ width: `${g.pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground gap-2">
        <span>{g.feitas}/{g.total} feitas · {g.pendentes} pendentes</span>
        <span className={cn("font-medium text-right", g.pendentes > 0 && s.text)}>{prazoTexto(g.proximoPrazo, today)}</span>
      </div>
    </button>
  );
};

interface Props {
  /** Abrir o separador da obrigação no mês, já pesquisado pelo cliente. */
  onOpenObrigacao?: (groupId: string, month: string, clientName?: string) => void;
}

/** Fecho do mês com semáforo: por responsável e por tipo de obrigação. */
const FechoMesView = ({ onOpenObrigacao }: Props) => {
  const { isAdmin } = useAuth();
  const me = useCurrentCollaborator();
  const [month, setMonth] = useState(mesReferenciaPadrao());
  const [sel, setSel] = useState<{ kind: "resp" | "obr"; key: string } | null>(null);
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: overrides = [] } = useDeadlineOverrides();
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligations(month);
  const today = todayYmd();
  const dayFor = useMemo(() => makeDayResolver(overrides), [overrides]);

  // Colaboradores veem só os próprios clientes; a admin vê todos.
  const clientesVisiveis = useMemo(
    () => (isAdmin ? clients : clients.filter((c: any) => me && c.responsavel_id === me.id)),
    [clients, isAdmin, me],
  );
  const fecho = useMemo(() => computeFecho(clientesVisiveis, obligations, month, today, dayFor), [clientesVisiveis, obligations, month, today, dayFor]);
  const collabName = (id: string) => (id === "none" ? "Sem responsável" : collaborators.find((c: any) => c.id === id)?.name || "—");
  const groupLabel = (id: string) => OBRIGACAO_GROUPS.find((g) => g.id === id)?.label || id;

  const selecionado = sel && (sel.kind === "resp" ? fecho.porResponsavel : fecho.porObrigacao).find((g) => g.key === sel.key);
  const isWork = month === mesReferenciaPadrao();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Gauge className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Fecho do mês</h2>
        </div>
        <div className="flex items-center gap-2 mr-10">
          {!isWork && (
            <button type="button" onClick={() => { setMonth(mesReferenciaPadrao()); setSel(null); }}
              className="text-xs font-medium px-2 py-1 rounded-full border bg-card hover:bg-muted text-muted-foreground">Ir para o mês de trabalho</button>
          )}
          <div className="flex items-center gap-1 bg-card rounded-lg border px-1 py-0.5">
            <button type="button" onClick={() => { setMonth((m) => shiftMonth(m, -1)); setSel(null); }} className="p-1 hover:bg-muted rounded" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium min-w-[120px] text-center">{monthLabel(month)}</span>
            <button type="button" onClick={() => { setMonth((m) => shiftMonth(m, 1)); setSel(null); }} className="p-1 hover:bg-muted rounded" aria-label="Mês seguinte"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Semáforo: <span className="text-success font-medium">verde</span> ≥ 90% feito ou prazo a mais de 7 dias ·{" "}
        <span className="text-warning font-medium">amarelo</span> pendentes com prazo entre 3 e 7 dias ·{" "}
        <span className="text-destructive font-medium">vermelho</span> pendentes com prazo a menos de 3 dias ou ultrapassado. Os prazos incluem as prorrogações.
      </p>

      {isLoading || loadingObl ? <p className="text-center py-12 text-muted-foreground">A carregar...</p> : (
        <>
          <div className="max-w-md">
            <FechoCard titulo={isAdmin ? "Escritório" : "Os meus clientes"} g={fecho.total} today={today} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Por responsável</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {fecho.porResponsavel
                .sort((a, b) => collabName(a.key).localeCompare(collabName(b.key), "pt"))
                .map((g) => (
                  <FechoCard key={g.key} titulo={collabName(g.key)} g={g} today={today}
                    active={sel?.kind === "resp" && sel.key === g.key}
                    onClick={() => setSel(sel?.kind === "resp" && sel.key === g.key ? null : { kind: "resp", key: g.key })} />
                ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Por tipo de obrigação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {fecho.porObrigacao.map((g) => (
                <FechoCard key={g.key} titulo={groupLabel(g.key)} g={g} today={today}
                  active={sel?.kind === "obr" && sel.key === g.key}
                  onClick={() => setSel(sel?.kind === "obr" && sel.key === g.key ? null : { kind: "obr", key: g.key })} />
              ))}
            </div>
          </div>

          {selecionado && (
            <div className="bg-card rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
                <h3 className="font-semibold text-sm">
                  Em falta — {sel!.kind === "resp" ? collabName(sel!.key) : groupLabel(sel!.key)} ({selecionado.emFalta.length})
                </h3>
                <button type="button" onClick={() => setSel(null)} className="p-1 rounded hover:bg-muted" aria-label="Fechar"><X className="w-4 h-4" /></button>
              </div>
              {selecionado.emFalta.length === 0 ? (
                <p className="text-sm text-success text-center py-6">Nada em falta.</p>
              ) : (
                <div className="divide-y">
                  {[...selecionado.emFalta]
                    .sort((a, b) => a.task.deadline.localeCompare(b.task.deadline) || a.client.name.localeCompare(b.client.name, "pt"))
                    .map((f) => {
                      const d = diasAte(today, f.task.deadline);
                      return (
                        <button key={`${f.client.id}|${f.task.type}|${f.task.field}`} type="button"
                          onClick={() => onOpenObrigacao?.(f.task.group, month, f.client.name)}
                          className="group w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-muted/30">
                          <span className="font-medium flex-1 truncate">{f.client.name}</span>
                          {sel!.kind === "obr" && <span className="text-xs text-muted-foreground hidden sm:inline">{collabName(f.client.responsavel_id || "none")}</span>}
                          <span className="text-xs px-2 py-0.5 rounded-full border bg-card">{f.task.label}</span>
                          <span className={cn("text-xs tabular-nums w-16 text-right", d < 0 ? "text-destructive font-medium" : d < 3 ? "text-destructive" : d <= 7 ? "text-warning" : "text-muted-foreground")}>
                            {fmtPrazo(f.task.deadline)}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FechoMesView;
