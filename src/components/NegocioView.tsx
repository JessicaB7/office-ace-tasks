import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Euro, LineChart as LineChartIcon, PieChart, RefreshCw, TrendingDown, UserMinus, UserPlus } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useControloAudit, useControloClients, useControloCollaborators } from "@/hooks/useControlo";
import { useOffboardings } from "@/hooks/useOffboardings";
import { todayYmd } from "@/lib/obrigacoesControlo";
import {
  calcularCarteira,
  comUltimoMes,
  estadoCarteira,
  evolucaoAnual,
  inativosSemData,
  mesDe,
  shiftMes,
  type ClienteCarteira,
} from "@/lib/carteira";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const nomeMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1];
const eur = (v: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
const eurSinal = (v: number) => (v > 0 ? `+${eur(v)}` : eur(v));
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const fmtMesAno = (d: string) => `${MESES_CURTOS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const TIPO_LABEL: Record<string, string> = { SQ: "Empresas (SQ)", "TI CO": "TI Contabilidade Organizada", "TI RS": "TI Regime Simplificado" };

const NADA: never[] = [];

type Tom = "success" | "destructive" | "muted";
const TOM_TEXT: Record<Tom, string> = { success: "text-success", destructive: "text-destructive", muted: "text-muted-foreground" };

interface Linha { key: string; titulo: string; sub?: string; valor?: string; tom?: Tom; clientId?: string; tab?: string }
interface Detalhe { titulo: string; descricao?: string; linhas: Linha[] }

interface Props {
  onOpenClient: (clientId: string, tab?: string) => void;
}

const Cartao = ({ titulo, icon: Icon, children, className, extra }: { titulo: string; icon: typeof Euro; children: ReactNode; className?: string; extra?: ReactNode }) => (
  <section className={cn("bg-card rounded-xl border p-5 space-y-3", className)}>
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary" />
      <h3 className="font-semibold">{titulo}</h3>
      {extra && <span className="ml-auto text-xs text-muted-foreground">{extra}</span>}
    </div>
    {children}
  </section>
);

const Kpi = ({ label, valor, sub, tom, onClick }: { label: string; valor: ReactNode; sub?: ReactNode; tom?: Tom; onClick?: () => void }) => (
  <button type="button" onClick={onClick} disabled={!onClick}
    className="group text-left rounded-xl border bg-card p-5 hover:bg-muted/40 disabled:hover:bg-card transition-colors min-w-0">
    <div className="flex items-center">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {onClick && <ArrowUpRight className="w-4 h-4 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100" />}
    </div>
    <p className={cn("mt-2 text-2xl font-semibold tabular-nums", tom && TOM_TEXT[tom])}>{valor}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </button>
);

/** Página «Negócio» (admin): carteira e avenças. Números de src/lib/carteira.ts (os mesmos da Equipa no «Controlo»). */
const NegocioView = ({ onOpenClient }: Props) => {
  const today = todayYmd();
  const mesAtual = mesDe(today);
  const [mes, setMes] = useState(mesAtual);
  const ano = Number(mes.slice(0, 4));
  const anterior = shiftMes(mes, -1);
  const auditDesde = `${ano}-01-01` < anterior ? `${ano}-01-01` : anterior;

  const qClients = useControloClients();
  const qCollabs = useControloCollaborators();
  const qAudit = useControloAudit(auditDesde);
  const qSaidas = useOffboardings();
  const queries = [qClients, qCollabs, qAudit, qSaidas];
  const loading = queries.some((q) => q.isLoading);
  const fetching = queries.some((q) => q.isFetching);
  const erro = queries.find((q) => q.error)?.error as Error | undefined;

  const clients = qClients.data ?? NADA;
  const collaborators = qCollabs.data ?? NADA;
  const auditMens = useMemo(() => (qAudit.data ?? NADA).filter((a) => a.campo === "mensalidade"), [qAudit.data]);
  const carteira = useMemo(() => comUltimoMes(clients, qSaidas.data ?? NADA), [clients, qSaidas.data]);

  const m = useMemo(() => calcularCarteira(carteira, auditMens, mes), [carteira, auditMens, mes]);
  const evol = useMemo(
    () => evolucaoAnual(carteira, auditMens, ano, mesAtual).map((p) => ({ ...p, name: MESES_CURTOS[Number(p.mes.slice(5, 7)) - 1] })),
    [carteira, auditMens, ano, mesAtual],
  );
  const estado = useMemo(() => estadoCarteira(carteira), [carteira]);
  const semData = useMemo(() => inativosSemData(carteira), [carteira]);

  const nomeCol = (id?: string | null) => collaborators.find((c) => c.id === id)?.name || "Sem responsável";
  const subCliente = (c: ClienteCarteira) => [nomeCol(c.responsavel_id), c.tipo_contabilidade].filter(Boolean).join(" · ");
  const linhaCliente = (c: ClienteCarteira, extra: Partial<Linha> = {}): Linha => ({
    key: c.id, titulo: c.name, sub: subCliente(c), valor: eur(m.valor(c)), clientId: c.id, ...extra,
  });
  const porValor = <T extends ClienteCarteira>(l: T[], asc = false) => [...l].sort((a, b) => (asc ? 1 : -1) * (m.valor(a) - m.valor(b)));

  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const alteracoesTotal = m.alteracoes.reduce((s, a) => s + a.depois - a.antes, 0);
  const totalTipos = m.total || 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Negócio</h2>
          <p className="text-sm text-muted-foreground mt-1">Carteira de clientes e avenças. A equipa, as obrigações e as tarefas estão no «Controlo».</p>
        </div>
        <div className="flex items-center gap-3 mr-10">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <RefreshCw className={cn("w-3.5 h-3.5", fetching && "animate-spin")} />
            {fetching ? "A atualizar…" : `Atualizado ao abrir · ${fmtData(today)}`}
          </span>
          <div className="flex items-center gap-1 bg-card rounded-lg border px-2 py-1">
            <button type="button" onClick={() => setMes(shiftMes(mes, -1))} className="p-1 hover:bg-muted rounded" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium min-w-[130px] text-center capitalize">{nomeMes(mes)} {ano}</span>
            <button type="button" onClick={() => setMes(shiftMes(mes, 1))} disabled={mes >= mesAtual} className="p-1 hover:bg-muted rounded disabled:opacity-30" aria-label="Mês seguinte"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">Erro ao carregar dados: {erro.message}</p>}

      {loading ? <p className="text-center py-12 text-muted-foreground">A carregar...</p> : (
        <>
          {/* KPIs do mês */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Avenças mensais" valor={eur(m.total)} sub={`${m.clientes.length} clientes em carteira em ${nomeMes(mes)}`}
              onClick={() => setDetalhe({ titulo: `Avenças de ${nomeMes(mes)} ${ano}`, descricao: `Total ${eur(m.total)}.`, linhas: porValor(m.clientes).map((c) => linhaCliente(c, c.status === "a_sair" ? { sub: `${subCliente(c)} · a sair` } : {})) })} />
            <Kpi label={`Variação face a ${nomeMes(anterior)}`} valor={eurSinal(m.variacao)} tom={m.variacao > 0 ? "success" : m.variacao < 0 ? "destructive" : "muted"}
              sub={`${eur(m.totalAnterior)} → ${eur(m.total)}`}
              onClick={() => setDetalhe({
                titulo: "Variação das avenças",
                descricao: `Entradas ${eurSinal(m.ganho)} · saídas ${eurSinal(-m.perdido)} · alterações de mensalidade ${eurSinal(alteracoesTotal)}.`,
                linhas: [
                  ...m.entradas.map((c) => linhaCliente(c, { key: `e${c.id}`, sub: `Entrada · ${subCliente(c)}`, valor: eurSinal(m.valor(c)), tom: "success" as Tom })),
                  ...m.saidas.map((s) => linhaCliente(s.client, { key: `s${s.client.id}`, sub: `Saída · ${subCliente(s.client)}`, valor: eurSinal(-s.valor), tom: "destructive" as Tom, tab: "saida" })),
                  ...m.alteracoes.map((a) => linhaCliente(a.client, { key: `a${a.client.id}`, sub: `Mensalidade ${eur(a.antes)} → ${eur(a.depois)}`, valor: eurSinal(a.depois - a.antes), tom: (a.depois > a.antes ? "success" : "destructive") as Tom })),
                ],
              })} />
            <Kpi label="Entradas" valor={m.entradas.length} tom={m.entradas.length ? "success" : undefined} sub={`${eurSinal(m.ganho)} / mês ganhos`} />
            <Kpi label="Saídas" valor={m.saidas.length} tom={m.saidas.length ? "destructive" : undefined} sub={`${eurSinal(-m.perdido)} / mês perdidos`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Carteira por tipo + avença média */}
            <Cartao titulo={`Carteira por tipo — ${nomeMes(mes)}`} icon={PieChart} className="lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground text-left">
                      <th className="font-medium py-1">Tipo</th>
                      <th className="font-medium py-1 text-right">Clientes</th>
                      <th className="font-medium py-1 text-right">Avenças</th>
                      <th className="font-medium py-1 w-28 pl-3">Peso</th>
                      <th className="font-medium py-1 text-right">Avença média</th>
                      <th className="font-medium py-1 text-right">Abaixo da média</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {m.porTipo.map((t) => {
                      const pct = Math.round((t.valor / totalTipos) * 100);
                      return (
                        <tr key={t.tipo}>
                          <td className="py-1.5 font-medium">{TIPO_LABEL[t.tipo] ?? t.tipo}</td>
                          <td className="py-1.5 text-right tabular-nums">{t.clientes.length}</td>
                          <td className="py-1.5 text-right tabular-nums">{eur(t.valor)}</td>
                          <td className="py-1.5 pl-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                              <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-semibold">{t.n ? eur(t.media) : "—"}</td>
                          <td className="py-1.5 text-right">
                            <button type="button" disabled={!t.abaixo.length}
                              className={cn("tabular-nums text-xs font-semibold hover:underline underline-offset-2 disabled:no-underline", t.abaixo.length ? "text-warning" : "text-muted-foreground")}
                              onClick={() => setDetalhe({
                                titulo: `${TIPO_LABEL[t.tipo] ?? t.tipo} abaixo da média`,
                                descricao: `Média ${eur(t.media)} (${t.n} clientes com avença).`,
                                linhas: porValor(t.abaixo, true).map((c) => linhaCliente(c)),
                              })}>{t.abaixo.length}</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td className="py-1.5 font-semibold">Total</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{m.clientes.length}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{eur(m.total)}</td>
                      <td />
                      <td className="py-1.5 text-right tabular-nums font-semibold">{eur(m.media)}</td>
                      <td className="py-1.5 text-right">
                        <button type="button" className="tabular-nums text-xs font-semibold text-warning hover:underline underline-offset-2"
                          onClick={() => setDetalhe({ titulo: "Clientes abaixo da avença média geral", descricao: `Média geral ${eur(m.media)}.`, linhas: porValor(m.abaixoMedia, true).map((c) => linhaCliente(c)) })}>
                          {m.abaixoMedia.length}
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">A avença média conta só os clientes com avença maior que zero.</p>
            </Cartao>

            {/* Estado da carteira (hoje) */}
            <Cartao titulo="Estado da carteira" icon={Euro} extra="hoje, pela ficha">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span className="text-muted-foreground">Ativos</span><span className="font-medium tabular-nums">{estado.ativos.length}</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">A sair</span><span className="font-medium tabular-nums text-destructive">{estado.aSair.length}</span></li>
                <li className="flex justify-between"><span className="text-muted-foreground">Inativos</span><span className="font-medium tabular-nums">{estado.inativos.length}</span></li>
              </ul>
              {semData.length > 0 && (
                <button type="button" className="text-left text-[11px] text-muted-foreground hover:underline underline-offset-2"
                  onClick={() => setDetalhe({
                    titulo: "Inativos sem data de saída",
                    descricao: "Sem «último mês de responsabilidade» nem processo de saída: não contam como saída em nenhum mês. Preenche o último mês na ficha (separador Saída) para entrarem nas contas.",
                    linhas: [...semData].sort((a, b) => a.name.localeCompare(b.name, "pt")).map((c) => linhaCliente(c, { valor: eur(Number(c.mensalidade || 0)), tab: "saida" })),
                  })}>
                  {semData.length} inativos sem último mês de responsabilidade — não entram nas saídas.
                </button>
              )}
            </Cartao>
          </div>

          {/* Entradas e saídas do mês */}
          <div className="grid gap-5 md:grid-cols-2">
            <Cartao titulo={`Entradas — ${nomeMes(mes)}`} icon={UserPlus} extra={`${m.entradas.length} · ${eurSinal(m.ganho)}/mês`}>
              {m.entradas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum contrato começou neste mês.</p> : (
                <ul className="divide-y">
                  {[...m.entradas].sort((a, b) => String(a.inicio_contrato).localeCompare(String(b.inicio_contrato))).map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => onOpenClient(c.id)} className="w-full flex items-center gap-2 py-1.5 text-sm text-left hover:bg-muted/30 rounded">
                        <span className="min-w-0 flex-1"><span className="font-medium truncate block">{c.name}</span><span className="text-xs text-muted-foreground truncate block">{subCliente(c)} · início {fmtData(String(c.inicio_contrato))}</span></span>
                        <span className="text-xs font-semibold tabular-nums text-success">{eurSinal(m.valor(c))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
            <Cartao titulo={`Saídas — ${nomeMes(mes)}`} icon={UserMinus} extra={`${m.saidas.length} · ${eurSinal(-m.perdido)}/mês`}>
              {m.saidas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum cliente com último mês em {nomeMes(anterior)}.</p> : (
                <ul className="divide-y">
                  {m.saidas.map(({ client: c, valor }) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => onOpenClient(c.id, "saida")} className="w-full flex items-center gap-2 py-1.5 text-sm text-left hover:bg-muted/30 rounded">
                        <span className="min-w-0 flex-1">
                          <span className="font-medium truncate block">{c.name}</span>
                          <span className="text-xs text-muted-foreground truncate block">
                            {subCliente(c)} · último mês {fmtMesAno(String(c.ultimo_mes_responsabilidade))}{c.ultimo_mes_origem === "saida_concluida" ? " (aprox.: conclusão da saída)" : ""}
                          </span>
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-destructive">{eurSinal(-valor)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">Saída em {nomeMes(mes)} = último mês de responsabilidade em {nomeMes(anterior)}.</p>
            </Cartao>
          </div>

          {/* Evolução anual */}
          <Cartao titulo={`Evolução anual — ${ano}`} icon={LineChartIcon}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={evol}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => (name === "avencas" ? [eur(value), "Avenças"] : [value, name === "entradas" ? "Entradas" : "Saídas"])}
                />
                <Legend formatter={(v) => (v === "entradas" ? "Entradas" : v === "saidas" ? "Saídas" : "Avenças (€)")} />
                <Bar yAxisId="left" dataKey="entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="saidas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avencas" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Cartao>

          {/* Clientes a sair */}
          {estado.aSair.length > 0 && (
            <Cartao titulo="Clientes a sair — valor em risco" icon={TrendingDown} extra={`${estado.aSair.length} · ${eur(estado.valorEmRisco)}/mês`} className="border-destructive/30">
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                {[...estado.aSair].sort((a, b) => Number(b.mensalidade || 0) - Number(a.mensalidade || 0)).map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onOpenClient(c.id, "saida")} className="w-full flex items-center gap-2 rounded-lg bg-background border px-3 py-2 text-left hover:bg-muted/40">
                      <span className="min-w-0 flex-1">
                        <span className="truncate block font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground truncate block">
                          {nomeCol(c.responsavel_id)} · {c.ultimo_mes_responsabilidade ? `último mês ${fmtMesAno(String(c.ultimo_mes_responsabilidade))}` : "sem último mês"}
                        </span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">{eur(Number(c.mensalidade || 0))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Cartao>
          )}

          <p className="text-[11px] text-muted-foreground">
            Regras: um cliente está em carteira num mês se o contrato já começou e o mês não passa do último mês de responsabilidade (sem último mês: se não está inativo — inclui os clientes a sair).
            Entrada = início de contrato no mês; saída = último mês de responsabilidade no mês anterior (da ficha ou do processo de saída; sem data, usa-se o mês em que a saída foi concluída — aproximação).
            Mensalidade de meses passados: a atual, salvo alterações registadas depois.
          </p>
        </>
      )}

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe?.titulo} <span className="text-muted-foreground font-normal">({detalhe?.linhas.length ?? 0})</span></DialogTitle>
            {detalhe?.descricao && <DialogDescription>{detalhe.descricao}</DialogDescription>}
          </DialogHeader>
          {detalhe && detalhe.linhas.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nada a mostrar.</p> : (
            <div className="divide-y -mx-2">
              {detalhe?.linhas.map((l) => (
                <button key={l.key} type="button" disabled={!l.clientId}
                  onClick={() => { if (l.clientId) { setDetalhe(null); onOpenClient(l.clientId, l.tab); } }}
                  className="group w-full flex items-center gap-3 px-2 py-2 text-sm text-left hover:bg-muted/40 disabled:hover:bg-transparent rounded">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium truncate block">{l.titulo}</span>
                    {l.sub && <span className="text-xs text-muted-foreground truncate block">{l.sub}</span>}
                  </span>
                  {l.valor && <span className={cn("text-xs tabular-nums font-semibold shrink-0", l.tom && TOM_TEXT[l.tom])}>{l.valor}</span>}
                  {l.clientId && <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NegocioView;
