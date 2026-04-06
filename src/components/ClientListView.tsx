import { useState } from "react";
import { useClients, useCollaborators, useUpsertClient, useDeleteClient } from "@/hooks/useSupabaseQuery";
import { Search, Plus, Building2, X } from "lucide-react";
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
];

const TIPO_CONTAB_OPTIONS = [
  { value: "SQ", label: "Empresa (SQ)" },
  { value: "TI RS", label: "TI Simplificado" },
  { value: "TI CO", label: "TI Organizado" },
];

const SS_OPTIONS = [
  { value: "", label: "—" },
  { value: "Mensal", label: "Mensal" },
  { value: "Trimestral", label: "Trimestral" },
  { value: "Contabilidade Organizada", label: "Cont. Organizada" },
  { value: "TCO", label: "TCO" },
  { value: "Isento", label: "Isento" },
];

const IVA_OPTIONS = [
  { value: "", label: "—" },
  { value: "Mensal", label: "Mensal" },
  { value: "Trimestral", label: "Trimestral" },
  { value: "Art. 9º", label: "Isenção Art. 9º" },
  { value: "Art.53º", label: "Isenção Art. 53º" },
];

const FATURACAO_OPTIONS = [
  { value: "", label: "—" },
  { value: "Emitir", label: "Emitir" },
  { value: "Não Aplicável", label: "Não aplicável" },
];

const RECAPITULATIVA_OPTIONS = [
  { value: "", label: "—" },
  { value: "Mensal", label: "Mensal" },
  { value: "Trimestral", label: "Trimestral" },
  { value: "Não Aplicável", label: "Não Aplicável" },
];

const SAFT_OPTIONS = [
  { value: "", label: "—" },
  { value: "Automático", label: "Automático" },
  { value: "A entregar", label: "A entregar" },
  { value: "Não Aplicável", label: "Não Aplicável" },
];

interface ClientForm {
  name: string;
  nif: string;
  tipo_contabilidade: string;
  salarios: string;
  mensalidade: string;
  inicio_contrato: string;
  responsavel_id: string;
  seguranca_social: string;
  pag_seguranca_social: string;
  iva: string;
  recapitulativa: string;
  faturacao: string;
  saft: string;
}

const PAG_SS_OPTIONS = [
  { value: "", label: "— Selecionar —" },
  { value: "Referência", label: "Referência" },
  { value: "Débito Direto", label: "Débito Direto" },
  { value: "Não Aplicável", label: "Não Aplicável" },
];

const emptyForm: ClientForm = {
  name: "", nif: "", tipo_contabilidade: "SQ", salarios: "", mensalidade: "",
  inicio_contrato: "", responsavel_id: "",
  seguranca_social: "", pag_seguranca_social: "", iva: "", recapitulativa: "", faturacao: "", saft: "",
};

const ClientListView = () => {
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertClient();
  const remove = useDeleteClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [filterIva, setFilterIva] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = clients.filter((c: any) => {
    if (filterTipo !== "all" && c.tipo_contabilidade !== filterTipo) return false;
    if (filterIva !== "all" && (c.iva || "") !== filterIva) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c.nif || "").includes(search)) return false;
    return c.active;
  });

  const openNew = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: any) => {
    setForm({
      name: c.name, nif: c.nif || "",
      tipo_contabilidade: c.tipo_contabilidade || "SQ",
      salarios: c.salarios || "",
      mensalidade: c.mensalidade ? String(c.mensalidade) : "",
      inicio_contrato: c.inicio_contrato || "",
      responsavel_id: c.responsavel_id || "",
      seguranca_social: c.seguranca_social || "",
      pag_seguranca_social: c.pag_seguranca_social || "",
      iva: c.iva || "",
      recapitulativa: c.recapitulativa || "",
      faturacao: c.faturacao || "",
      saft: c.saft || "",
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: form.name, nif: form.nif || null,
        tipo_contabilidade: form.tipo_contabilidade,
        salarios: form.salarios || null,
        mensalidade: form.mensalidade ? parseFloat(form.mensalidade) : null,
        inicio_contrato: form.inicio_contrato || null,
        responsavel_id: form.responsavel_id || null,
        seguranca_social: form.seguranca_social || null,
        pag_seguranca_social: form.pag_seguranca_social || null,
        iva: form.iva || null,
        recapitulativa: form.recapitulativa || null,
        faturacao: form.faturacao || null,
        saft: form.saft || null,
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
          {IVA_OPTIONS.filter(o => o.value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum cliente encontrado</div>}
        </div>
      )}

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
                  <label className="text-sm font-medium mb-1 block">Início de Contrato</label>
                  <input type="date" value={form.inicio_contrato} onChange={(e) => set("inicio_contrato", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
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
                  <label className="text-sm font-medium mb-1 block">Segurança Social</label>
                  <select value={form.seguranca_social} onChange={(e) => set("seguranca_social", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {SS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Pag. Segurança Social</label>
                  <select value={form.pag_seguranca_social} onChange={(e) => set("pag_seguranca_social", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {PAG_SS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">IVA</label>
                  <select value={form.iva} onChange={(e) => set("iva", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {IVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">IVA - Recapitulativa</label>
                  <select value={form.recapitulativa} onChange={(e) => set("recapitulativa", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {RECAPITULATIVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Faturação</label>
                  <select value={form.faturacao} onChange={(e) => set("faturacao", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {FATURACAO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">SAFT</label>
                  <select value={form.saft} onChange={(e) => set("saft", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    {SAFT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Responsável</label>
                  <select value={form.responsavel_id} onChange={(e) => set("responsavel_id", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Sem responsável</option>
                    {collaborators.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
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
