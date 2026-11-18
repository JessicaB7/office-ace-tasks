import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BadgeEuro, ChevronLeft, ChevronRight, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { todayYmd } from "@/lib/obrigacoesControlo";
import { shiftMes } from "@/lib/carteira";
import { useControloClients, useControloCollaborators } from "@/hooks/useControlo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  aumento,
  estadoDe,
  filtrarLinhas,
  montarLinhas,
  numOuNull,
  preencherEmMassa,
  proximoJaneiro,
  resumir,
  type EstadoAtualizacao,
  type FiltroEstado,
  type LinhaMensalidade,
  type PropostaMensalidade,
} from "@/lib/mensalidadeAtualizacoes";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMesAno = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const eur = (v: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v || 0);
const eurSinal = (v: number) => (v > 0 ? `+${eur(v)}` : eur(v));
const fmtDia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const NADA: never[] = [];

const ESTADO_LABEL: Record<EstadoAtualizacao, string> = { pendente: "Pendente", aceite: "Aceite", recusado: "Recusado", mantem: "Mantém" };
const ESTADO_CLASS: Record<EstadoAtualizacao, string> = {
  pendente: "bg-muted text-muted-foreground",
  aceite: "bg-success/15 text-success",
  recusado: "bg-destructive/15 text-destructive",
  mantem: "bg-success/15 text-success",
};

const inputCls = "py-1.5 px-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

type Patch = { mensalidade_nova?: number | null; mensagem_enviada_em?: string | null; estado?: EstadoAtualizacao; estado_em?: string | null; notas?: string | null };

interface Props {
  onOpenClient: (clientId: string, tab?: string) => void;
}

function usePropostas(aPartirDe: string) {
  return useQuery({
    queryKey: ["mensalidade_atualizacoes", aPartirDe],
    queryFn: async () => {
      const { data, error } = await supabase.from("mensalidade_atualizacoes").select("*").eq("a_partir_de", aPartirDe);
      if (error) throw error;
      return (data ?? []) as PropostaMensalidade[];
    },
  });
}

const Kpi = ({ label, valor, sub, tom }: { label: string; valor: string | number; sub?: string; tom?: "success" | "destructive" }) => (
  <div className="rounded-xl border bg-card p-4 min-w-0">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tom === "success" && "text-success", tom === "destructive" && "text-destructive")}>{valor}</p>
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

/** Campo numérico que grava ao sair. */
function CampoValor({ valor, onSave, disabled }: { valor: number | null; onSave: (v: number | null) => void; disabled?: boolean }) {
  const [txt, setTxt] = useState(valor === null ? "" : String(valor));
  useEffect(() => setTxt(valor === null ? "" : String(valor)), [valor]);
  return (
    <input type="number" step="0.01" min="0" inputMode="decimal" value={txt} disabled={disabled}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => { const v = numOuNull(txt); if (v !== valor) onSave(v); }}
      className={cn(inputCls, "w-24 text-right tabular-nums")} placeholder="—" />
  );
}

function CampoNotas({ valor, onSave }: { valor: string; onSave: (v: string) => void }) {
  const [txt, setTxt] = useState(valor);
  useEffect(() => setTxt(valor), [valor]);
  return (
    <input value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={() => { if (txt !== valor) onSave(txt); }}
      className={cn(inputCls, "w-40")} placeholder="Notas" />
  );
}

