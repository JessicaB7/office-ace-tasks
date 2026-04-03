import { useState } from "react";
import { useClients, useCollaborators, useUpsertClient, useDeleteClient } from "@/hooks/useSupabaseQuery";
import { Search, Plus, Building2, X, Euro, Calendar, Briefcase, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TIPO_CONTAB_LABELS: Record<string, string> = {
  SQ: "Empresa",
  "TI RS": "TI Simplificado",
  "TI CO": "TI Organizado",
};

const SALARIOS_OPTIONS = [
  { value: "", label: "Não aplicável" },
  { value: "Sim até dia 25", label: "Até dia 25" },
  { value: "Sim até ao fim do mês", label: "Até ao fim do mês" },
  { value: "Não tem", label: "Não tem" },
];

const TIPO_CONTAB_OPTIONS = [
  { value: "SQ", label: "Empresa (SQ)" },
  { value: "TI RS", label: "TI Simplificado" },
  { value: "TI CO", label: "TI Organizado" },
];

interface ClientForm {
  name: string;
  nif: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  tipo_contabilidade: string;
  salarios: string;
  mensalidade: string;
  inicio_contrato: string;
  responsavel_id: string;
  notas_internas: string;
}

const emptyForm: ClientForm = {
  name: "", nif: "", email: "", phone: "", address: "", notes: "",
  tipo_contabilidade: "SQ", salarios: "", mensalidade: "", inicio_contrato: "",
  responsavel_id: "", notas_internas: "",
};

const ClientListView = () => {
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertClient();
  const remove = useDeleteClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = clients.filter((c: any) => {
    if (filterTipo !== "all" && c.tipo_contabilidade !== filterTipo) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c.nif || "").includes(search)) return false;
    return c.active;
  });

  const openNew = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setForm({
      name: c.name, nif: c.nif || "", email: c.email || "", phone: c.phone || "",
      address: c.address || "", notes: c.notes || "",
      tipo_contabilidade: c.tipo_contabilidade || "SQ",
      salarios: c.salarios || "",
      mensalidade: c.mensalidade ? String(c.mensalidade) : "",
      inicio_contrato: c.inicio_contrato || "",
      responsavel_id: c.responsavel_id || "",
      notas_internas: c.notas_internas || "",
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: form.name, nif: form.nif, email: form.email || null, phone: form.phone || null,
        address: form.address || null, notes: form.notes || null,
        tipo_contabilidade: form.tipo_contabilidade,
        salarios: form.salarios || null,
        mensalidade: form.mensalidade ? parseFloat(form.mensalidade) : null,
        inicio_contrato: form.inicio_contrato || null,
        responsavel_id: form.responsavel_id || null,
        notas_internas: form.notas_internas || null,
      };
      if (editingId) payload.id = editingId;
      await upsert.mutateAsync(payload);
      setDialogOpen(false);
      toast({ title: editingId ? "Cliente atualizado" : "Cliente criado", description: form.name });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      setDialogOpen(false);
      toast({ title: "Cliente eliminado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const getCollabName = (id: string | null) => {
    if (!id) return null;
    const c = collaborators.find((col: any) => col.id === id);
    return c ? c.name : null;
  };

  const formatMensalidade = (val: number | null) => {
    if (!val) return null;
    return `${val.toFixed(2).replace(".", ",")} €`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-muted-foreground text-sm mt-1">{clients.filter((c: any) => c.active).length} clientes ativos</p>
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
                <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">
                  {TIPO_CONTAB_LABELS[client.tipo_contabilidade] || client.tipo_contabilidade || "—"}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {client.mensalidade && (
                  <span className="flex items-center gap-1">
                    <Euro className="w-3 h-3" /> {formatMensalidade(client.mensalidade)}
                  </span>
                )}
                {client.salarios && client.salarios !== "Não tem" && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Salários: {client.salarios.replace("Sim ", "")}
                  </span>
                )}
                {getCollabName(client.responsavel_id) && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {getCollabName(client.responsavel_id)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum cliente encontrado</div>}
        </div>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setDialogOpen(false)} />
          <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">{editingId ? "Ficha de Cliente" : "Novo Cliente"}</h3>
              <button onClick={() => setDialogOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Nome</label>
                  <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">NIF</label>
                  <input maxLength={9} value={form.nif} onChange={(e) => set("nif", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo de Contabilidade</label>
                  <select value={form.tipo_contabilidade} onChange={(e) => set("tipo_contabilidade", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {TIPO_CONTAB_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Mensalidade (€)</label>
                  <input type="number" step="0.01" min="0" value={form.mensalidade} onChange={(e) => set("mensalidade", e.target.value)} placeholder="0,00" className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Salários</label>
                  <select value={form.salarios} onChange={(e) => set("salarios", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {SALARIOS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Início de Contrato</label>
                  <input type="date" value={form.inicio_contrato} onChange={(e) => set("inicio_contrato", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Responsável</label>
                  <select value={form.responsavel_id} onChange={(e) => set("responsavel_id", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Sem responsável</option>
                    {collaborators.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Telefone</label>
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Morada</label>
                  <input value={form.address} onChange={(e) => set("address", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Notas Internas</label>
                  <textarea value={form.notas_internas} onChange={(e) => set("notas_internas", e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={upsert.isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                  {upsert.isPending ? "A guardar..." : editingId ? "Guardar" : "Criar Cliente"}
                </button>
                {editingId && (
                  <button type="button" onClick={() => handleDelete(editingId)} className="px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive font-medium text-sm hover:bg-destructive/20 transition-colors">
                    Eliminar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientListView;
