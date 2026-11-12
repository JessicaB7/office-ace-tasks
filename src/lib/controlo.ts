/** Página «Controlo» da admin — regras puras (sem side effects, testáveis).
 *
 * 1. Trabalho do mês: reaproveita `computeFecho` (fechoMes.ts) e acrescenta os próximos prazos.
 * 2. Clientes em risco: dívida AT/SS, pedidos ao cliente há mais de 5 dias, tarefas em atraso, em saída.
 * 3. Equipa: clientes em carteira, avença gerida, carga ponderada, tarefas abertas/em atraso, % do mês;
 *    passagem de clientes.
 * O dinheiro (avenças, entradas/saídas, médias) está em `carteira.ts` (página «Negócio»).
 */

import { obrigacoesForClient, isObrigacaoDone, type ObrigacaoTask } from "./obrigacoesControlo.ts";
import { ativoNoMes } from "./clientSaida.ts";
import { defaultDayResolver, type DayResolver } from "./deadlineOverrides.ts";
import { diasAte, type FechoResultado } from "./fechoMes.ts";
import { temPedido, pedidoAtrasado, diasAEspera } from "./pedidosCliente.ts";
import { contaNoMes, mensalidadeNoMes, type AlteracaoMensalidade } from "./carteira.ts";

export { shiftMes, mesDe } from "./carteira.ts";

// ---------------------------------------------------------------- utilitários

/** "YYYY-MM" de uma data/mês. */
const ym = (s: string) => s.slice(0, 7);

// ---------------------------------------------------------------- tipos (só os campos usados)

export interface ClienteCtl {
  id: string;
  name: string;
  active?: boolean | null;
  status?: string | null;
  tipo_contabilidade?: string | null;
  mensalidade?: number | string | null;
  responsavel_id?: string | null;
  divida_at?: string | null;
  divida_ss?: string | null;
  inicio_contrato?: string | null;
  ultimo_mes_responsabilidade?: string | null;
  [k: string]: unknown;
}
export interface TarefaCtl {
  id: string;
  title?: string | null;
  status?: string | null;
  due_date?: string | null;
  client_id?: string | null;
  collaborator_id?: string | null;
}
export interface PedidoCtl {
  id: string;
  client_id: string;
  obligation_type: string;
  reference_month?: string | null;
  status?: string | null;
  pedido_cliente_em?: string | null;
  pedido_cliente_nota?: string | null;
}
export interface ObrigacaoLinha {
  client_id: string;
  obligation_type: string;
  reference_month: string;
  status?: string | null;
  extra_done?: boolean | null;
  [k: string]: unknown;
}
export interface AuditCtl {
  registo_id: string;
  registo_nome?: string | null;
  campo: string;
  valor_antigo?: string | null;
  valor_novo?: string | null;
  alterado_em: string;
}
export interface ColabCtl {
  id: string;
  name: string;
  active?: boolean | null;
}

// ---------------------------------------------------------------- 1. Trabalho do mês

/** Obrigação pendente com o mês de referência a que pertence ("YYYY-MM-01"). */
export type PrazoTask = ObrigacaoTask & { month: string };

export interface PrazoProximo {
  deadline: string;
  /** Tipos de obrigação com pendentes nesse dia (sem repetições). */
  labels: string[];
  /** Clientes que ainda têm pelo menos uma obrigação pendente nesse prazo. */
  clientes: { client: ClienteCtl; tasks: PrazoTask[] }[];
}

/**
 * Próximos `n` prazos legais (hoje incluído) com obrigações por fazer.
 * Os prazos de um mês vêm de vários meses de referência (ex.: IVA trimestral de setembro vence a 20/11),
 * por isso recebe vários meses e junta tudo. Os prazos incluem as prorrogações (`dayFor`).
 */
