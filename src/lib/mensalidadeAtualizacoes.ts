// Atualização de mensalidades (Gestão de negócio, admin) — regras puras, sem efeitos laterais.
// Uma proposta por cliente e por mês de início («a_partir_de»): mensalidade nova, mensagem enviada e resposta.

/** «mantem» = o cliente fica com a mesma mensalidade (sem proposta de aumento nem mensagem). */
export type EstadoAtualizacao = "pendente" | "aceite" | "recusado" | "mantem";

export interface PropostaMensalidade {
  id: string;
  client_id: string;
  mensalidade_atual: number | string | null;
  mensalidade_nova: number | string | null;
  a_partir_de: string;
  mensagem_enviada_em: string | null;
  estado: string;
  estado_em: string | null;
  aplicada_em: string | null;
  notas: string | null;
}

export interface ClienteMensalidade {
  id: string;
  name: string;
  nif?: string | null;
  status?: string | null;
  tipo_contabilidade?: string | null;
  mensalidade?: number | string | null;
  responsavel_id?: string | null;
  inicio_contrato?: string | null;
}

export interface LinhaMensalidade<C extends ClienteMensalidade = ClienteMensalidade> {
  client: C;
  proposta: PropostaMensalidade | null;
  /** Mensalidade atual: a da ficha (ou o retrato guardado na proposta depois de aplicada). */
  atual: number;
  nova: number | null;
}

export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Mensalidade nova opcional (vazio ou inválido → null). */
export const numOuNull = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const arredondarEuro = (v: number): number => Math.round(v);

/** Mensalidade nova com um aumento em %, arredondada ao euro. */
export const novaComPercentagem = (atual: number, pct: number): number => arredondarEuro(atual * (1 + pct / 100));

/** Aumento da proposta (€ e %). Sem mensalidade nova → null. */
export function aumento(atual: number, nova: number | null): { valor: number; pct: number | null } | null {
  if (nova === null) return null;
  const valor = nova - atual;
  return { valor, pct: atual > 0 ? (valor / atual) * 100 : null };
}

/** 1.º dia de janeiro do ano seguinte a `today` (YYYY-MM-DD). */
export const proximoJaneiro = (today: string): string => `${Number(today.slice(0, 4)) + 1}-01-01`;

export const estadoDe = (p: PropostaMensalidade | null): EstadoAtualizacao | null =>
  p ? ((["pendente", "aceite", "recusado", "mantem"] as const).find((e) => e === p.estado) ?? "pendente") : null;

/** Junta os clientes ativos com a proposta do mês escolhido. */
export function montarLinhas<C extends ClienteMensalidade>(clients: C[], propostas: PropostaMensalidade[], aPartirDe: string): LinhaMensalidade<C>[] {
  const porCliente = new Map(propostas.filter((p) => p.a_partir_de.slice(0, 10) === aPartirDe.slice(0, 10)).map((p) => [p.client_id, p]));
  return clients
    .filter((c) => c.status === "ativo")
    .map((c) => {
      const proposta = porCliente.get(c.id) ?? null;
      // Depois de aplicada, a ficha já tem a nova: mostra-se o retrato da mensalidade anterior.
      const atual = proposta?.aplicada_em && proposta.mensalidade_atual !== null ? num(proposta.mensalidade_atual) : num(c.mensalidade);
      return { client: c, proposta, atual, nova: numOuNull(proposta?.mensalidade_nova) };
    })
    .sort((a, b) => a.client.name.localeCompare(b.client.name, "pt"));
}

export type FiltroEstado = "todos" | "sem_proposta" | EstadoAtualizacao;

export interface FiltrosMensalidade {
  responsavel?: string | null; // id, "none" (sem responsável) ou vazio (todos)
  tipo?: string | null;
  estado?: FiltroEstado;
  soPorEnviar?: boolean;
  pesquisa?: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarLinhas<L extends LinhaMensalidade>(linhas: L[], f: FiltrosMensalidade): L[] {
  const q = norm((f.pesquisa ?? "").trim());
  return linhas.filter((l) => {
    if (f.responsavel) {
      if (f.responsavel === "none" ? !!l.client.responsavel_id : l.client.responsavel_id !== f.responsavel) return false;
    }
    if (f.tipo && (l.client.tipo_contabilidade || "") !== f.tipo) return false;
    const est = estadoDe(l.proposta);
    if (f.estado && f.estado !== "todos") {
      if (f.estado === "sem_proposta") { if (l.nova !== null || est === "mantem") return false; }
      else if (f.estado === "mantem") { if (est !== "mantem") return false; }
      else if (est !== f.estado || l.nova === null) return false;
    }
    if (f.soPorEnviar && (l.nova === null || est === "mantem" || !!l.proposta?.mensagem_enviada_em)) return false;
    if (q && !norm(l.client.name).includes(q) && !String(l.client.nif ?? "").includes(q)) return false;
    return true;
  });
}

export interface ResumoMensalidades {
  total: number;
  comProposta: number;
  enviadas: number;
  aceites: number;
  recusados: number;
  pendentes: number;
  /** Clientes que mantêm a mensalidade. */
  mantem: number;
  /** Aumento mensal se todas as propostas forem aceites (exceto as já recusadas). */
  aumentoPotencial: number;
  /** Aumento mensal das propostas aceites. */
  aumentoAceite: number;
}

export function resumir(linhas: LinhaMensalidade[]): ResumoMensalidades {
  const est = (l: LinhaMensalidade) => estadoDe(l.proposta);
  const com = linhas.filter((l) => l.nova !== null && est(l) !== "mantem");
  const dif = (l: LinhaMensalidade) => (l.nova ?? l.atual) - l.atual;
  return {
    total: linhas.length,
    comProposta: com.length,
    enviadas: com.filter((l) => !!l.proposta?.mensagem_enviada_em).length,
    aceites: com.filter((l) => est(l) === "aceite").length,
    recusados: com.filter((l) => est(l) === "recusado").length,
    pendentes: com.filter((l) => est(l) === "pendente").length,
    mantem: linhas.filter((l) => est(l) === "mantem").length,
    aumentoPotencial: com.filter((l) => est(l) !== "recusado").reduce((s, l) => s + dif(l), 0),
    aumentoAceite: com.filter((l) => est(l) === "aceite").reduce((s, l) => s + dif(l), 0),
  };
}

/** Preenchimento em massa: só linhas sem mensalidade nova e com mensalidade atual > 0. */
export function preencherEmMassa(linhas: LinhaMensalidade[], pct: number): { clientId: string; nova: number }[] {
  if (!Number.isFinite(pct)) return [];
  return linhas
    .filter((l) => l.nova === null && l.atual > 0 && estadoDe(l.proposta) !== "mantem")
    .map((l) => ({ clientId: l.client.id, nova: novaComPercentagem(l.atual, pct) }));
}
