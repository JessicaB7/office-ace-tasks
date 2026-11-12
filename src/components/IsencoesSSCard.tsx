import { useMemo } from "react";
import { Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCollaborators } from "@/hooks/useSupabaseQuery";
import { useCurrentCollaborator } from "@/hooks/useCurrentCollaborator";

/** Dashboard: isenções da Segurança Social a terminar nos próximos 90 dias
 * (admin vê todos os clientes; colaboradores os seus). */
const IsencoesSSCard = ({ onOpenClient }: { onOpenClient: (client: any) => void }) => {
  const { isAdmin } = useAuth();
  const me = useCurrentCollaborator();
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();

  const lista = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 90);
    const hojeStr = hoje.toLocaleDateString("sv-SE");
    const limStr = limite.toLocaleDateString("sv-SE");
    return clients
      .filter((c: any) => c.active && c.status !== "inativo" && c.seguranca_social_isencao_fim)
      .filter((c: any) => c.seguranca_social_isencao_fim >= hojeStr && c.seguranca_social_isencao_fim <= limStr)
      .filter((c: any) => isAdmin || (me && c.responsavel_id === me.id))
      .map((c: any) => ({ c, dias: Math.round((new Date(`${c.seguranca_social_isencao_fim}T12:00:00`).getTime() - hoje.getTime()) / 86400000) }))
      .sort((a, b) => a.dias - b.dias);
  }, [clients, isAdmin, me]);

  if (lista.length === 0) return null;
  const collabName = (id: string | null) => collaborators.find((x: any) => x.id === id)?.name?.split(" ")[0] || "—";

  return (
    <div className="bg-card rounded-xl border p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <Hourglass className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Isenções SS a terminar (próximos 90 dias)</h3>
        <span className="ml-auto text-xs text-muted-foreground">{lista.length}</span>
      </div>
      <div className="divide-y border rounded-lg overflow-hidden">
        {lista.map(({ c, dias }) => (
          <button key={c.id} type="button" onClick={() => onOpenClient(c)}
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-left hover:bg-muted/30">
            <span className="min-w-0">
              <span className="font-medium truncate block">{c.name}</span>
              {isAdmin && <span className="text-xs text-muted-foreground">{collabName(c.responsavel_id)}</span>}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground tabular-nums">{new Date(`${c.seguranca_social_isencao_fim}T12:00:00`).toLocaleDateString("pt-PT")}</span>
              <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full",
                dias <= 15 ? "bg-destructive/15 text-destructive" : dias <= 60 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>
                {dias === 0 ? "hoje" : `${dias} dias`}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default IsencoesSSCard;
