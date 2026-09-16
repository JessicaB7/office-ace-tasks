import { useMemo } from "react";
import { useClients, useMonthlyObligations } from "./useSupabaseQuery";
import { SUB_PAGE_CONFIG, obligationTypesFor } from "@/lib/contabilidadesConfig";

const currentReferenceMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

/** Contagem de clientes ainda por concluir em cada um dos 4 regimes de Contabilidades,
 * para o mês indicado (por omissão o mês corrente) — sem precisar de abrir cada separador. */
export function useContabilidadesPending(referenceMonth?: string) {
  const ref = referenceMonth ?? currentReferenceMonth();
  const { data: clients = [] } = useClients();
  const { data: obligations = [] } = useMonthlyObligations(ref);

  return useMemo(() => {
    const activeClients = clients.filter((c: any) => c.active);
    const perTab: Record<string, { pending: number; total: number }> = {};
    let totalPending = 0;

    for (const [key, config] of Object.entries(SUB_PAGE_CONFIG)) {
      const tabClients = activeClients.filter(config.filter);
      const obTypes = obligationTypesFor(key, config);

      const doneSets = new Map<string, Set<string>>();
      obligations.forEach((o: any) => {
        if (o.status !== "concluida" || !obTypes.includes(o.obligation_type)) return;
        if (!doneSets.has(o.client_id)) doneSets.set(o.client_id, new Set());
        doneSets.get(o.client_id)!.add(o.obligation_type);
      });

      let pending = 0;
      tabClients.forEach((c: any) => {
        const done = doneSets.get(c.id);
        const isDone = !!done && obTypes.every((t) => done.has(t));
        if (!isDone) pending++;
      });

      perTab[key] = { pending, total: tabClients.length };
      totalPending += pending;
    }

    return { perTab, totalPending };
  }, [clients, obligations]);
}