export function proximosPrazos(
  clients: ClienteCtl[],
  obligations: ObrigacaoLinha[],
  months: string[],
  today: string,
  dayFor: DayResolver = defaultDayResolver,
  n = 3,
): PrazoProximo[] {
  const byKey = new Map<string, ObrigacaoLinha>();
  obligations.forEach((o) => byKey.set(`${ym(String(o.reference_month))}|${o.client_id}|${o.obligation_type}`, o));

  const porDia = new Map<string, Map<string, { client: ClienteCtl; tasks: PrazoTask[] }>>();
  for (const month of months) {
    for (const c of clients) {
      if (!ativoNoMes(c, month)) continue;
      for (const t of obrigacoesForClient(c, month, dayFor)) {
        if (t.deadline < today) continue;
        if (isObrigacaoDone(t, byKey.get(`${ym(month)}|${c.id}|${t.type}`))) continue;
        if (!porDia.has(t.deadline)) porDia.set(t.deadline, new Map());
        const dia = porDia.get(t.deadline)!;
        if (!dia.has(c.id)) dia.set(c.id, { client: c, tasks: [] });
        dia.get(c.id)!.tasks.push({ ...t, month });
      }
    }
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, n)
    .map(([deadline, m]) => {
      const clientes = [...m.values()].sort((a, b) => String(a.client.name).localeCompare(String(b.client.name), "pt"));
      const labels = [...new Set(clientes.flatMap((c) => c.tasks.map((t) => t.label)))];
      return { deadline, labels, clientes };
    });
}

// ---------------------------------------------------------------- 2. Clientes em risco

/** Tarefa em aberto com prazo antes de hoje. */
export const tarefaEmAtraso = (t: { status?: string | null; due_date?: string | null }, today: string): boolean =>
  !!t.due_date && t.status !== "concluida" && t.status !== "cancelada" && String(t.due_date).slice(0, 10) < today;

export const temDivida = (v: string | null | undefined) => v === "com_divida";

/**
 * Pontuação de risco (quanto maior, mais grave):
 * - dívida à AT: 3 · dívida à SS: 3;
 * - pedidos ao cliente com mais de 5 dias: 2 por pedido (máx. 6);
 * - tarefas em atraso: 1 por tarefa (máx. 4), +1 se alguma tiver mais de 30 dias de atraso;
 * - cliente em saída: 2.
 * Empates: mais motivos, depois mais dias de espera/atraso, depois o nome.
 */
export const RISCO_PONTOS = {
  dividaAT: 3,
  dividaSS: 3,
  porPedido: 2,
  maxPedidos: 6,
  porTarefa: 1,
  maxTarefas: 4,
  tarefaMuitoAtrasada: 1,
  diasMuitoAtrasada: 30,
  emSaida: 2,
} as const;

export type MotivoRisco = "divida_at" | "divida_ss" | "pedidos" | "tarefas" | "saida";

export interface RiscoCliente {
  client: ClienteCtl;
  pontos: number;
  dividaAT: boolean;
  dividaSS: boolean;
  /** Pedidos ao cliente à espera há mais de 5 dias. */
  pedidos: { obl: PedidoCtl; dias: number }[];
  tarefas: { task: TarefaCtl; dias: number }[];
  emSaida: boolean;
  motivos: { tipo: MotivoRisco; texto: string }[];
  /** Maior nº de dias de espera (pedidos) ou de atraso (tarefas). */
  maxDias: number;
}

export interface RiscoResultado {
  /** Todos os clientes com pelo menos um motivo, do mais grave para o menos grave. */
  clientes: RiscoCliente[];
  porMotivo: Record<MotivoRisco, RiscoCliente[]>;
}

