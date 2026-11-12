import { useMemo } from "react";
import { KeyRound } from "lucide-react";
import { useCollaborators } from "@/hooks/useSupabaseQuery";
import { auditCampoLabel, auditValor, type AuditEntry } from "@/lib/auditLabels";

interface Props {
  entries: AuditEntry[];
  showClient?: boolean;
  onOpenClient?: (clientId: string) => void;
}

/** Tabela do registo de alterações (ficha de cliente e página da admin). */
const AuditTable = ({ entries, showClient = false, onOpenClient }: Props) => {
  const { data: collaborators = [] } = useCollaborators();
  const nomePorUser = useMemo(() => new Map(collaborators.filter((c: any) => c.user_id).map((c: any) => [c.user_id, c.name])), [collaborators]);

  if (entries.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Sem alterações registadas.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th className="text-left font-semibold px-3 py-2">Quando</th>
            {showClient && <th className="text-left font-semibold px-3 py-2">Cliente</th>}
            <th className="text-left font-semibold px-3 py-2">Campo</th>
            <th className="text-left font-semibold px-3 py-2">Antes</th>
            <th className="text-left font-semibold px-3 py-2">Depois</th>
            <th className="text-left font-semibold px-3 py-2">Por</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const senha = e.valor_novo === "senha alterada";
            return (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">
                  {new Date(e.alterado_em).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                {showClient && (
                  <td className="px-3 py-2">
                    {e.registo_id && onOpenClient && e.campo !== "registo" ? (
                      <button type="button" onClick={() => onOpenClient(e.registo_id!)} className="hover:underline text-left font-medium">
                        {e.registo_nome || "—"}
                      </button>
                    ) : <span className="font-medium">{e.registo_nome || "—"}</span>}
                  </td>
                )}
                <td className="px-3 py-2">{auditCampoLabel(e.campo)}</td>
                {e.campo === "registo" ? (
                  <td className="px-3 py-2 font-medium" colSpan={2}>{e.valor_novo || e.valor_antigo}</td>
                ) : senha ? (
                  <td className="px-3 py-2 text-muted-foreground" colSpan={2}>
                    <span className="inline-flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> Senha alterada</span>
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2 text-muted-foreground">{auditValor(e.campo, e.valor_antigo)}</td>
                    <td className="px-3 py-2">{auditValor(e.campo, e.valor_novo)}</td>
                  </>
                )}
                <td className="px-3 py-2 text-muted-foreground">{e.alterado_por ? nomePorUser.get(e.alterado_por) || "Utilizador" : "Sistema"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AuditTable;
