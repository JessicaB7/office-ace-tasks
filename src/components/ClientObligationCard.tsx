import { cn } from "@/lib/utils";

interface ClientObligationCardProps {
  client: any;
  columns: string[];
  colOblTypes: string[];
  colMaps: Record<string, any>[];
  onOpen: () => void;
}

/** "Ícone" de cliente na galeria (TI RS Reg. IVA, TI CO e Empresas) — mostra só o
 * nome; todos os dados do cliente e as obrigações do mês vivem na ficha, que abre
 * ao clicar (ver ClientMonthlyHistoryDialog). */
const ClientObligationCard = ({ client, columns, colOblTypes, colMaps, onOpen }: ClientObligationCardProps) => {
  const allDone = colOblTypes.every((_, i) => colMaps[i]?.[client.id]?.status === "concluida");

  return (
    <button type="button" onClick={onOpen}
      className={cn("bg-card rounded-xl border p-4 text-center border-l-4 transition-shadow hover:shadow-md",
        allDone ? "border-l-success bg-success/5" : "border-l-transparent")}>
      <span className={cn("font-semibold text-sm break-words", allDone && "text-muted-foreground line-through")}>
        {client.name}
      </span>
    </button>
  );
};

export default ClientObligationCard;
