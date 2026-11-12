import { useMemo } from "react";
import { Gauge, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCollaborators, useDeadlineOverrides, useMonthlyObligations } from "@/hooks/useSupabaseQuery";
import { useCurrentCollaborator } from "@/hooks/useCurrentCollaborator";
import { makeDayResolver } from "@/lib/deadlineOverrides";
import { computeFecho, mesReferenciaPadrao } from "@/lib/fechoMes";
import { todayYmd } from "@/lib/obrigacoesControlo";
import { SEMAFORO_CLASSES, prazoTexto } from "@/components/FechoMesView";

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Dashboard: semáforo do fecho do mês de trabalho (o próprio; a admin vê todos os responsáveis). */
const FechoMesCard = ({ onOpen }: { onOpen?: () => void }) => {
  const { isAdmin } = useAuth();
  const me = useCurrentCollaborator();
  const month = mesReferenciaPadrao();
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: overrides = [] } = useDeadlineOverrides();
  const { data: obligations = [] } = useMonthlyObligations(month);
  const today = todayYmd();
  const fecho = useMemo(
    () => computeFecho(clients, obligations, month, today, makeDayResolver(overrides)),
    [clients, obligations, month, today, overrides],
  );
  const linhas = isAdmin ? fecho.porResponsavel : fecho.porResponsavel.filter((g) => me && g.key === me.id);
  if (linhas.length === 0) return null;
  const nome = (id: string) => (id === "none" ? "Sem responsável" : collaborators.find((c: any) => c.id === id)?.name || "—");

  return (
    <div className="bg-card rounded-xl border p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Fecho de {MONTH_NAMES[Number(month.slice(5, 7)) - 1]}</h3>
        {onOpen && (
          <button type="button" onClick={onOpen} className="ml-auto text-xs text-primary hover:underline inline-flex items-center gap-1">
            Ver fecho do mês <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {linhas.sort((a, b) => nome(a.key).localeCompare(nome(b.key), "pt")).map((g) => {
          const s = SEMAFORO_CLASSES[g.semaforo];
          return (
            <div key={g.key}>
              <div className="flex items-center gap-2 text-sm">
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.dot)} title={s.label} />
                <span className="font-medium flex-1 truncate">{isAdmin ? nome(g.key) : "As minhas obrigações"}</span>
                <span className="text-xs text-muted-foreground">{g.feitas}/{g.total}</span>
                <span className="font-semibold tabular-nums w-10 text-right">{g.pct}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full", s.bar)} style={{ width: `${g.pct}%` }} />
              </div>
              {g.pendentes > 0 && <p className={cn("text-[11px] mt-0.5", s.text)}>{prazoTexto(g.proximoPrazo, today)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FechoMesCard;
