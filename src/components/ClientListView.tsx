import { useState } from "react";
import { useClients } from "@/hooks/useSupabaseQuery";
import { Search, Plus, Building2 } from "lucide-react";
import ClientDetailDialog from "@/components/ClientDetailDialog";
import { cn } from "@/lib/utils";

const TIPO_CONTAB_LABELS: Record<string, string> = {
  SQ: "Empresa",
  "TI RS": "TI Simplificado",
  "TI CO": "TI Organizado",
};

const TIPO_CONTAB_OPTIONS = [
  { value: "SQ", label: "Empresa (SQ)" },
  { value: "TI RS", label: "TI Simplificado" },
  { value: "TI CO", label: "TI Organizado" },
];

const IVA_OPTIONS = [
  { value: "Mensal", label: "Mensal" },
  { value: "Trimestral", label: "Trimestral" },
  { value: "Art. 9º", label: "Isenção Art. 9º" },
  { value: "Art.53º", label: "Isenção Art. 53º" },
];

const tipoContabColor = (tipo: string) => {
  switch (tipo) {
    case "SQ": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "TI CO": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "TI RS": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const ClientListView = () => {
  const { data: clients = [], isLoading } = useClients();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterIva, setFilterIva] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const filtered = clients.filter((c: any) => {
    if (filterTipo !== "all" && c.tipo_contabilidade !== filterTipo) return false;
    if (filterIva !== "all" && (c.iva || "") !== filterIva) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c.nif || "").includes(search)) return false;
    return c.active;
  });

  const openNew = () => { setSelectedClient(null); setDialogOpen(true); };
  const openEdit = (c: any) => { setSelectedClient(c); setDialogOpen(true); };

  const activeClients = clients.filter((c: any) => c.active);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-muted-foreground text-sm mt-1">{activeClients.length} clientes ativos</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar por nome ou NIF..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os tipos</option>
          {TIPO_CONTAB_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filterIva} onChange={(e) => setFilterIva(e.target.value)} className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os IVA</option>
          {IVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client: any, i: number) => (
            <div key={client.id} onClick={() => openEdit(client)} className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{client.name}</h3>
                    {client.nif && <p className="text-xs text-muted-foreground">NIF: {client.nif}</p>}
                  </div>
                </div>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", tipoContabColor(client.tipo_contabilidade))}>
                  {TIPO_CONTAB_LABELS[client.tipo_contabilidade] || client.tipo_contabilidade || "—"}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum cliente encontrado</div>}
        </div>
      )}

      <ClientDetailDialog
        client={selectedClient}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
};

export default ClientListView;
