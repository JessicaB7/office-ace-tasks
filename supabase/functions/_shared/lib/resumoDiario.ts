/** Resumo diário da equipa (email à admin às 19:00 de Lisboa, dias úteis).
 * Lógica pura — usada pela edge function `send-daily-summary` através da cópia em
 * supabase/functions/_shared/lib/resumoDiario.ts (o teste sharedLib.test.ts exige que sejam iguais). */

export interface RDColaborador { id: string; name: string; user_id: string | null; active: boolean }
export interface RDCliente { id: string; name: string }
export interface RDTarefa {
  id: string; title: string; status: string; due_date: string | null;
  collaborator_id: string | null; client_id: string | null; updated_at: string;
  completed_at?: string | null;
}
export interface RDObrigacao {
  client_id: string; obligation_type: string; reference_month: string;
  completed_at: string | null; completed_by: string | null;
}
export interface RDContacto {
  client_id: string; collaborator_id: string | null; created_by: string | null;
  tipo: string; created_at: string;
}

export interface RDGrupoCliente { cliente: string; itens: string[] }
export interface RDLinhaColaborador {
  id: string;
  nome: string;
  tarefas: { titulo: string; cliente?: string }[];
  gestaoMensal: RDGrupoCliente[];
  obrigacoes: RDGrupoCliente[];
  contactos: { cliente: string; tipo: string }[];
  emAtraso: { titulo: string; cliente?: string; prazo: string; hoje: boolean }[];
  totalEmAtraso: number;
  /** Nº de registos do dia (tarefas + células + obrigações + contactos). */
  totalFeito: number;
}
export interface RDResumo {
  dia: string;
  colaboradores: RDLinhaColaborador[];
  totais: { tarefas: number; gestaoMensal: number; obrigacoes: number; contactos: number; emAtraso: number };
}

/** Data "YYYY-MM-DD" de um instante no fuso de Lisboa. */
export const lisbonDay = (d: string | Date): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(typeof d === "string" ? new Date(d) : d);

/** Hora (0–23) de um instante no fuso de Lisboa. */
export const lisbonHour = (d: Date): number =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(d));

/** Segunda a sexta (o resumo não sai ao fim de semana). */
export const isDiaUtil = (ymd: string): boolean => {
  const wd = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return wd >= 1 && wd <= 5;
};

/** Células da Gestão Mensal (Contabilidades): contabilidade_<regime>[_<coluna>]. */
const GESTAO_RE = /^contabilidade_(TI_iva|TI_isento|organizada|empresas)(?:_(.+))?$/;
export const isGestaoMensal = (type: string): boolean => GESTAO_RE.test(type);

const REGIME: Record<string, string> = {
  TI_iva: "TI Reg. IVA", TI_isento: "TI Isento", organizada: "TI Organizada", empresas: "Empresa",
};
const COLUNA: Record<string, string> = { e_fatura: "E-Fatura", iva: "IVA" };

