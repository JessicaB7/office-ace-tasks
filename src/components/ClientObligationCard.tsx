import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInitials, getAvatarPalette } from "@/lib/avatar";
import MonthlyNoteCell from "@/components/MonthlyNoteCell";

interface ClientObligationCardProps {
  client: any;
  columns: string[];
  colOblTypes: string[];
  colMaps: Record<string, any>[];
  collabName: string;
  referenceMonth: string;
  showNotes: boolean;
  notesObligation?: any;
  onOpenHistory: () => void;
  onToggle: (colIndex: number) => void;
}

const InfoField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="text-sm truncate">{value || "—"}</div>
  </div>
);

/** Cartão de "galeria" de um cliente, usado em TI RS Reg. IVA, TI CO e Empresas —
 * mostra os dados-chave do cliente e as obrigações do mês, em vez de uma linha de tabela. */
const ClientObligationCard = ({
  client, columns, colOblTypes, colMaps, collabName, referenceMonth,
  showNotes, notesObligation, onOpenHistory, onToggle,
}: ClientObligationCardProps) => {
  const doneFlags = colOblTypes.map((_, i) => colMaps[i]?.[client.id]?.status === "concluida");
  const doneCount = doneFlags.filter(Boolean).length;
  const allDone = doneCount === columns.length;

  return (
    <div className={cn("bg-card rounded-xl border p-4 space-y-3 border-l-4 transition-colors",
      allDone ? "border-l-success bg-success/5" : "border-l-transparent")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button type="button" onClick={onOpenHistory}
            className={cn("font-semibold text-left hover:underline truncate block",
              allDone && "text-muted-foreground line-through")}>
            {client.name}
          </button>
          <div className="flex items-center gap-1.5 mt-1">
            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0",
              client.responsavel_id ? getAvatarPalette(client.responsavel_id) : "bg-muted text-muted-foreground")}>
              {client.responsavel_id ? getInitials(collabName) : "—"}
            </div>
            <span className="text-xs text-muted-foreground truncate">{collabName}</span>
          </div>
        </div>
        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap",
          allDone ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
          {doneCount}/{columns.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 py-2 border-y">
        <InfoField label="NIF" value={client.nif} />
        <InfoField label="NISS" value={client.niss} />
        <InfoField label="Programa Fat." value={client.programa_faturacao} />
        <InfoField label="IVA" value={client.iva} />
        <InfoField label="Salários" value={client.salarios} />
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Obrigações do mês
        </div>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((col, i) => {
            const done = doneFlags[i];
            return (
              <button key={col} type="button" onClick={() => onToggle(i)}
                className={cn("flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition-colors",
                  done
                    ? "bg-success/15 border-success/30 text-success"
                    : "bg-muted/50 border-transparent text-muted-foreground hover:border-primary/40")}>
                <span className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0",
                  done ? "bg-success border-success text-success-foreground" : "border-muted-foreground/30")}>
                  {done && <Check className="w-2.5 h-2.5" />}
                </span>
                {col}
              </button>
            );
          })}
        </div>
      </div>

      {showNotes && (
        <MonthlyNoteCell
          clientId={client.id}
          referenceMonth={referenceMonth}
          obligationId={notesObligation?.id}
          initialNotes={notesObligation?.notes || ""}
        />
      )}
    </div>
  );
};

export default ClientObligationCard;
