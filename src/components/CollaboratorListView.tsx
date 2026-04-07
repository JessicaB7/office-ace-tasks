import { useState } from "react";
import { useCollaborators, useUpsertCollaborator, useDeleteCollaborator, useTasks, useClients } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/integrations/supabase/client";
import type { Collaborator } from "@/types/database";
import { Search, Plus, UserCircle, X, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const emptyCollab = { name: "", email: "", role: "técnico", specialty: "", access_code: "" };

const CollaboratorListView = () => {
  const { data: collaborators = [], isLoading } = useCollaborators();
  const { data: tasks = [] } = useTasks();
  const { data: clients = [] } = useClients();
  const upsert = useUpsertCollaborator();
  const remove = useDeleteCollaborator();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCollab);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeCollabs = collaborators.filter(c => c.active);
  const filtered = activeCollabs.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getTaskCounts = (collabId: string) => {
    const collabTasks = tasks.filter((t: any) => t.collaborator_id === collabId);
    const pending = collabTasks.filter((t: any) => t.status === "pendente" || t.status === "em_progresso").length;
    const done = collabTasks.filter((t: any) => t.status === "concluida").length;
    return { total: collabTasks.length, pending, done };
  };

  const getClientCountsByType = (collabId: string) => {
    const collabClients = clients.filter(c => c.responsavel_id === collabId && c.active);
    const byType: Record<string, number> = {};
    for (const c of collabClients) {
      const tipo = c.tipo_contabilidade || "Sem tipo";
      byType[tipo] = (byType[tipo] || 0) + 1;
    }
    return { total: collabClients.length, byType };
  };

  const openNew = () => { setForm(emptyCollab); setEditingId(null); setDialogOpen(true); };
  const openEdit = (c: Collaborator) => { setForm({ name: c.name, email: c.email, role: c.role, specialty: c.specialty || "", access_code: (c as any).access_code || "" }); setEditingId(c.id); setDialogOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { access_code, ...collabData } = form;
      const result = await upsert.mutateAsync({ ...collabData, ...(editingId ? { id: editingId } : {}) });
      const collabId = editingId || result?.id;

      // If access code is set, sync auth user
      if (access_code && collabId) {
        const { data, error: fnError } = await supabase.functions.invoke("manage-collaborator-auth", {
          body: { email: form.email, access_code, collaborator_id: collabId },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
      }

      setDialogOpen(false);
      toast({ title: editingId ? "Colaborador atualizado" : "Colaborador criado", description: form.name });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      setDialogOpen(false);
      toast({ title: "Colaborador eliminado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Colaboradores</h2>
          <p className="text-muted-foreground text-sm mt-1">{activeCollabs.length} colaboradores ativos</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Novo Colaborador
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Pesquisar colaborador..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">A carregar...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((collab, i) => {
            const counts = getTaskCounts(collab.id);
            const clientCounts = getClientCountsByType(collab.id);
            return (
              <div key={collab.id} onClick={() => openEdit(collab)} className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{collab.name}</h3>
                    <p className="text-xs text-muted-foreground">{collab.role}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{collab.email}</p>
                {collab.specialty && <p className="text-xs text-muted-foreground mb-3">Especialidade: {collab.specialty}</p>}
                
                {clientCounts.total > 0 && (
                  <div className="mb-3 p-2.5 rounded-lg bg-muted/50">
                    <p className="text-xs font-medium mb-1.5">{clientCounts.total} cliente{clientCounts.total !== 1 ? "s" : ""}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(clientCounts.byType).map(([tipo, count]) => (
                        <span key={tipo} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border text-[11px] text-muted-foreground">
                          {tipo} <span className="font-semibold text-foreground">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-muted-foreground">{counts.pending} ativas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-muted-foreground">{counts.done} concluídas</span>
                  </div>
                </div>
                {counts.pending > 0 && (
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min((counts.pending / 10) * 100, 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum colaborador encontrado</div>}
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setDialogOpen(false)} />
          <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-md mx-4 animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-bold">{editingId ? "Editar Colaborador" : "Novo Colaborador"}</h3>
              <button onClick={() => setDialogOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome</label>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Cargo</label>
                  <input value={form.role} onChange={(e) => set("role", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Especialidade</label>
                  <input value={form.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="IRS, IVA, IRC..." className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Código de Acesso
                </label>
                <input value={form.access_code} onChange={(e) => set("access_code", e.target.value)} placeholder="Código para entrar na plataforma" className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                <p className="text-[11px] text-muted-foreground mt-1">Defina um código para o colaborador aceder à plataforma</p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={upsert.isPending} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                  {upsert.isPending ? "A guardar..." : editingId ? "Guardar" : "Criar Colaborador"}
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

export default CollaboratorListView;