/** «Atualização de mensalidades» (admin): proposta de nova mensalidade, envio da mensagem e resposta do cliente. */
const MensalidadesView = ({ onOpenClient }: Props) => {
  const today = todayYmd();
  const qc = useQueryClient();
  const [aPartirDe, setAPartirDe] = useState(() => proximoJaneiro(today));
  const [responsavel, setResponsavel] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("todos");
  const [soPorEnviar, setSoPorEnviar] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const [pct, setPct] = useState("5");
  const [confirmar, setConfirmar] = useState(false);

  const qClients = useControloClients();
  const qCollabs = useControloCollaborators();
  const qProp = usePropostas(aPartirDe);
  const loading = qClients.isLoading || qCollabs.isLoading || qProp.isLoading;
  const erro = (qClients.error || qCollabs.error || qProp.error) as Error | null;

  const collaborators = qCollabs.data ?? NADA;
  const nomeCol = (id?: string | null) => (id ? collaborators.find((c) => c.id === id)?.name || "—" : "Sem responsável");

  const linhas = useMemo(() => montarLinhas(qClients.data ?? NADA, qProp.data ?? NADA, aPartirDe), [qClients.data, qProp.data, aPartirDe]);
  const filtradas = useMemo(
    () => filtrarLinhas(linhas, { responsavel, tipo, estado, soPorEnviar, pesquisa }),
    [linhas, responsavel, tipo, estado, soPorEnviar, pesquisa],
  );
  const resumo = useMemo(() => resumir(linhas), [linhas]);
  const resumoFiltro = useMemo(() => resumir(filtradas), [filtradas]);
  const tipos = useMemo(() => [...new Set(linhas.map((l) => l.client.tipo_contabilidade || ""))].filter(Boolean).sort(), [linhas]);
  const responsaveis = useMemo(() => {
    const ids = [...new Set(linhas.map((l) => l.client.responsavel_id || "none"))];
    return ids.sort((a, b) => (a === "none" ? 1 : b === "none" ? -1 : nomeCol(a).localeCompare(nomeCol(b), "pt")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, collaborators]);
  const preenchimento = useMemo(() => preencherEmMassa(filtradas, Number(String(pct).replace(",", "."))), [filtradas, pct]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["mensalidade_atualizacoes"] });
    qc.invalidateQueries({ queryKey: ["controlo"] });
  };

  const gravar = useMutation({
    mutationFn: async ({ linha, patch }: { linha: LinhaMensalidade; patch: Patch }) => {
      if (linha.proposta) {
        const { error } = await supabase.from("mensalidade_atualizacoes").update(patch).eq("id", linha.proposta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mensalidade_atualizacoes").upsert(
          { client_id: linha.client.id, a_partir_de: aPartirDe, mensalidade_atual: linha.atual, ...patch },
          { onConflict: "client_id,a_partir_de" },
        );
        if (error) throw error;
      }
    },
    onSuccess: (_d, { patch }) => {
      invalidar();
      if (patch.estado === "aceite") {
        toast.success(aPartirDe <= today
          ? "Aceite — a mensalidade da ficha foi atualizada."
          : `Aceite — a mensalidade da ficha muda a ${aPartirDe.slice(8, 10)}/${aPartirDe.slice(5, 7)}/${aPartirDe.slice(0, 4)}.`);
      }
    },
    onError: (e: Error) => toast.error(`Não foi possível gravar: ${e.message}`),
  });
  const salvar = (linha: LinhaMensalidade, patch: Patch) => gravar.mutate({ linha, patch });

  const preencher = useMutation({
    mutationFn: async () => {
      const porId = new Map(filtradas.map((l) => [l.client.id, l]));
      const rows = preenchimento.map((p) => ({
        client_id: p.clientId,
        a_partir_de: aPartirDe,
        mensalidade_atual: porId.get(p.clientId)!.atual,
        mensalidade_nova: p.nova,
      }));
      if (!rows.length) return 0;
      const { error } = await supabase.from("mensalidade_atualizacoes").upsert(rows, { onConflict: "client_id,a_partir_de" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => { invalidar(); toast.success(`${n} mensalidades novas preenchidas.`); },
    onError: (e: Error) => toast.error(`Não foi possível preencher: ${e.message}`),
  });

  const mudarEstado = (l: LinhaMensalidade, novo: EstadoAtualizacao) => {
    if (novo === "aceite" && l.nova === null) { toast.error("Escreve primeiro a mensalidade nova."); return; }
    if (l.proposta?.aplicada_em && novo !== "aceite") {
      toast.warning("A mensalidade da ficha já foi atualizada e não é revertida. Corrige-a na ficha do cliente se for preciso.");
    }
    salvar(l, { estado: novo, estado_em: novo === "pendente" ? null : today, ...(novo === "mantem" ? { mensalidade_nova: null, mensagem_enviada_em: null } : {}) });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><BadgeEuro className="w-6 h-6 text-primary" /> Atualização de mensalidades</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Proposta de nova mensalidade por cliente, envio da mensagem e resposta. Ao marcar «Aceite», a mensalidade da ficha passa para a nova a partir do mês escolhido.
          </p>
        </div>
        <div className="flex items-center gap-2 mr-10">
          <span className="text-xs text-muted-foreground">A partir de</span>
          <div className="flex items-center gap-1 bg-card rounded-lg border px-2 py-1">
            <button type="button" onClick={() => setAPartirDe(shiftMes(aPartirDe, -1))} className="p-1 hover:bg-muted rounded" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium min-w-[130px] text-center capitalize">{nomeMesAno(aPartirDe)}</span>
            <button type="button" onClick={() => setAPartirDe(shiftMes(aPartirDe, 1))} className="p-1 hover:bg-muted rounded" aria-label="Mês seguinte"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">Erro ao carregar dados: {erro.message}</p>}

      {loading ? <p className="text-center py-12 text-muted-foreground">A carregar...</p> : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
            <Kpi label="Com proposta" valor={`${resumo.comProposta} de ${resumo.total}`} sub="clientes ativos" />
            <Kpi label="Mensagens enviadas" valor={`${resumo.enviadas} de ${resumo.comProposta}`} />
            <Kpi label="Aceites" valor={resumo.aceites} tom={resumo.aceites ? "success" : undefined} />
            <Kpi label="Recusados" valor={resumo.recusados} tom={resumo.recusados ? "destructive" : undefined} />
            <Kpi label="Mantêm" valor={resumo.mantem} sub="sem aumento" tom={resumo.mantem ? "success" : undefined} />
            <Kpi label="Aumento se aceitarem" valor={eurSinal(resumo.aumentoPotencial)} sub="por mês, sem as recusadas" />
            <Kpi label="Aumento já aceite" valor={eurSinal(resumo.aumentoAceite)} sub="por mês" tom={resumo.aumentoAceite ? "success" : undefined} />
          </div>

          <div className="bg-card rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} placeholder="Pesquisar cliente ou NIF" className={cn(inputCls, "pl-8 w-56")} />
              </div>
              <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inputCls}>
                <option value="">Todos os responsáveis</option>
                {responsaveis.map((id) => <option key={id} value={id}>{nomeCol(id === "none" ? null : id)}</option>)}
              </select>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                <option value="">Todos os tipos</option>
                {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={estado} onChange={(e) => setEstado(e.target.value as FiltroEstado)} className={inputCls}>
                <option value="todos">Todos os estados</option>
                <option value="sem_proposta">Sem proposta</option>
                <option value="pendente">Pendente</option>
                <option value="aceite">Aceite</option>
                <option value="recusado">Recusado</option>
                <option value="mantem">Mantém</option>
              </select>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={soPorEnviar} onChange={(e) => setSoPorEnviar(e.target.checked)} className="h-4 w-4 accent-primary" />
                Só por enviar
              </label>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Aumento</span>
                <input type="number" step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} className={cn(inputCls, "w-16 text-right")} />
                <span className="text-xs text-muted-foreground">%</span>
                <button type="button" disabled={!preenchimento.length || preencher.isPending} onClick={() => setConfirmar(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                  <Wand2 className="w-4 h-4" /> Preencher nova mensalidade ({preenchimento.length})
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {filtradas.length} clientes na lista · {resumoFiltro.comProposta} com proposta · {resumoFiltro.enviadas} mensagens enviadas ·
              aumento da lista {eurSinal(resumoFiltro.aumentoPotencial)}/mês
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground text-left border-b">
                    <th className="font-medium py-2">Cliente</th>
                    <th className="font-medium py-2">Responsável</th>
                    <th className="font-medium py-2">Tipo</th>
                    <th className="font-medium py-2">Início do contrato</th>
                    <th className="font-medium py-2 text-right">Mensalidade atual</th>
                    <th className="font-medium py-2 text-right">Mensalidade nova</th>
                    <th className="font-medium py-2 text-right">Aumento</th>
                    <th className="font-medium py-2 text-center">Mensagem enviada</th>
                    <th className="font-medium py-2">Estado</th>
                    <th className="font-medium py-2">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtradas.map((l) => {
                    const est = estadoDe(l.proposta);
                    const a = aumento(l.atual, l.nova);
                    const enviada = l.proposta?.mensagem_enviada_em ?? null;
                    const aplicada = l.proposta?.aplicada_em ?? null;
                    return (
                      <tr key={l.client.id} className="align-middle">
                        <td className="py-1.5 pr-2">
                          <button type="button" onClick={() => onOpenClient(l.client.id)} className="group inline-flex items-center gap-1 font-medium text-left hover:underline underline-offset-2">
                            {l.client.name}
                            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          </button>
                        </td>
                        <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">{nomeCol(l.client.responsavel_id)}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">{l.client.tipo_contabilidade || "—"}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap tabular-nums">{l.client.inicio_contrato ? `${l.client.inicio_contrato.slice(8, 10)}/${l.client.inicio_contrato.slice(5, 7)}/${l.client.inicio_contrato.slice(0, 4)}` : "—"}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{eur(l.atual)}</td>
                        <td className="py-1.5 pr-2 text-right">
                          <CampoValor valor={l.nova} disabled={!!aplicada}
                            onSave={(v) => salvar(l, { mensalidade_nova: v, ...((v === null && est === "aceite") || (v !== null && est === "mantem") ? { estado: "pendente", estado_em: null } : {}) })} />
                        </td>
                        <td className={cn("py-1.5 pr-2 text-right tabular-nums whitespace-nowrap", a && a.valor > 0 && "text-success", a && a.valor < 0 && "text-destructive")}>
                          {a ? <>{eurSinal(a.valor)}{a.pct !== null && <span className="text-xs text-muted-foreground"> ({a.pct.toFixed(1).replace(".", ",")}%)</span>}</> : "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-center whitespace-nowrap">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={!!enviada} disabled={l.nova === null && !enviada}
                              onChange={(e) => salvar(l, { mensagem_enviada_em: e.target.checked ? today : null })}
                              className="h-4 w-4 accent-primary" />
                            {enviada && <span className="text-xs text-muted-foreground">{fmtDia(enviada)}</span>}
                          </label>
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          {(
                            <div className="flex items-center gap-2">
                              <select value={l.nova === null && est !== "mantem" ? "" : (est ?? "pendente")} onChange={(e) => e.target.value && mudarEstado(l, e.target.value as EstadoAtualizacao)}
                                className={cn(inputCls, "py-1 text-xs font-medium", est && ESTADO_CLASS[est])}>
                                {l.nova === null && est !== "mantem" && <option value="">Sem proposta</option>}
                                <option value="mantem">{ESTADO_LABEL.mantem}</option>
                                <option value="pendente" disabled={l.nova === null}>{ESTADO_LABEL.pendente}</option>
                                <option value="aceite" disabled={l.nova === null}>{ESTADO_LABEL.aceite}</option>
                                <option value="recusado" disabled={l.nova === null}>{ESTADO_LABEL.recusado}</option>
                              </select>
                              {aplicada
                                ? <span className="text-[11px] text-success">aplicada em {fmtDia(aplicada.slice(0, 10))}</span>
                                : est === "aceite" && <span className="text-[11px] text-muted-foreground">muda a {fmtDia(aPartirDe)}</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5">
                          <CampoNotas valor={l.proposta?.notas ?? ""} onSave={(v) => salvar(l, { notas: v || null })} />
                        </td>
                      </tr>
                    );
                  })}
                  {filtradas.length === 0 && (
                    <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Nenhum cliente com estes filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Só clientes ativos. A mensalidade atual é a da ficha (depois de aplicada, mostra-se a anterior). Aceite com a data já chegada atualiza logo a ficha;
              com data futura, a ficha muda nesse dia (tarefa automática diária). Voltar a «Pendente» ou «Recusado» depois de aplicada não reverte a ficha.
            </p>
          </div>
        </>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Preencher a mensalidade nova?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai preencher {preenchimento.length} clientes da lista atual (só os que ainda não têm mensalidade nova) com +{pct}% sobre a mensalidade atual,
              arredondado ao euro, a partir de {nomeMesAno(aPartirDe)}. Os valores ficam editáveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => preencher.mutate()}>Preencher</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MensalidadesView;