export function calcularRisco(clients: ClienteCtl[], tasks: TarefaCtl[], pedidos: PedidoCtl[], today: string): RiscoResultado {
  const hoje = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)), 12);
  const pedidosPorCliente = new Map<string, { obl: PedidoCtl; dias: number }[]>();
  pedidos.forEach((o) => {
    if (!temPedido(o) || !pedidoAtrasado(o.pedido_cliente_em, hoje)) return;
    const l = pedidosPorCliente.get(o.client_id) ?? [];
    l.push({ obl: o, dias: diasAEspera(o.pedido_cliente_em, hoje) });
    pedidosPorCliente.set(o.client_id, l);
  });
  const tarefasPorCliente = new Map<string, { task: TarefaCtl; dias: number }[]>();
  tasks.forEach((t) => {
    if (!t.client_id || !tarefaEmAtraso(t, today)) return;
    const l = tarefasPorCliente.get(t.client_id) ?? [];
    l.push({ task: t, dias: diasAte(String(t.due_date).slice(0, 10), today) });
    tarefasPorCliente.set(t.client_id, l);
  });

  const P = RISCO_PONTOS;
  const out: RiscoCliente[] = [];
  for (const c of clients) {
    if (!c.active) continue;
    const dividaAT = temDivida(c.divida_at);
    const dividaSS = temDivida(c.divida_ss);
    const ped = (pedidosPorCliente.get(c.id) ?? []).sort((a, b) => b.dias - a.dias);
    const tar = (tarefasPorCliente.get(c.id) ?? []).sort((a, b) => b.dias - a.dias);
    const emSaida = c.status === "a_sair";
    const motivos: RiscoCliente["motivos"] = [];
    if (dividaAT) motivos.push({ tipo: "divida_at", texto: "Dívida à AT" });
    if (dividaSS) motivos.push({ tipo: "divida_ss", texto: "Dívida à SS" });
    if (ped.length) motivos.push({ tipo: "pedidos", texto: `${ped.length} ${ped.length === 1 ? "pedido" : "pedidos"} à espera (${ped[0].dias} dias)` });
    if (tar.length) motivos.push({ tipo: "tarefas", texto: `${tar.length} ${tar.length === 1 ? "tarefa" : "tarefas"} em atraso (${tar[0].dias} dias)` });
    if (emSaida) motivos.push({ tipo: "saida", texto: "Em saída" });
    if (!motivos.length) continue;
    const pontos =
      (dividaAT ? P.dividaAT : 0) +
      (dividaSS ? P.dividaSS : 0) +
      Math.min(ped.length * P.porPedido, P.maxPedidos) +
      Math.min(tar.length * P.porTarefa, P.maxTarefas) +
      (tar.some((t) => t.dias > P.diasMuitoAtrasada) ? P.tarefaMuitoAtrasada : 0) +
      (emSaida ? P.emSaida : 0);
    const maxDias = Math.max(0, ...ped.map((p) => p.dias), ...tar.map((t) => t.dias));
    out.push({ client: c, pontos, dividaAT, dividaSS, pedidos: ped, tarefas: tar, emSaida, motivos, maxDias });
  }
  out.sort((a, b) =>
    b.pontos - a.pontos ||
    b.motivos.length - a.motivos.length ||
    b.maxDias - a.maxDias ||
    String(a.client.name).localeCompare(String(b.client.name), "pt"));

  return {
    clientes: out,
    porMotivo: {
      divida_at: out.filter((r) => r.dividaAT),
      divida_ss: out.filter((r) => r.dividaSS),
      pedidos: out.filter((r) => r.pedidos.length > 0),
      tarefas: out.filter((r) => r.tarefas.length > 0),
      saida: out.filter((r) => r.emSaida),
    },
  };
}

// ---------------------------------------------------------------- 3. Equipa

/** Peso de cada tipo de contabilidade na carga de trabalho. */
export const PESO_TIPO: Record<string, number> = { SQ: 3, "TI CO": 2, "TI RS": 1 };
export const pesoCliente = (c: ClienteCtl) => PESO_TIPO[c.tipo_contabilidade ?? ""] ?? 0;

export interface EquipaLinha {
  collaborator: ColabCtl;
  /** Clientes em carteira no mês (mesma regra das avenças: `contaNoMes`, inclui «a sair»). */
  clientes: ClienteCtl[];
  /** Soma das avenças desses clientes (soma com o total de «Avenças mensais» da página Negócio). */
  avenca: number;
  carga: number;
  tarefasAbertas: TarefaCtl[];
  tarefasAtraso: TarefaCtl[];
  /** % do mês concluída (fecho do mês de referência); null se não tem obrigações. */
  pct: number | null;
  feitas: number;
  total: number;
}

