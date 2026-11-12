import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMonthlyObligations } from "@/hooks/useSupabaseQuery";
import type { AuditCtl, ClienteCtl, ColabCtl, PedidoCtl, TarefaCtl } from "@/lib/controlo";

/** Página «Controlo»: dados lidos de novo sempre que a página abre (sem polling). */
const FRESH = { staleTime: 0, refetchOnMount: "always" as const, refetchOnWindowFocus: false };
const PAGE = 1000;

/** Lê todas as páginas de uma consulta (o PostgREST devolve no máximo 1000 linhas). */
async function allPages<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export function useControloClients() {
  return useQuery({
    queryKey: ["controlo", "clients"],
    queryFn: () => allPages<ClienteCtl>((a, b) => supabase.from("clients").select("*").order("name").range(a, b)),
    ...FRESH,
  });
}

export function useControloCollaborators() {
  return useQuery({
    queryKey: ["controlo", "collaborators"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collaborators").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as ColabCtl[];
    },
    ...FRESH,
  });
}

/** Tarefas em aberto (as em atraso calculam-se a partir destas com `tarefaEmAtraso`). */
export function useControloTarefasAbertas() {
  return useQuery({
    queryKey: ["controlo", "tarefas_abertas"],
    queryFn: () =>
      allPages<TarefaCtl>((a, b) =>
        supabase
          .from("tasks")
          .select("id, title, status, due_date, client_id, collaborator_id")
          .not("status", "in", "(concluida,cancelada)")
          .order("due_date")
          .order("id")
          .range(a, b),
      ),
    ...FRESH,
  });
}

/** Células da Gestão Mensal / obrigações com pedido ao cliente ainda por concluir. */
export function useControloPedidos() {
  return useQuery({
    queryKey: ["controlo", "pedidos"],
    queryFn: () =>
      allPages<PedidoCtl>((a, b) =>
        supabase
          .from("monthly_obligations")
          .select("id, client_id, obligation_type, reference_month, status, pedido_cliente_em, pedido_cliente_nota")
          .not("pedido_cliente_em", "is", null)
          // (as concluídas saem em calcularRisco; um .neq deixaria de fora as linhas com status nulo)
          .order("id")
          .range(a, b),
      ),
    ...FRESH,
  });
}

export function useControloObrigacoes(months: string[]) {
  return useQuery({
    queryKey: ["controlo", "obrigacoes", months.join(",")],
    queryFn: () => fetchAllMonthlyObligations(months),
    ...FRESH,
  });
}

/** Registo de alterações de clientes (responsável e mensalidade) desde `desde`. Só leitura. */
export function useControloAudit(desde: string) {
  return useQuery({
    queryKey: ["controlo", "audit", desde],
    queryFn: () =>
      allPages<AuditCtl>((a, b) =>
        // audit_log não está nos tipos gerados.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("audit_log")
          .select("registo_id, registo_nome, campo, valor_antigo, valor_novo, alterado_em")
          .eq("tabela", "clients")
          .in("campo", ["responsavel_id", "mensalidade"])
          .gte("alterado_em", desde)
          .order("alterado_em")
          .range(a, b),
      ),
    ...FRESH,
  });
}

export function useControloOverrides() {
  return useQuery({
    queryKey: ["controlo", "overrides"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_deadline_overrides").select("*");
      if (error) throw error;
      return data ?? [];
    },
    ...FRESH,
  });
}
