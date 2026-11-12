/** Carteira de clientes e avenças — UMA só fonte para os números de dinheiro e de clientes
 * (página «Controlo» → Equipa e página «Negócio»). Regras puras, sem side effects.
 *
 * Regras (as mesmas em todo o lado):
 * - **Em carteira no mês M** (`contaNoMes`): o contrato já começou (`inicio_contrato` ≤ M, ou sem data) e
 *   - com último mês de responsabilidade: só até esse mês (mesmo que o cliente já esteja inativo);
 *   - sem último mês: só se ainda não está inativo (ativo ou a sair).
 *   ⇒ inclui os clientes «a sair» (ainda pagam) e exclui contratos que só começam depois de M.
 * - **Último mês de responsabilidade** (`comUltimoMes`): o do cliente; senão o do processo de saída
 *   (`client_offboardings`); senão, se o processo de saída está concluído, o mês da conclusão (aproximação).
 * - **Entrada no mês M**: `inicio_contrato` em M.
 * - **Saída no mês M**: o último mês de responsabilidade é o mês anterior a M (deixa de pagar em M).
 *   Inativos sem último mês nem processo de saída não têm data de saída — não entram em nenhum mês
 *   (contam-se à parte em `inativosSemData` para se poder corrigir a ficha).
 * - **Avença de um cliente no mês M** (`mensalidadeNoMes`): a mensalidade atual, salvo alterações registadas
 *   no registo de alterações depois de M (vale o valor antigo da primeira dessas alterações).
 */

// ---------------------------------------------------------------- utilitários de meses

/** "YYYY-MM" de uma data/mês. */
const ym = (s: string) => s.slice(0, 7);

