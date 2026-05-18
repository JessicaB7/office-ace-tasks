import { X, Building2 } from "lucide-react";
import { useClients } from "@/hooks/useSupabaseQuery";
import { cn } from "@/lib/utils";
import type { Collaborator } from "@/types/database";

const TIPO_LABELS: Record<string, string> = {
  SQ: "Empresas (SQ)",
  "TI CO": "TI Organizado",
  "TI RS": "TI Simplificado",
};

const TIPO_ORDER = ["SQ", "TI CO", "TI RS"];

const tipoColor = (tipo: string) => {
  switch (tipo) {
    case "SQ": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "TI CO": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "TI RS": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    default: return "bg-muted text-muted-foreground";
  }
};

interface Props {
  collaborator: Collaborator;
  onClose: () => void;
}

const CollaboratorClientsDialog = ({ collaborator, onClose }: Props) => {
  const { data: clients = [] } = useClients();
  const collabClients = clients.filter((c) => c.responsavel_id === collaborator.id && c.active);

  const grouped: Record<string, typeof collabClients> = {};
  for (const c of collabClients) {
    const tipo = c.tipo_contabilidade || "Sem tipo";
    (grouped[tipo] ||= []).push(c);
  }
  const tipos = Object.keys(grouped).sort((a, b) => {
    const ai = TIPO_ORDER.indexOf(a); const bi = TIPO_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <h3 className="text-lg font-bold">Clientes de {collaborator.name}</h3>
            <p className="text-sm text-muted-foreground">{collabClients.length} cliente{collabClients.length !== 1 ? "s" : ""} ativos</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-5">
          {tipos.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sem clientes atribuídos</p>
          )}
          {tipos.map((tipo) => (
            <div key={tipo}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", tipoColor(tipo))}>
                  {TIPO_LABELS[tipo] || tipo}
                </span>
                <span className="text-xs text-muted-foreground">({grouped[tipo].length})</span>
              </div>
              <div className="space-y-1">
                {grouped[tipo]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/40 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{c.name}</span>
                        {c.nif && <span className="text-xs text-muted-foreground">· {c.nif}</span>}
                      </div>
                      {c.mensalidade ? (
                        <span className="text-xs font-semibold text-primary shrink-0 ml-2">
                          {Number(c.mensalidade).toFixed(2).replace(".", ",")} €
                        </span>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CollaboratorClientsDialog;
