import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDeadlineOverrides } from "@/hooks/useSupabaseQuery";
import { makeDayResolver } from "@/lib/deadlineOverrides";
import { cn } from "@/lib/utils";
import { clientObligationsFor, obligationState, STATE_UI, type ClientObligation } from "@/lib/clientObligations";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props {
  client: any;
  year: number;
  /** Mês em destaque ("YYYY-MM-01"), o mesmo da tabela de meses. */
  referenceMonth?: string;
}

/** Obrigações fiscais do cliente ao longo do ano (Gestão Mensal → ficha do cliente):
 * uma linha por mês e uma coluna por obrigação aplicável segundo o enquadramento,
 * com o estado registado na vista de Obrigações (só leitura — marca-se lá). */
const ClientObrigacoesAnoTable = ({ client, year, referenceMonth }: Props) => {
  const { data: overrides = [] } = useDeadlineOverrides();

  const months = useMemo(() => {
    const dayFor = makeDayResolver(overrides);
    return Array.from({ length: 12 }, (_, m) => ({
      key: `${year}-${String(m + 1).padStart(2, "0")}-01`,
      label: `${MONTH_NAMES[m]} ${year}`,
      month: m,
      obligations: clientObligationsFor(client, year, m, dayFor),
    }));
  }, [client, year, overrides]);

  // Colunas: todas as obrigações que surgem em algum mês do ano, pela ordem da lista.
  const columns = useMemo(() => {
    const seen = new Map<string, ClientObligation>();
    months.forEach((row) => row.obligations.forEach((o) => { if (!seen.has(o.key)) seen.set(o.key, o); }));
    return [...seen.values()];
  }, [months]);

  const types = useMemo(() => [...new Set(columns.map((o) => o.type))], [columns]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["monthly_obligations", "client_year", client?.id, year, types],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_obligations")
        .select("*")
        .eq("client_id", client.id)
        .gte("reference_month", `${year}-01-01`)
        .lte("reference_month", `${year}-12-01`)
        .in("obligation_type", types);
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && types.length > 0,
  });

  const recordFor = useMemo(() => {
    const map = new Map<string, any>();
    records.forEach((r: any) => map.set(`${r.reference_month}|${r.obligation_type}`, r));
    return (month: string, type: string) => map.get(`${month}|${type}`);
  }, [records]);

  const now = new Date();

  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Sem obrigações mensais — completa o separador Enquadramento na ficha do cliente.
      </p>
    );
  }

  return isLoading ? (
    <div className="text-center py-8 text-muted-foreground">A carregar...</div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-muted/40">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground rounded-l-lg">Mês</th>
            {columns.map((o, i) => (
              <th key={o.key} title={o.periodicidade}
                className={cn("text-center px-2 py-2 font-semibold text-muted-foreground text-xs", i === columns.length - 1 && "rounded-r-lg")}>
                {o.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((row) => {
            const isFuture = new Date(year, row.month, 1) > new Date(now.getFullYear(), now.getMonth(), 1);
            return (
              <tr key={row.key} className={cn("border-b last:border-0 hover:bg-muted/20", row.key === referenceMonth && "bg-primary/5")}>
                <td className={cn("px-3 py-2.5 font-medium whitespace-nowrap", isFuture && "text-muted-foreground")}>{row.label}</td>
                {columns.map((col) => {
                  const o = row.obligations.find((x) => x.key === col.key);
                  if (!o) {
                    return (
                      <td key={col.key} className="text-center px-2 py-2.5">
                        <span className="text-[10px] text-muted-foreground/60 italic">Não aplicável</span>
                      </td>
                    );
                  }
                  const state = obligationState(o, recordFor(row.key, o.type));
                  if (state === "fora_periodo") return <td key={col.key} className="px-2 py-2.5" />;
                  const ui = STATE_UI[state];
                  return (
                    <td key={col.key} className="text-center px-2 py-2.5">
                      <span title={`Prazo: ${o.prazo}`}
                        className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap",
                          isFuture && state === "pendente" ? "bg-muted text-muted-foreground" : ui.cls)}>
                        {isFuture && state === "pendente" ? "Ainda não chegou" : ui.label}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ClientObrigacoesAnoTable;
