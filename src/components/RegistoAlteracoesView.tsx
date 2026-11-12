import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { useClients, useCollaborators } from "@/hooks/useSupabaseQuery";
import { useAuditLog } from "@/hooks/useAuditLog";
import { AUDIT_CAMPOS } from "@/lib/auditLabels";
import AuditTable from "@/components/AuditTable";
import ClientDetailDialog from "@/components/ClientDetailDialog";

const selectClass = "px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring";

/** Admin: registo de alterações dos clientes, com filtros por cliente, colaborador, campo e período. */
const RegistoAlteracoesView = () => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const [clientId, setClientId] = useState("");
  const [userId, setUserId] = useState("");
  const [campo, setCampo] = useState("");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [open, setOpen] = useState<any | null>(null);
  const { data: entries = [], isLoading } = useAuditLog({ clientId: clientId || undefined, userId: userId || undefined, campo: campo || undefined, desde: desde || undefined, ate: ate || undefined });
  const clientesOrdenados = useMemo(() => [...clients].sort((a: any, b: any) => a.name.localeCompare(b.name, "pt")), [clients]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">Registo de alterações</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Mudanças de responsável, mensalidade, estado, tipo de contabilidade e senhas dos clientes, e clientes criados ou eliminados.
        Das senhas nunca se guarda o valor.
      </p>
      <div className="flex gap-2 flex-wrap items-center">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={selectClass} aria-label="Cliente">
          <option value="">Todos os clientes</option>
          {clientesOrdenados.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selectClass} aria-label="Colaborador">
          <option value="">Todos os colaboradores</option>
          {collaborators.filter((c: any) => c.user_id).map((c: any) => <option key={c.id} value={c.user_id}>{c.name}</option>)}
        </select>
        <select value={campo} onChange={(e) => setCampo(e.target.value)} className={selectClass} aria-label="Campo">
          <option value="">Todos os campos</option>
          {AUDIT_CAMPOS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="text-sm text-muted-foreground flex items-center gap-1">De
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={selectClass} />
        </label>
        <label className="text-sm text-muted-foreground flex items-center gap-1">até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={selectClass} />
        </label>
      </div>
      {isLoading ? <p className="text-center py-12 text-muted-foreground">A carregar...</p> : (
        <div className="bg-card rounded-xl">
          <AuditTable entries={entries} showClient onOpenClient={(id) => setOpen(clients.find((c: any) => c.id === id) || null)} />
          {entries.length >= 500 && <p className="text-xs text-muted-foreground mt-2">A mostrar as 500 alterações mais recentes — usa os filtros para ver mais.</p>}
        </div>
      )}
      <ClientDetailDialog client={open} open={!!open} onClose={() => setOpen(null)} allowDelete={false} />
    </div>
  );
};

export default RegistoAlteracoesView;