/** Mês "YYYY-MM-01" deslocado `n` meses. */
export const shiftMes = (month: string, n: number): string => {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

/** Mês corrente "YYYY-MM-01" de um "YYYY-MM-DD". */
export const mesDe = (today: string): string => `${today.slice(0, 7)}-01`;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------- tipos (só os campos usados)

export interface ClienteCarteira {
  id: string;
  name: string;
  active?: boolean | null;
  status?: string | null;
  tipo_contabilidade?: string | null;
  mensalidade?: number | string | null;
  responsavel_id?: string | null;
  inicio_contrato?: string | null;
  ultimo_mes_responsabilidade?: string | null;
  [k: string]: unknown;
}

export interface SaidaCarteira {
  client_id: string;
  ultimo_mes_responsabilidade?: string | null;
  completed_at?: string | null;
}

export interface AlteracaoMensalidade {
  registo_id: string;
  campo: string;
  valor_antigo?: string | null;
  alterado_em: string;
}

export const TIPOS_CLIENTE = ["SQ", "TI CO", "TI RS"] as const;

// ---------------------------------------------------------------- regras base

/** De onde veio o último mês de responsabilidade usado. */
export type OrigemUltimoMes = "cliente" | "saida" | "saida_concluida";

/**
 * Preenche `ultimo_mes_responsabilidade` a partir do processo de saída quando a ficha não o tem.
 * Não altera os objetos recebidos; acrescenta `ultimo_mes_origem` quando há último mês.
 */
export function comUltimoMes<T extends ClienteCarteira>(clients: T[], saidas: SaidaCarteira[] = []): (T & { ultimo_mes_origem?: OrigemUltimoMes })[] {
  const porCliente = new Map(saidas.map((s) => [s.client_id, s]));
  return clients.map((c) => {
    if (c.ultimo_mes_responsabilidade) return { ...c, ultimo_mes_origem: "cliente" as const };
    const s = porCliente.get(c.id);
    if (s?.ultimo_mes_responsabilidade) return { ...c, ultimo_mes_responsabilidade: `${ym(s.ultimo_mes_responsabilidade)}-01`, ultimo_mes_origem: "saida" as const };
    if (s?.completed_at) return { ...c, ultimo_mes_responsabilidade: `${ym(s.completed_at)}-01`, ultimo_mes_origem: "saida_concluida" as const };
    return c;
  });
}

/** O cliente está em carteira (paga avença) no mês `month`? Ver regras no topo do ficheiro. */
export function contaNoMes(c: ClienteCarteira, month: string): boolean {
  if (c.inicio_contrato && ym(c.inicio_contrato) > ym(month)) return false;
  if (c.ultimo_mes_responsabilidade) return ym(month) <= ym(c.ultimo_mes_responsabilidade);
  return !!c.active && c.status !== "inativo";
}

/** Entrou no mês: início de contrato nesse mês. */
export const entraNoMes = (c: ClienteCarteira, month: string): boolean => !!c.inicio_contrato && ym(c.inicio_contrato) === ym(month);

/** Saiu no mês: o último mês de responsabilidade foi o mês anterior. */
export const saiNoMes = (c: ClienteCarteira, month: string): boolean =>
  !!c.ultimo_mes_responsabilidade && ym(c.ultimo_mes_responsabilidade) === ym(shiftMes(month, -1));

/** Inativos sem último mês de responsabilidade (nem processo de saída): a saída não tem data. */
export const inativosSemData = <T extends ClienteCarteira>(clients: T[]): T[] =>
  clients.filter((c) => c.status === "inativo" && !c.ultimo_mes_responsabilidade);

/**
 * Mensalidade em vigor no início de `month`: a atual, salvo se houve alteração registada
 * (audit_log, campo mensalidade) depois disso — então vale o valor antigo da primeira alteração.
 */
export function mensalidadeNoInicioDe(c: ClienteCarteira, month: string, audit: AlteracaoMensalidade[]): number {
  const primeira = audit
    .filter((a) => a.registo_id === c.id && a.campo === "mensalidade" && String(a.alterado_em).slice(0, 10) >= month.slice(0, 10))
    .sort((a, b) => String(a.alterado_em).localeCompare(String(b.alterado_em)))[0];
  return primeira ? num(primeira.valor_antigo) : num(c.mensalidade);
}

/** Avença do cliente no mês `month` (a que estava em vigor no fim desse mês). */
export const mensalidadeNoMes = (c: ClienteCarteira, month: string, audit: AlteracaoMensalidade[] = []): number =>
  mensalidadeNoInicioDe(c, shiftMes(month, 1), audit);

// ---------------------------------------------------------------- resumo de um mês

export interface MediaTipo<T extends ClienteCarteira = ClienteCarteira> {
  tipo: string;
  /** Clientes em carteira deste tipo (todos) e a soma das avenças. */
  clientes: T[];
  valor: number;
  /** Média só dos que têm avença > 0. */
  media: number;
  n: number;
  abaixo: T[];
}

export interface CarteiraMes<T extends ClienteCarteira = ClienteCarteira> {
  mes: string;
  clientes: T[];
  total: number;
  /** Valor de cada cliente no mês (com o registo de alterações). */
  valor: (c: T) => number;
  anterior: string;
  totalAnterior: number;
  variacao: number;
  entradas: T[];
  ganho: number;
  saidas: { client: T; valor: number }[];
  perdido: number;
  /** Mudanças de mensalidade de clientes que contam nos dois meses. */
  alteracoes: { client: T; antes: number; depois: number }[];
  /** Avença média geral (clientes com avença > 0). */
  media: number;
  abaixoMedia: T[];
  porTipo: MediaTipo<T>[];
}

const media = (l: number[]) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : 0);