/** Tarefa ainda em aberto (nem concluída nem cancelada). */
export const tarefaAberta = (t: { status?: string | null }) => t.status !== "concluida" && t.status !== "cancelada";

/**
 * Tabela única da equipa. `clients` deve vir de `comUltimoMes` (carteira.ts); `tasks` são as tarefas em aberto;
 * `month` é o mês corrente.
 */
export function calcularEquipa(
  collaborators: ColabCtl[],
  clients: ClienteCtl[],
  tasks: TarefaCtl[],
  fecho: FechoResultado,
  today: string,
  month: string,
  audit: AlteracaoMensalidade[] = [],
): EquipaLinha[] {
  return collaborators
    .filter((col) => col.active !== false)
    .map((col) => {
      const clientes = clients.filter((c) => c.responsavel_id === col.id && contaNoMes(c, month));
      const g = fecho.porResponsavel.find((r) => r.key === col.id);
      const abertas = tasks.filter((t) => t.collaborator_id === col.id && tarefaAberta(t));
      return {
        collaborator: col,
        clientes,
        avenca: clientes.reduce((s, c) => s + mensalidadeNoMes(c, month, audit), 0),
        carga: clientes.reduce((s, c) => s + pesoCliente(c), 0),
        tarefasAbertas: abertas,
        tarefasAtraso: abertas.filter((t) => tarefaEmAtraso(t, today)),
        pct: g && g.total > 0 ? g.pct : null,
        feitas: g?.feitas ?? 0,
        total: g?.total ?? 0,
      };
    })
    .filter((l) => l.clientes.length > 0 || l.tarefasAbertas.length > 0 || l.total > 0)
    .sort((a, b) => b.carga - a.carga || String(a.collaborator.name).localeCompare(String(b.collaborator.name), "pt"));
}

/**
 * Passagem de clientes (interpretação a confirmar com a admin): clientes cuja responsável passou de
 * `deNome` para outra pessoa desde `desde` (registo de alterações, campo responsavel_id) e que
 * continuam fora de `deNome`. Meta `meta` até `ate`. Mudar aqui se a regra mudar.
 */
export const PASSAGEM = { meta: 25, desde: "2026-11-01", ate: "2026-12-31", deNome: "Jéssica Brandão" } as const;

export interface PassagemResultado {
  feitos: { clientId: string; nome: string; para: string; em: string }[];
  meta: number;
  ate: string;
  /** Dias até ao fim do prazo (negativo se já passou). */
  diasRestantes: number;
}

export function calcularPassagem(
  audit: AuditCtl[],
  clients: ClienteCtl[],
  deCollaboratorId: string | null,
  today: string,
  cfg: { meta: number; desde: string; ate: string; deNome: string } = PASSAGEM,
): PassagemResultado {
  const ultima = new Map<string, AuditCtl>();
  audit
    .filter((a) => a.campo === "responsavel_id" && a.valor_antigo === cfg.deNome && a.valor_novo && a.valor_novo !== cfg.deNome)
    .filter((a) => String(a.alterado_em).slice(0, 10) >= cfg.desde && String(a.alterado_em).slice(0, 10) <= cfg.ate)
    .forEach((a) => {
      const prev = ultima.get(a.registo_id);
      if (!prev || a.alterado_em > prev.alterado_em) ultima.set(a.registo_id, a);
    });
  const byId = new Map(clients.map((c) => [c.id, c]));
  const feitos = [...ultima.values()]
    .filter((a) => {
      const c = byId.get(a.registo_id);
      // Cliente apagado conta (a passagem aconteceu); se voltou para a admin, não conta.
      return !c || !deCollaboratorId || c.responsavel_id !== deCollaboratorId;
    })
    .map((a) => ({ clientId: a.registo_id, nome: byId.get(a.registo_id)?.name ?? a.registo_nome ?? "—", para: a.valor_novo, em: String(a.alterado_em).slice(0, 10) }))
    .sort((a, b) => b.em.localeCompare(a.em));
  return { feitos, meta: cfg.meta, ate: cfg.ate, diasRestantes: diasAte(today, cfg.ate) };
}
