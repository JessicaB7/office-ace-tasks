import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, getAvatarPalette } from "@/lib/avatar";

interface ClientObligationCardProps {
  client: any;
  columns: string[];
  colOblTypes: string[];
  colMaps: Record<string, any>[];
  onOpen: () => void;
}

/** "Ícone" de cliente na galeria (TI RS Reg. IVA, TI CO e Empresas) — avatar com
 * anel de progresso do mês + nome; todos os dados do cliente e as obrigações do
 * mês vivem na ficha, que abre ao clicar (ver ClientMonthlyHistoryDialog). */
const ClientObligationCard = ({ client, columns, colOblTypes, colMaps, onOpen }: ClientObligationCardProps) => {
  const total = columns.length;
  const doneCount = colOblTypes.filter((_, i) => colMaps[i]?.[client.id]?.status === "concluida").length;
  const allDone = total > 0 && doneCount === total;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const ring = 2 * Math.PI * 16;

  return (
    <button type="button" onClick={onOpen}
      className={cn(
        "group flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 text-center",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40",
        allDone && "bg-success/5 border-success/30"
      )}>
      <div className="relative w-14 h-14 shrink-0">
        <svg viewBox="0 0 36 36" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3" className="stroke-muted" />
          <circle cx="18" cy="18" r="16" fill="none" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={ring} strokeDashoffset={ring - (pct / 100) * ring}
            className={cn("transition-all duration-500", allDone ? "stroke-success" : "stroke-primary")} />
        </svg>
        <div className={cn("absolute inset-[5px] rounded-full flex items-center justify-center text-sm font-bold transition-colors",
          allDone ? "bg-success text-success-foreground" : getAvatarPalette(client.id))}>
          {allDone ? <Check className="w-5 h-5" /> : getInitials(client.name)}
        </div>
      </div>
      <span className={cn("font-semibold text-sm leading-snug line-clamp-2",
        allDone ? "text-muted-foreground" : "text-foreground group-hover:text-primary transition-colors")}>
        {client.name}
      </span>
    </button>
  );
};

export default ClientObligationCard;