/** Avenças do mês face ao anterior, entradas/saídas, médias e carteira por tipo. */
export function calcularCarteira<T extends ClienteCarteira>(clients: T[], audit: AlteracaoMensalidade[], month: string): CarteiraMes<T> {
  const anterior = shiftMes(month, -1);
  const valor = (c: T) => mensalidadeNoMes(c, month, audit);
  const valorAnt = (c: T) => mensalidadeNoMes(c, anterior, audit);

  const clientes = clients.filter((c) => contaNoMes(c, month));
  const prev = clients.filter((c) => contaNoMes(c, anterior));
  const total = clientes.reduce((s, c) => s + valor(c), 0);
  const totalAnterior = prev.reduce((s, c) => s + valorAnt(c), 0);

  const entradas = clientes.filter((c) => entraNoMes(c, month));
  const ids = new Set(clientes.map((c) => c.id));
  // Quem contava no mês anterior e já não conta = último mês de responsabilidade foi o anterior.
  const saidas = prev.filter((c) => !ids.has(c.id)).map((c) => ({ client: c, valor: valorAnt(c) }));
  const prevIds = new Set(prev.map((c) => c.id));
  const alteracoes = clientes
    .filter((c) => prevIds.has(c.id) && valorAnt(c) !== valor(c))
    .map((c) => ({ client: c, antes: valorAnt(c), depois: valor(c) }));

  const comAvenca = clientes.filter((c) => valor(c) > 0);
  const mediaGeral = media(comAvenca.map(valor));

  const tipos = [...TIPOS_CLIENTE, ...new Set(clientes.map((c) => c.tipo_contabilidade || "Sem tipo").filter((t) => !(TIPOS_CLIENTE as readonly string[]).includes(t)))];
  const porTipo = tipos
    .map((tipo) => {
      const l = clientes.filter((c) => (c.tipo_contabilidade || "Sem tipo") === tipo);
      const pagos = l.filter((c) => valor(c) > 0);
      const m = media(pagos.map(valor));
      return { tipo, clientes: l, valor: l.reduce((s, c) => s + valor(c), 0), media: m, n: pagos.length, abaixo: pagos.filter((c) => valor(c) < m) };
    })
    .filter((t) => t.clientes.length > 0 || (TIPOS_CLIENTE as readonly string[]).includes(t.tipo));

  return {
    mes: month,
    clientes,
    total,
    valor,
    anterior,
    totalAnterior,
    variacao: total - totalAnterior,
    entradas,
    ganho: entradas.reduce((s, c) => s + valor(c), 0),
    saidas,
    perdido: saidas.reduce((s, x) => s + x.valor, 0),
    alteracoes,
    media: mediaGeral,
    abaixoMedia: comAvenca.filter((c) => valor(c) < mediaGeral),
    porTipo,
  };
}

// ---------------------------------------------------------------- evolução anual

export interface PontoEvolucao {
  mes: string;
  entradas: number;
  saidas: number;
  /** Total das avenças do mês; null nos meses futuros. */
  avencas: number | null;
}

/** Entradas, saídas e avenças dos 12 meses de `year` (meses depois de `mesAtual` sem avenças). */
export function evolucaoAnual(clients: ClienteCarteira[], audit: AlteracaoMensalidade[], year: number, mesAtual: string): PontoEvolucao[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mes = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const futuro = ym(mes) > ym(mesAtual);
    return {
      mes,
      entradas: clients.filter((c) => entraNoMes(c, mes)).length,
      saidas: futuro ? 0 : clients.filter((c) => saiNoMes(c, mes)).length,
      avencas: futuro ? null : Math.round(clients.filter((c) => contaNoMes(c, mes)).reduce((s, c) => s + mensalidadeNoMes(c, mes, audit), 0)),
    };
  });
}

// ---------------------------------------------------------------- estado atual da carteira

export interface EstadoCarteira<T extends ClienteCarteira = ClienteCarteira> {
  ativos: T[];
  aSair: T[];
  inativos: T[];
  /** Soma das avenças dos clientes a sair (valor em risco). */
  valorEmRisco: number;
}

/** Contagem pelo estado da ficha hoje (ativo / a sair / inativo). */
export function estadoCarteira<T extends ClienteCarteira>(clients: T[]): EstadoCarteira<T> {
  const estado = (c: T) => c.status || (c.active === false ? "inativo" : "ativo");
  const aSair = clients.filter((c) => estado(c) === "a_sair");
  return {
    ativos: clients.filter((c) => estado(c) === "ativo"),
    aSair,
    inativos: clients.filter((c) => estado(c) === "inativo"),
    valorEmRisco: aSair.reduce((s, c) => s + num(c.mensalidade), 0),
  };
}
