import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDeadlineOverrides } from "@/hooks/useSupabaseQuery";
import { makeDayResolver } from "@/lib/deadlineOverrides";
import { cn } from "@/lib/utils";
import { clientObligationsFor, obligationState, annualObligationsFor, STATE_UI } from "@/lib/clientObligations";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface Props {
  clientId: string;
  /** Ficha do cliente (com o enquadramento atual do formulário). */
  client: any;
}

/** Separador "Obrigações fiscais" da ficha de cliente: obrigações aplicáveis segundo o
 * enquadramento, com prazo e estado do mês selecionado, e as obrigações anuais do regime. */
const ClientObrigacoesTab = ({ clientId, client }: Props) => {
  const now = new Date();
  // Por omissão, o mês anterior (cujos prazos caem no mês corrente) — como na vista de Obrigações
  const [year, setYear] = useState(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() === 0 ? 11 : now.getMonth() - 1);
  const { data: overrides = [] } = useDeadlineOverrides();
  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["monthly_obligations", referenceMonth, "client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_obligations")
        .select("*")
        .eq("client_id", clientId)
        .eq("reference_month", referenceMonth);
      if (error) throw error;
      return data;
    },
  });

  const prev = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  const obligations = clientObligationsFor(client, year, month, makeDayResolver(overrides));
  const annual = annualObligationsFor(client);
  const byType = new Map(records.map((r: any) => [r.obligation_type, r]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prev} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-semibold">{MONTH_NAMES[month]} {year}</span>
        <button type="button" onClick={next} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
      </div>

      {obligations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Sem obrigações mensais — completa o separador Enquadramento.
        </p>
      ) : (
        <div className="rounded-lg border divide-y">
          {obligations.map((o) => {
            const state = isLoading ? null : obligationState(o, byType.get(o.type));
            return (
              <div key={o.key} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.periodicidade} · Prazo: {o.prazo}</p>
                </div>
                {state && (
                  <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium", STATE_UI[state].cls)}>
                    {STATE_UI[state].label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {annual.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Obrigações anuais</p>
          <div className="rounded-lg border divide-y">
            {annual.map((a) => (
              <div key={a.label} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm">{a.label}</span>
                <span className="text-xs text-muted-foreground text-right">{a.prazo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientObrigacoesTab;
