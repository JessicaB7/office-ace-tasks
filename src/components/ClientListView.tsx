import { useState } from "react";
import { useClients, useUpsertClient, useDeleteClient } from "@/hooks/useSupabaseQuery";
import { REGIME_LABELS, type Client, type FiscalRegime } from "@/types/database";
import { Search, Plus, Building2, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const emptyClient = { name: "", nif: "", fiscal_regime: "organizado" as FiscalRegime, email: "", phone: "", address: "", notes: "" };

const ClientListView = () => {
  const { data: clients = [], isLoading } = useClients();
  const upsert = useUpsertClient();
  const remove = useDeleteClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterRegime, setFilterRegime] = useState<FiscalRegime | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyClient);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = clients.filter((c) => {
    if (filterRegime !== "all" && c.fiscal_regime !== filterRegime) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.nif.includes(search)) return false;
    return c.active;
  });

  const openNew = () => { setForm(emptyClient); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: Client) => { setForm({ name: c.name, nif: c.nif, fiscal_regime: c.fiscal_regime, email: c.email || "", phone: c.phone || "", address: c.address || "", notes: c.notes || "" }); setEditingId(c.id); setDialogOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsert.mutateAsync({ ...form, ...(editingId ? { id: editingId } : {}) });
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clientes</h2>
          <p className="text-muted-foreground text-sm mt-1">{clients.filter(c => c.active).length} clientes ativos</p>
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
        <select value={filterRegime} onChange={(e) => setFilterRegime(e.target.value as FiscalRegime | "all")} className="text-sm rounded-lg border bg-card px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os regimes</option>
          {(Object.keys(REGIME_LABELS) as FiscalRegime[]).map((r) => <option key={r} value={r}>{REGIME_LABELS[r]}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client, i) => (
            <div key={client.id} onClick={() => openEdit(client)} className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{client.name}</h3>
                    <p className="text-xs text-muted-foreground">NIF: {client.nif}</p>
                  </div>
                </div>
                <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">{REGIME_LABELS[client.fiscal_regime]}</span>
              </div>
              {client.email && <p className="text-xs text-muted-foreground truncate">{client.email}</p>}
              {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
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
              <h3 className="text-lg font-bold">{editingId ? "Editar Cliente" : "Novo Cliente"}</h3>
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
                  <input required maxLength={9} pattern="\d{9}" value={form.nif} onChange={(e) => set("nif", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Regime Fiscal</label>
                  <select value={form.fiscal_regime} onChange={(e) => set("fiscal_regime", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {(Object.keys(REGIME_LABELS) as FiscalRegime[]).map((r) => <option key={r} value={r}>{REGIME_LABELS[r]}</option>)}
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
                  <label className="text-sm font-medium mb-1 block">Notas</label>
                  <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
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