const OBRIGACAO: Record<string, string> = {
  SAFT: "SAFT",
  SAFT_mensagem: "SAFT (mensagem)",
  salarios: "Salários",
  retencao_fonte: "Retenção na fonte",
  DMR_AT: "DMR AT",
  DMR_SS: "DMR SS",
  SS_TI: "SS TI",
  SS_TI_comunicacao: "SS TI (comunicação)",
  SS_TI_DT: "SS declaração trimestral",
  SS_TI_DT_comunicacao: "SS declaração trimestral (comunicação)",
  IVA: "IVA periódica",
  IVA_recapitulativa: "IVA recapitulativa",
  IVA_OSS: "IVA OSS",
  emissao_faturas: "Emissão de faturas",
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Rótulo legível de um obligation_type (Gestão Mensal ou obrigação). */
export function obrigacaoLabel(type: string): string {
  const g = GESTAO_RE.exec(type);
  if (g) {
    const col = g[2] ? COLUNA[g[2]] ?? cap(g[2].replace(/_/g, " ")) : "Contabilidade";
    return `${col} (${REGIME[g[1]]})`;
  }
  if (OBRIGACAO[type]) return OBRIGACAO[type];
  let m = /^IVA_flex_P(\d+)$/.exec(type);
  if (m) return `IVA flexibilizado – parcela ${m[1]}`;
  m = /^emissao_faturas_S(\d+)$/.exec(type);
  if (m) return `Emissão de faturas – semana ${m[1]}`;
  return cap(type.replace(/_/g, " "));
}

/** "nov." a partir de "2026-11-01". */
export const mesCurto = (referenceMonth: string): string => `${MESES[Number(referenceMonth.slice(5, 7)) - 1] ?? "?"}.`;

const fmtDia = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/**
 * Mapa user_id → colaborador. A conta de admin pode não estar ligada a uma ficha de colaborador
 * (ex.: geral@ é usada pela Jéssica, cuja ficha não tem user_id): se houver exatamente uma ficha
 * ativa sem user_id, os registos das contas admin sem ficha são atribuídos a essa pessoa.
 */
export function mapaUtilizadores(collaborators: RDColaborador[], adminUserIds: string[]): Map<string, string> {
  const map = new Map<string, string>();
  collaborators.forEach((c) => { if (c.user_id) map.set(c.user_id, c.id); });
  const semConta = collaborators.filter((c) => c.active && !c.user_id);
  if (semConta.length === 1) adminUserIds.forEach((u) => { if (!map.has(u)) map.set(u, semConta[0].id); });
  return map;
}

const NAO_IDENTIFICADO = "__nao_identificado__";

export function buildResumoDiario(input: {
  dia: string;
  collaborators: RDColaborador[];
  adminUserIds: string[];
  clients: RDCliente[];
  /** Tarefas concluídas (pode vir com margem; filtra-se aqui pelo dia em Lisboa). */
  tarefasConcluidas: RDTarefa[];
  /** Tarefas em aberto (pendente/em_progresso) — as com prazo ≤ dia contam como em atraso. */
  tarefasAbertas: RDTarefa[];
  obrigacoes: RDObrigacao[];
  contactos: RDContacto[];
  /** Máximo de tarefas em atraso listadas por pessoa (o total conta todas). */
  maxAtrasoListadas?: number;
}): RDResumo {
  const { dia } = input;
  const maxAtraso = input.maxAtrasoListadas ?? 10;
  const clientName = new Map(input.clients.map((c) => [c.id, c.name]));
  const nomeCliente = (id: string | null | undefined) => (id ? clientName.get(id) ?? "—" : undefined);
  const userMap = mapaUtilizadores(input.collaborators, input.adminUserIds);
  const colabIds = new Set(input.collaborators.map((c) => c.id));

  const linhas = new Map<string, RDLinhaColaborador>();
  const linha = (id: string | null | undefined): RDLinhaColaborador => {
    const key = id && colabIds.has(id) ? id : NAO_IDENTIFICADO;
    let l = linhas.get(key);
    if (!l) {
      const c = input.collaborators.find((x) => x.id === key);
      l = {
        id: key, nome: c?.name ?? "Sem responsável / não identificado",
        tarefas: [], gestaoMensal: [], obrigacoes: [], contactos: [], emAtraso: [], totalEmAtraso: 0, totalFeito: 0,
      };
      linhas.set(key, l);
    }
    return l;
  };
  // Colaboradores ativos aparecem sempre (mesmo sem registos).
  input.collaborators.filter((c) => c.active).forEach((c) => linha(c.id));

  const doDia = (ts: string | null | undefined) => !!ts && lisbonDay(ts) === dia;

  for (const t of input.tarefasConcluidas) {
    if (t.status !== "concluida" || !doDia(t.completed_at ?? t.updated_at)) continue;
    const l = linha(t.collaborator_id);
    l.tarefas.push({ titulo: t.title, cliente: nomeCliente(t.client_id) });
    l.totalFeito++;
  }

  const addGrupo = (grupos: RDGrupoCliente[], cliente: string, item: string) => {
    let g = grupos.find((x) => x.cliente === cliente);
    if (!g) { g = { cliente, itens: [] }; grupos.push(g); }
    if (!g.itens.includes(item)) g.itens.push(item);
  };
  for (const o of input.obrigacoes) {
    if (!doDia(o.completed_at)) continue;
    const l = linha(o.completed_by ? userMap.get(o.completed_by) : null);
    const item = `${obrigacaoLabel(o.obligation_type)} ${mesCurto(String(o.reference_month))}`;
    addGrupo(isGestaoMensal(o.obligation_type) ? l.gestaoMensal : l.obrigacoes, nomeCliente(o.client_id) ?? "—", item);
    l.totalFeito++;
  }

  for (const c of input.contactos) {
    if (!doDia(c.created_at)) continue;
    const l = linha(c.collaborator_id ?? (c.created_by ? userMap.get(c.created_by) : null));
    l.contactos.push({ cliente: nomeCliente(c.client_id) ?? "—", tipo: c.tipo });
    l.totalFeito++;
  }

  const abertas = input.tarefasAbertas
    .filter((t) => (t.status === "pendente" || t.status === "em_progresso") && t.due_date && t.due_date.slice(0, 10) <= dia)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  for (const t of abertas) {
    const l = linha(t.collaborator_id);
    l.totalEmAtraso++;
    if (l.emAtraso.length < maxAtraso) {
      const prazo = String(t.due_date).slice(0, 10);
      l.emAtraso.push({ titulo: t.title, cliente: nomeCliente(t.client_id), prazo: fmtDia(prazo), hoje: prazo === dia });
    }
  }

  const ordenar = (g: RDGrupoCliente[]) => g.sort((a, b) => a.cliente.localeCompare(b.cliente, "pt"));
  const colaboradores = [...linhas.values()]
    // A linha "não identificado" só aparece se tiver alguma coisa.
    .filter((l) => l.id !== NAO_IDENTIFICADO || l.totalFeito > 0 || l.totalEmAtraso > 0)
    .map((l) => ({ ...l, gestaoMensal: ordenar(l.gestaoMensal), obrigacoes: ordenar(l.obrigacoes) }))
    .sort((a, b) => {
      if (a.id === NAO_IDENTIFICADO) return 1;
      if (b.id === NAO_IDENTIFICADO) return -1;
      return a.nome.localeCompare(b.nome, "pt");
    });

  const soma = (f: (l: RDLinhaColaborador) => number) => colaboradores.reduce((s, l) => s + f(l), 0);
  const nItens = (g: RDGrupoCliente[]) => g.reduce((s, x) => s + x.itens.length, 0);
  return {
    dia,
    colaboradores,
    totais: {
      tarefas: soma((l) => l.tarefas.length),
      gestaoMensal: soma((l) => nItens(l.gestaoMensal)),
      obrigacoes: soma((l) => nItens(l.obrigacoes)),
      contactos: soma((l) => l.contactos.length),
      emAtraso: soma((l) => l.totalEmAtraso),
    },
  };
}
