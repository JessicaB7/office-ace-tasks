/** Fecho do mês com semáforo: obrigações de um mês de referência por responsável e por
 * tipo de obrigação, com % feito, próximo prazo e cor. Puro, sem side effects.
 * Usa as mesmas regras do Controlo interno (obrigacoesForClient / isObrigacaoDone / ativoNoMes).
 * (Copiado tal e qual para supabase/functions/_shared/lib/ — ver sharedLib.test.ts.) */

import { obrigacoesForClient, isObrigacaoDone, OBRIGACAO_GROUPS, type ObrigacaoTask } from "./obrigacoesControlo.ts";
import { ativoNoMes } from "./clientSaida.ts";
import { defaultDayResolver, type DayResolver } from "./deadlineOverrides.ts";

export type Semaforo = "verde" | "amarelo" | "vermelho";

export interface FechoEmFalta {
  client: any;
  task: ObrigacaoTask;
}

export interface FechoGrupo {
  /** Id do responsável ("none" = sem responsável) ou do tipo de obrigação. */
  key: string;
  total: number;
  feitas: number;
  pendentes: number;
  /** 0–100, arredondado. Sem obrigações → 100. */
  pct: number;
  /** Prazo mais próximo das obrigações pendentes ("YYYY-MM-DD"), ou null. */
  proximoPrazo: string | null;
  semaforo: Semaforo;
  emFalta: FechoEmFalta[];
}

export interface FechoResultado {
  total: FechoGrupo;
  porResponsavel: FechoGrupo[];
  porObrigacao: FechoGrupo[];
}

/** Dias de `from` até `to` (ambos "YYYY-MM-DD"); negativo se `to` já passou. */
export const diasAte = (from: string, to: string): number => {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86400000);
};

/**
 * Semáforo:
 * - verde: nada pendente, ou ≥ 90% feito, ou o prazo pendente mais próximo está a mais de 7 dias;
 * - vermelho: há pendentes com prazo a menos de 3 dias (ou já ultrapassado);
 * - amarelo: há pendentes com prazo entre 3 e 7 dias.
 */
export const semaforoDe = (pct: number, proximoPrazo: string | null, today: string): Semaforo => {
  if (!proximoPrazo || pct >= 90) return "verde";
  const dias = diasAte(today, proximoPrazo);
  if (dias > 7) return "verde";
  if (dias < 3) return "vermelho";
  return "amarelo";
};

const grupo = (key: string, itens: { client: any; task: ObrigacaoTask; done: boolean }[], today: string): FechoGrupo => {
  const total = itens.length;
  const feitas = itens.filter((i) => i.done).length;
  const emFalta = itens.filter((i) => !i.done).map(({ client, task }) => ({ client, task }));
  const pct = total === 0 ? 100 : Math.round((feitas / total) * 100);
  const proximoPrazo = emFalta.reduce<string | null>((min, f) => (!min || f.task.deadline < min ? f.task.deadline : min), null);
  return { key, total, feitas, pendentes: total - feitas, pct, proximoPrazo, semaforo: semaforoDe(pct, proximoPrazo, today), emFalta };
};

/**
 * @param clients    clientes (com `active`, `responsavel_id`, `ultimo_mes_responsabilidade`, enquadramento)
 * @param obligations linhas de monthly_obligations do mês
 * @param month      mês de referência "YYYY-MM-01"
 * @param today      "YYYY-MM-DD"
 */
export function computeFecho(
  clients: any[],
  obligations: any[],
  month: string,
  today: string,
  dayFor: DayResolver = defaultDayResolver,
): FechoResultado {
  const byKey = new Map<string, any>();
  obligations
    .filter((o) => String(o.reference_month).slice(0, 7) === month.slice(0, 7))
    .forEach((o) => byKey.set(`${o.client_id}|${o.obligation_type}`, o));

  const itens: { client: any; task: ObrigacaoTask; done: boolean }[] = [];
  for (const c of clients) {
    if (!ativoNoMes(c, month)) continue;
    for (const t of obrigacoesForClient(c, month, dayFor)) {
      itens.push({ client: c, task: t, done: isObrigacaoDone(t, byKey.get(`${c.id}|${t.type}`)) });
    }
  }

  const resp = new Map<string, typeof itens>();
  itens.forEach((i) => {
    const k = i.client.responsavel_id || "none";
    if (!resp.has(k)) resp.set(k, []);
    resp.get(k)!.push(i);
  });

  return {
    total: grupo("all", itens, today),
    porResponsavel: [...resp.entries()].map(([k, l]) => grupo(k, l, today)),
    porObrigacao: OBRIGACAO_GROUPS
      .map((g) => grupo(g.id, itens.filter((i) => i.task.group === g.id), today))
      .filter((g) => g.total > 0),
  };
}

/** Mês de referência por omissão: o anterior ao de `today` ("YYYY-MM-01"). */
export const mesReferenciaPadrao = (today: Date = new Date()): string => {
  const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
