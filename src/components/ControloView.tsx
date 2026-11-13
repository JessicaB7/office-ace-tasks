import { useMemo, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, ArrowUpRight, ClipboardList, Gauge, Hourglass, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useControloAudit,
  useControloClients,
  useControloCollaborators,
  useControloObrigacoes,
  useControloOverrides,
  useControloPedidos,
  useControloTarefasAbertas,
} from "@/hooks/useControlo";
import { useOffboardings } from "@/hooks/useOffboardings";
import { comUltimoMes } from "@/lib/carteira";
import { makeDayResolver } from "@/lib/deadlineOverrides";
import { computeFecho, mesReferenciaPadrao, diasAte, type FechoEmFalta, type Semaforo } from "@/lib/fechoMes";
import { fmtPrazo, todayYmd, OBRIGACAO_GROUPS } from "@/lib/obrigacoesControlo";
import { fmtPedido } from "@/lib/pedidosCliente";
import { SEMAFORO_CLASSES, prazoTexto } from "@/components/FechoMesView";
import {
  PASSAGEM,
  PESO_TIPO,
  calcularEquipa,
  calcularPassagem,
  calcularRisco,
  mesDe,
  pedidosAbertos,
  pendenciasGestaoMensal,
  REGIME_GM_LABEL,
  pesoCliente,
  proximosPrazos,
  shiftMes,
  tarefaEmAtraso,
  type ClienteCtl,
  type MotivoRisco,
  type ObrigacaoLinha,
  type PedidoAberto,
  type PendenciaGMItem,
  type TarefaCtl,
  type RiscoCliente,
} from "@/lib/controlo";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1];
const eur = (v: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const tipoObrigacao = (t: string) => t.replace(/^contabilidade_/, "").replace(/_/g, " ");

/** Lista vazia estável (evita recalcular os useMemo a cada render enquanto carrega). */
const NADA: never[] = [];

type Tom = "success" | "warning" | "destructive" | "muted";
const TOM_TEXT: Record<Tom, string> = { success: "text-success", warning: "text-warning", destructive: "text-destructive", muted: "text-muted-foreground" };

interface Linha {
  key: string;
  titulo: string;
  sub?: string;
  motivo?: string;
  valor?: string;
  tom?: Tom;
  onClick?: () => void;
}
interface Detalhe {
  titulo: string;
  descricao?: string;
  linhas: Linha[];
}

interface Props {
  onOpenClient: (clientId: string, tab?: string) => void;
  onOpenObrigacao: (groupId: string, month: string, clientName?: string) => void;
  onNavigate: (view: string) => void;
  /** Abre a Gestão Mensal no separador do regime, no mês, já filtrada pelo cliente. */
  onOpenGestaoMensal: (regime: string, month: string, clientName?: string) => void;
}

const Secao = ({ titulo, icon: Icon, children, className }: { titulo: string; icon: typeof Gauge; children: ReactNode; className?: string }) => (
  <section className={cn("bg-card rounded-xl border p-5 space-y-4", className)}>
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-primary" />
      <h3 className="font-semibold text-lg">{titulo}</h3>
    </div>
    {children}
  </section>
);

/** Número grande clicável. */
const Numero = ({ valor, label, sub, tom, onClick, dot }: { valor: ReactNode; label: string; sub?: ReactNode; tom?: Tom; onClick?: () => void; dot?: Semaforo }) => (
  <button type="button" onClick={onClick} disabled={!onClick}
    className="group text-left rounded-lg border bg-background px-4 py-3 hover:bg-muted/40 disabled:hover:bg-background transition-colors min-w-0">
    <div className="flex items-center gap-2">
      {dot && <span className={cn("w-3 h-3 rounded-full shrink-0", SEMAFORO_CLASSES[dot].dot)} title={SEMAFORO_CLASSES[dot].label} />}
      <span className={cn("text-3xl font-bold tabular-nums leading-tight", tom && TOM_TEXT[tom])}>{valor}</span>
      {onClick && <ArrowUpRight className="w-4 h-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100" />}
    </div>
    <p className="text-sm font-medium mt-1">{label}</p>
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </button>
);

/** Número pequeno clicável (dentro de tabelas). */
const Cel = ({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) => (
  <button type="button" onClick={onClick} className={cn("tabular-nums font-semibold hover:underline underline-offset-2", className)}>{children}</button>
);

/** Página «Controlo» — página inicial da admin. */
const ControloView = ({ onOpenClient, onOpenObrigacao, onNavigate, onOpenGestaoMensal }: Props) => {
  const today = todayYmd();
  const mesAtual = mesDe(today);
  const mesRef = mesReferenciaPadrao();
  const mesesPrazos = useMemo(() => [shiftMes(mesRef, -1), mesRef, mesAtual], [mesRef, mesAtual]);
  const auditDesde = PASSAGEM.desde < mesAtual ? PASSAGEM.desde : mesAtual;

  const qClients = useControloClients();
  const qCollabs = useControloCollaborators();
  const qTarefas = useControloTarefasAbertas();
  const qPedidos = useControloPedidos();
  const qObl = useControloObrigacoes(mesesPrazos);
  const qAudit = useControloAudit(auditDesde);
  const qOverrides = useControloOverrides();
  const qSaidas = useOffboardings();
  const queries = [qClients, qCollabs, qTarefas, qPedidos, qObl, qAudit, qOverrides, qSaidas];
  const loading = queries.some((q) => q.isLoading);
  const fetching = queries.some((q) => q.isFetching);
  const erro = queries.find((q) => q.error)?.error as Error | undefined;

  const clients = qClients.data ?? NADA;
  const collaborators = qCollabs.data ?? NADA;
  const abertas = qTarefas.data ?? NADA;
  const tarefas = useMemo(() => abertas.filter((t) => tarefaEmAtraso(t, today)), [abertas, today]);
  const pedidos = qPedidos.data ?? NADA;
  const obligations: ObrigacaoLinha[] = qObl.data ?? NADA;
  const audit = qAudit.data ?? NADA;
  const dayFor = useMemo(() => makeDayResolver(qOverrides.data ?? NADA), [qOverrides.data]);

  const nomeCol = (id?: string | null) => (!id || id === "none" ? "Sem responsável" : collaborators.find((c) => c.id === id)?.name || "—");
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const fecho = useMemo(
    () => computeFecho(clients, obligations.filter((o) => String(o.reference_month).slice(0, 7) === mesRef.slice(0, 7)), mesRef, today, dayFor),
    [clients, obligations, mesRef, today, dayFor],
  );
  const prazos = useMemo(() => proximosPrazos(clients, obligations, mesesPrazos, today, dayFor), [clients, obligations, mesesPrazos, today, dayFor]);
  const risco = useMemo(() => calcularRisco(clients, tarefas, pedidos, today), [clients, tarefas, pedidos, today]);
  // Equipa: clientes em carteira e avenças com as regras de carteira.ts (as mesmas da página «Negócio»).
  const carteira = useMemo(() => comUltimoMes(clients, qSaidas.data ?? NADA), [clients, qSaidas.data]);
  const equipa = useMemo(
    () => calcularEquipa(collaborators, carteira, abertas, fecho, today, mesAtual, audit.filter((a) => a.campo === "mensalidade")),
    [collaborators, carteira, abertas, fecho, today, mesAtual, audit],
  );
  const totEquipa = useMemo(() => ({
    clientes: equipa.reduce((s, l) => s + l.clientes.length, 0),
    avenca: equipa.reduce((s, l) => s + l.avenca, 0),
    carga: equipa.reduce((s, l) => s + l.carga, 0),
    abertas: equipa.reduce((s, l) => s + l.tarefasAbertas.length, 0),
    atraso: equipa.reduce((s, l) => s + l.tarefasAtraso.length, 0),
  }), [equipa]);
  const pendGM = useMemo(() => pendenciasGestaoMensal(clients, obligations, mesRef), [clients, obligations, mesRef]);
  const pedAbertos = useMemo(() => pedidosAbertos(clients, pedidos, today), [clients, pedidos, today]);
  const pedAtrasados = pedAbertos.filter((p) => p.atrasado);
  const pedPorResp = useMemo(() => {
    const m = new Map<string, PedidoAberto[]>();
    pedAbertos.forEach((p) => { const k = p.client.responsavel_id || "none"; m.set(k, [...(m.get(k) ?? []), p]); });
    return [...m.entries()];
  }, [pedAbertos]);
  const adminCol = collaborators.find((c) => c.name === PASSAGEM.deNome);
  const passagem = useMemo(() => calcularPassagem(audit, clients, adminCol?.id ?? null, today), [audit, clients, adminCol, today]);

  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const abrir = (d: Detalhe) => setDetalhe(d);
  const irPara = (fn: () => void) => () => { setDetalhe(null); fn(); };

  // ---- construtores de linhas
  const linhaCliente = (c: ClienteCtl, extra: Partial<Linha> = {}, tab?: string): Linha => ({
    key: c.id,
    titulo: c.name,
    sub: [nomeCol(c.responsavel_id), c.tipo_contabilidade].filter(Boolean).join(" · "),
    onClick: irPara(() => onOpenClient(c.id, tab)),
    ...extra,
  });
  const linhasEmFalta = (emFalta: FechoEmFalta[]): Linha[] =>
    [...emFalta]
      .sort((a, b) => a.task.deadline.localeCompare(b.task.deadline) || String(a.client.name).localeCompare(String(b.client.name), "pt"))
      .map((f) => {
        const d = diasAte(today, f.task.deadline);
        return {
          key: `${f.client.id}|${f.task.type}|${f.task.field}`,
          titulo: f.client.name,
          sub: nomeCol(f.client.responsavel_id),
          motivo: f.task.label,
          valor: fmtPrazo(f.task.deadline),
          tom: d < 3 ? "destructive" : d <= 7 ? "warning" : "muted",
          onClick: irPara(() => onOpenObrigacao(f.task.group, mesRef, f.client.name)),
        };
      });
  const linhasRisco = (l: RiscoCliente[], so?: MotivoRisco): Linha[] =>
    l.map((r) => linhaCliente(r.client, {
      motivo: (so ? r.motivos.filter((m) => m.tipo === so) : r.motivos).map((m) => m.texto).join(" · "),
      valor: so ? undefined : `${r.pontos} pts`,
      tom: r.pontos >= 6 ? "destructive" : r.pontos >= 3 ? "warning" : "muted",
    }, r.emSaida && (!so || so === "saida") ? "saida" : undefined));
  const linhasTarefas = (l: TarefaCtl[], abertas = false): Linha[] =>
    l.map((t) => {
      const c = t.client_id ? clientById.get(t.client_id) : null;
      const atraso = tarefaEmAtraso(t, today);
      return {
        key: t.id,
        titulo: t.title ?? "",
        sub: [c?.name, nomeCol(t.collaborator_id)].filter(Boolean).join(" · "),
        valor: abertas && !atraso ? (t.due_date ? fmtPrazo(String(t.due_date).slice(0, 10)) : undefined) : `${diasAte(String(t.due_date).slice(0, 10), today)} dias`,
        tom: atraso ? "destructive" : "muted",
        onClick: irPara(() => (c ? onOpenClient(c.id) : onNavigate("tasks"))),
      };
    });

  const linhasGM = (l: PendenciaGMItem[]): Linha[] =>
    l.map((f) => linhaCliente(f.client, {
      key: `${f.client.id}|${f.type}`,
      motivo: [REGIME_GM_LABEL[f.regime], f.status === "em_andamento" ? "em curso" : null,
        f.pedidoEm ? `⏳ pedido ${fmtPedido(f.pedidoEm)}${f.pedidoNota ? ` (${f.pedidoNota})` : ""}` : null].filter(Boolean).join(" · "),
      onClick: irPara(() => onOpenGestaoMensal(f.regime, mesRef, f.client.name)),
    }));
  const linhasPedidos = (l: PedidoAberto[]): Linha[] =>
    l.map((p) => linhaCliente(p.client, {
      key: p.obl.id,
      motivo: `${p.rotulo} · pedido ${fmtPedido(p.obl.pedido_cliente_em!)}${p.obl.pedido_cliente_nota ? ` · ${p.obl.pedido_cliente_nota}` : ""}`,
      valor: p.dias === 0 ? "hoje" : `${p.dias} ${p.dias === 1 ? "dia" : "dias"}`,
      tom: p.atrasado ? "destructive" : "muted",
      onClick: irPara(() => (p.regime
        ? onOpenGestaoMensal(p.regime, String(p.obl.reference_month ?? mesRef).slice(0, 10), p.client.name)
        : onOpenClient(p.client.id))),
    }));
  const nomeGrupo = (id: string) => OBRIGACAO_GROUPS.find((g) => g.id === id)?.label ?? id;

  const totalFecho = fecho.total;
  const ndivida = new Set([...risco.porMotivo.divida_at, ...risco.porMotivo.divida_ss].map((r) => r.client.id)).size;
  const passPct = Math.min(100, Math.round((passagem.feitos.length / passagem.meta) * 100));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Controlo</h2>
        </div>
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 mr-10">
          <RefreshCw className={cn("w-3.5 h-3.5", fetching && "animate-spin")} />
          {fetching ? "A atualizar…" : `Atualizado ao abrir · ${fmtData(today)}`}
        </span>
      </div>

      {erro && <p className="text-sm text-destructive">Erro ao carregar dados: {erro.message}</p>}

      {loading ? <p className="text-center py-12 text-muted-foreground">A carregar...</p> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* 1. TRABALHO DO MÊS */}
          <Secao titulo={`Trabalho do mês — obrigações de ${nomeMes(mesRef)}`} icon={Gauge}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Numero valor={`${totalFecho.pct}%`} dot={totalFecho.semaforo} label="Obrigações concluídas"
                sub={`${totalFecho.feitas}/${totalFecho.total} · ${prazoTexto(totalFecho.proximoPrazo, today)}`}
                onClick={() => abrir({ titulo: `Obrigações em falta — ${nomeMes(mesRef)}`, descricao: "Clica para abrir a obrigação já filtrada pelo cliente.", linhas: linhasEmFalta(totalFecho.emFalta) })} />
              <div className="rounded-lg border bg-background px-4 py-3 space-y-2">
                <p className="text-sm font-medium">Próximos prazos</p>
                {prazos.length === 0 && <p className="text-xs text-muted-foreground">Sem prazos com pendentes.</p>}
                {prazos.map((p) => {
                  const d = diasAte(today, p.deadline);
                  return (
                    <button key={p.deadline} type="button"
                      onClick={() => abrir({
                        titulo: `Prazo ${fmtData(p.deadline)} — clientes em falta`,
                        descricao: p.labels.join(", "),
                        linhas: p.clientes.map(({ client, tasks }) => ({
                          key: client.id,
                          titulo: client.name,
                          sub: nomeCol(client.responsavel_id),
                          motivo: tasks.map((t) => t.label).join(", "),
                          onClick: irPara(() => onOpenObrigacao(tasks[0].group, tasks[0].month, client.name)),
                        })),
                      })}
                      className="w-full flex items-center gap-2 text-left text-sm hover:bg-muted/40 rounded px-1 -mx-1">
                      <span className={cn("font-semibold tabular-nums w-12", d < 3 ? "text-destructive" : d <= 7 ? "text-warning" : "")}>{fmtPrazo(p.deadline)}</span>
                      <span className="flex-1 truncate text-xs text-muted-foreground" title={p.labels.join(", ")}>{p.labels.join(", ")}</span>
                      <span className="font-bold tabular-nums">{p.clientes.length}</span>
                      <span className="text-xs text-muted-foreground">{p.clientes.length === 1 ? "cliente" : "clientes"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Por responsável</p>
              {[...fecho.porResponsavel].sort((a, b) => nomeCol(a.key).localeCompare(nomeCol(b.key), "pt")).map((g) => {
                const s = SEMAFORO_CLASSES[g.semaforo];
                return (
                  <button key={g.key} type="button"
                    onClick={() => abrir({ titulo: `Em falta — ${nomeCol(g.key)}`, descricao: prazoTexto(g.proximoPrazo, today), linhas: linhasEmFalta(g.emFalta) })}
                    className="w-full text-left hover:bg-muted/40 rounded px-1 -mx-1 py-0.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} title={s.label} />
                      <span className="font-medium flex-1 truncate">{nomeCol(g.key)}</span>
                      <span className="text-xs text-muted-foreground">{g.feitas}/{g.total}</span>
                      <span className="font-semibold tabular-nums w-10 text-right">{g.pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full", s.bar)} style={{ width: `${g.pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Semáforo: <span className="text-success">verde</span> ≥ 90% ou prazo a mais de 7 dias · <span className="text-warning">amarelo</span> 3 a 7 dias com pendentes · <span className="text-destructive">vermelho</span> menos de 3 dias ou ultrapassado. Inclui prorrogações.
            </p>
          </Secao>

          {/* 2. CLIENTES EM RISCO */}
          <Secao titulo="Clientes em risco" icon={AlertTriangle}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Numero valor={risco.clientes.length} label="Total" tom={risco.clientes.length ? "destructive" : "success"}
                onClick={() => abrir({ titulo: "Clientes em risco", descricao: "Do mais grave para o menos grave.", linhas: linhasRisco(risco.clientes) })} />
              <Numero valor={ndivida} label="Dívida AT/SS" onClick={() => abrir({
                titulo: "Clientes com dívida à AT ou à SS",
                linhas: linhasRisco(risco.clientes.filter((r) => r.dividaAT || r.dividaSS)).map((l) => ({ ...l, motivo: risco.clientes.find((r) => r.client.id === l.key)!.motivos.filter((m) => m.tipo.startsWith("divida")).map((m) => m.texto).join(" · "), valor: undefined })),
              })} />
              <Numero valor={risco.porMotivo.tarefas.length} label="Tarefas em atraso" onClick={() => abrir({
                titulo: "Clientes com tarefas em atraso",
                linhas: linhasTarefas(risco.porMotivo.tarefas.flatMap((r) => r.tarefas.map((t) => t.task))),
              })} />
              <Numero valor={risco.porMotivo.saida.length} label="Em saída" onClick={() => abrir({ titulo: "Clientes em saída", linhas: linhasRisco(risco.porMotivo.saida, "saida") })} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Os 10 casos mais graves</p>
              {risco.clientes.length === 0 ? <p className="text-sm text-success py-2">Nenhum cliente em risco.</p> : (
                <div className="divide-y">
                  {risco.clientes.slice(0, 10).map((r, i) => (
                    <button key={r.client.id} type="button" onClick={() => onOpenClient(r.client.id, r.emSaida ? "saida" : undefined)}
                      className="group w-full flex items-center gap-3 py-1.5 text-sm text-left hover:bg-muted/30 rounded">
                      <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium truncate block">{r.client.name}</span>
                        <span className="text-xs text-muted-foreground truncate block">{nomeCol(r.client.responsavel_id)} · {r.motivos.map((m) => m.texto).join(" · ")}</span>
                      </span>
                      <span className={cn("text-xs font-semibold tabular-nums", r.pontos >= 6 ? "text-destructive" : r.pontos >= 3 ? "text-warning" : "text-muted-foreground")}>{r.pontos} pts</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                Pontuação: dívida AT 3 · dívida SS 3 · cada pedido &gt; 5 dias 2 (máx. 6) · cada tarefa em atraso 1 (máx. 4, +1 se alguma tiver mais de 30 dias) · em saída 2.
              </p>
            </div>
          </Secao>

          {/* 3. PENDÊNCIAS POR OBRIGAÇÃO */}
          <Secao titulo={`Pendências por obrigação — ${nomeMes(mesRef)}`} icon={ClipboardList}>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Gestão mensal</p>
              {pendGM.length === 0 && <p className="text-sm text-muted-foreground">Sem tarefas neste mês.</p>}
              {pendGM.map((g) => (
                <button key={g.coluna} type="button" disabled={!g.emFalta.length}
                  onClick={() => abrir({ titulo: `${g.coluna} por fazer — ${nomeMes(mesRef)}`, descricao: "Clica para abrir a Gestão mensal já filtrada pelo cliente.", linhas: linhasGM(g.emFalta) })}
                  className="w-full text-left hover:bg-muted/40 disabled:hover:bg-transparent rounded px-1 -mx-1 py-0.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium flex-1 truncate">{g.coluna}</span>
                    <span className="text-xs text-muted-foreground">{g.feitas}/{g.total}</span>
                    <span className={cn("font-semibold tabular-nums w-20 text-right", g.emFalta.length ? "" : "text-success")}>
                      {g.emFalta.length ? `${g.emFalta.length} em falta` : "feito"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full", g.pct >= 90 ? "bg-success" : "bg-primary")} style={{ width: `${g.pct}%` }} />
                  </div>
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Obrigações fiscais</p>
              {fecho.porObrigacao.map((g) => {
                const s = SEMAFORO_CLASSES[g.semaforo];
                return (
                  <button key={g.key} type="button" disabled={!g.pendentes}
                    onClick={() => abrir({ titulo: `${nomeGrupo(g.key)} em falta — ${nomeMes(mesRef)}`, descricao: prazoTexto(g.proximoPrazo, today), linhas: linhasEmFalta(g.emFalta) })}
                    className="w-full flex items-center gap-2 text-sm text-left hover:bg-muted/40 disabled:hover:bg-transparent rounded px-1 -mx-1 py-0.5">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} title={s.label} />
                    <span className="font-medium flex-1 truncate">{nomeGrupo(g.key)}</span>
                    {g.proximoPrazo && <span className="text-xs text-muted-foreground">prazo {fmtPrazo(g.proximoPrazo)}</span>}
                    <span className="text-xs text-muted-foreground">{g.feitas}/{g.total}</span>
                    <span className={cn("font-semibold tabular-nums w-20 text-right", g.pendentes ? s.text : "text-success")}>
                      {g.pendentes ? `${g.pendentes} em falta` : "feito"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Secao>

          {/* 4. PEDIDOS AO CLIENTE */}
          <Secao titulo="Pedidos ao cliente" icon={Hourglass}>
            <div className="grid grid-cols-3 gap-3">
              <Numero valor={pedAbertos.length} label="Em aberto"
                onClick={() => abrir({ titulo: "Pedidos ao cliente em aberto", descricao: "Do mais antigo para o mais recente.", linhas: linhasPedidos(pedAbertos) })} />
              <Numero valor={pedAtrasados.length} label="Há mais de 5 dias" tom={pedAtrasados.length ? "destructive" : "success"}
                onClick={() => abrir({ titulo: "Pedidos há mais de 5 dias", linhas: linhasPedidos(pedAtrasados) })} />
              <Numero valor={new Set(pedAbertos.map((p) => p.client.id)).size} label="Clientes"
                onClick={() => abrir({ titulo: "Pedidos ao cliente em aberto", linhas: linhasPedidos(pedAbertos) })} />
            </div>
            {pedPorResp.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Por responsável</p>
                {pedPorResp.sort((a, b) => nomeCol(a[0]).localeCompare(nomeCol(b[0]), "pt")).map(([k, l]) => {
                  const at = l.filter((p) => p.atrasado).length;
                  return (
                    <button key={k} type="button" onClick={() => abrir({ titulo: `Pedidos em aberto — ${nomeCol(k)}`, linhas: linhasPedidos(l) })}
                      className="w-full flex items-center gap-2 text-sm text-left hover:bg-muted/40 rounded px-1 -mx-1 py-0.5">
                      <span className="font-medium flex-1 truncate">{nomeCol(k)}</span>
                      {at > 0 && <span className="text-xs text-destructive">{at} há mais de 5 dias</span>}
                      <span className="font-semibold tabular-nums w-8 text-right">{l.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Os mais antigos</p>
              {pedAbertos.length === 0 ? <p className="text-sm text-success py-2">Nenhum pedido à espera.</p> : (
                <div className="divide-y">
                  {linhasPedidos(pedAbertos.slice(0, 8)).map((l) => (
                    <button key={l.key} type="button" onClick={l.onClick}
                      className="group w-full flex items-center gap-3 py-1.5 text-sm text-left hover:bg-muted/30 rounded">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium truncate block">{l.titulo}</span>
                        <span className="text-xs text-muted-foreground truncate block">{l.motivo}</span>
                      </span>
                      <span className={cn("text-xs font-semibold tabular-nums", l.tom && TOM_TEXT[l.tom])}>{l.valor}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Secao>

          {/* 5. EQUIPA */}
          <Secao titulo={`Equipa — ${nomeMes(mesAtual)}`} icon={Users} className="xl:col-span-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              <div className="overflow-x-auto lg:col-span-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground text-left">
                      <th className="font-medium py-1">Colaboradora</th>
                      <th className="font-medium py-1 text-right" title="Clientes em carteira no mês (inclui «a sair»)">Clientes</th>
                      <th className="font-medium py-1 text-right">Avença gerida</th>
                      <th className="font-medium py-1 text-right" title="SQ = 3, TI CO = 2, TI RS = 1">Carga</th>
                      <th className="font-medium py-1 text-right">Tarefas abertas</th>
                      <th className="font-medium py-1 text-right">Em atraso</th>
                      <th className="font-medium py-1 text-right">% do mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {equipa.map((l) => {
                      const g = fecho.porResponsavel.find((r) => r.key === l.collaborator.id);
                      const sem = g ? SEMAFORO_CLASSES[g.semaforo] : null;
                      const listaClientes = () => abrir({
                        titulo: `Clientes em carteira — ${l.collaborator.name}`,
                        descricao: `Avença gerida: ${eur(l.avenca)}.`,
                        linhas: [...l.clientes].sort((a, b) => Number(b.mensalidade || 0) - Number(a.mensalidade || 0))
                          .map((c) => linhaCliente(c, { motivo: c.status === "a_sair" ? "A sair" : undefined, valor: eur(Number(c.mensalidade || 0)) })),
                      });
                      return (
                        <tr key={l.collaborator.id}>
                          <td className="py-1.5 font-medium">{l.collaborator.name}</td>
                          <td className="py-1.5 text-right"><Cel onClick={listaClientes}>{l.clientes.length}</Cel></td>
                          <td className="py-1.5 text-right"><Cel onClick={listaClientes}>{eur(l.avenca)}</Cel></td>
                          <td className="py-1.5 text-right">
                            <Cel onClick={() => abrir({
                              titulo: `Carga ponderada — ${l.collaborator.name}`,
                              descricao: `SQ = ${PESO_TIPO.SQ}, TI CO = ${PESO_TIPO["TI CO"]}, TI RS = ${PESO_TIPO["TI RS"]}. Total: ${l.carga}.`,
                              linhas: [...l.clientes].sort((a, b) => pesoCliente(b) - pesoCliente(a)).map((c) => linhaCliente(c, { valor: `${pesoCliente(c)}` })),
                            })}>{l.carga}</Cel>
                          </td>
                          <td className="py-1.5 text-right">
                            <Cel onClick={() => abrir({ titulo: `Tarefas abertas — ${l.collaborator.name}`, linhas: linhasTarefas(l.tarefasAbertas, true) })}>{l.tarefasAbertas.length}</Cel>
                          </td>
                          <td className="py-1.5 text-right">
                            <Cel className={l.tarefasAtraso.length ? "text-destructive" : "text-muted-foreground"}
                              onClick={() => abrir({ titulo: `Tarefas em atraso — ${l.collaborator.name}`, linhas: linhasTarefas(l.tarefasAtraso) })}>{l.tarefasAtraso.length}</Cel>
                          </td>
                          <td className="py-1.5 text-right">
                            {l.pct === null ? <span className="text-muted-foreground">—</span> : (
                              <Cel className={sem?.text} onClick={() => g && abrir({ titulo: `Em falta — ${l.collaborator.name}`, linhas: linhasEmFalta(g.emFalta) })}>
                                <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", sem?.dot)} />{l.pct}%
                              </Cel>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t text-xs text-muted-foreground">
                      <td className="py-1.5 font-medium">Total</td>
                      <td className="py-1.5 text-right tabular-nums">{totEquipa.clientes}</td>
                      <td className="py-1.5 text-right tabular-nums">{eur(totEquipa.avenca)}</td>
                      <td className="py-1.5 text-right tabular-nums">{totEquipa.carga}</td>
                      <td className="py-1.5 text-right tabular-nums">{totEquipa.abertas}</td>
                      <td className="py-1.5 text-right tabular-nums">{totEquipa.atraso}</td>
                      <td className="py-1.5 text-right tabular-nums">{totalFecho.pct}%</td>
                    </tr>
                  </tfoot>
                </table>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Clientes e avenças com as regras da página «Negócio» (inclui clientes a sair; não inclui contratos que só começam depois deste mês). Clientes sem responsável não entram nesta tabela.
                </p>
              </div>
              <button type="button"
                onClick={() => abrir({
                  titulo: "Passagem de clientes",
                  descricao: `Clientes que passaram de ${PASSAGEM.deNome} para outra colaboradora desde ${fmtData(PASSAGEM.desde)} (registo de alterações). Meta: ${passagem.meta} até ${fmtData(passagem.ate)}.`,
                  linhas: passagem.feitos.map((f) => ({
                    key: f.clientId, titulo: f.nome, sub: `para ${f.para}`, valor: fmtData(f.em),
                    onClick: clientById.has(f.clientId) ? irPara(() => onOpenClient(f.clientId)) : undefined,
                  })),
                })}
                className="w-full text-left rounded-lg border bg-background px-4 py-3 hover:bg-muted/40">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{passagem.feitos.length}</span>
                  <span className="text-sm text-muted-foreground">de {passagem.meta} até {fmtData(passagem.ate)}</span>
                </div>
                <p className="text-sm font-medium">Passagem de clientes</p>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full", passPct >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${passPct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {passagem.feitos.length >= passagem.meta ? "Meta atingida" : `Faltam ${passagem.meta - passagem.feitos.length} · ${Math.max(0, passagem.diasRestantes)} dias`}
                  {adminCol && ` · ${clients.filter((c) => c.responsavel_id === adminCol.id && c.status === "ativo").length} clientes ativos ainda com ${adminCol.name.split(" ")[0]}`}
                </p>
              </button>
            </div>
          </Secao>
        </div>
      )}

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe?.titulo} <span className="text-muted-foreground font-normal">({detalhe?.linhas.length ?? 0})</span></DialogTitle>
            {detalhe?.descricao && <DialogDescription>{detalhe.descricao}</DialogDescription>}
          </DialogHeader>
          {detalhe && detalhe.linhas.length === 0 ? <p className="text-sm text-success text-center py-6">Nada a mostrar.</p> : (
            <div className="divide-y -mx-2">
              {detalhe?.linhas.map((l) => (
                <button key={l.key} type="button" onClick={l.onClick} disabled={!l.onClick}
                  className="group w-full flex items-center gap-3 px-2 py-2 text-sm text-left hover:bg-muted/40 disabled:hover:bg-transparent rounded">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium truncate block">{l.titulo}</span>
                    {(l.sub || l.motivo) && (
                      <span className="text-xs text-muted-foreground truncate block">{[l.sub, l.motivo].filter(Boolean).join(" · ")}</span>
                    )}
                  </span>
                  {l.valor && <span className={cn("text-xs tabular-nums font-semibold shrink-0", l.tom && TOM_TEXT[l.tom])}>{l.valor}</span>}
                  {l.onClick && <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ControloView;
