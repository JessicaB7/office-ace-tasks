import { useState } from "react";
import { useCollaborators, useUpsertCollaborator, useDeleteCollaborator } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Collaborator } from "@/types/database";
import { Search, Plus, UserCircle, X, Key, Eye, EyeOff, BellRing, BellOff, Building2 } from "lucide-react";
import { usePushDevicesByUser } from "@/hooks/useNotificationPreferences";
import { useToast } from "@/hooks/use-toast";
import CollaboratorDetailDialog from "./CollaboratorDetailDialog";
import CollaboratorClientsDialog from "./CollaboratorClientsDialog";

const emptyCollab = { name: "", email: "", role: "técnico", specialty: "", access_code: "" };

const CollaboratorListView = () => {
  const { data: collaborators = [], isLoading } = useCollaborators();
  const { isAdmin } = useAuth();
  const { data: pushByUser } = usePushDevicesByUser(isAdmin);
  const upsert = useUpsertCollaborator();
  const remove = useDeleteCollaborator();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCollab);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailCollab, setDetailCollab] = useState<Collaborator | null>(null);
  const [clientsCollab, setClientsCollab] = useState<Collaborator | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [initialCode, setInitialCode] = useState("");

  const activeCollabs = collaborators.filter(c => c.active);
  const filtered = activeCollabs.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Os números da equipa (clientes, avença gerida, carga, tarefas) estão só no «Controlo» → Equipa.
  const openNew = () => { setForm(emptyCollab); setEditingId(null); setShowCode(false); setInitialCode(""); setDialogOpen(true); };
  const openEdit = async (c: Collaborator) => {
    setForm({ name: c.name, email: c.email, role: c.role, specialty: c.specialty || "", access_code: "" });
    setEditingId(c.id);
    setShowCode(false);
    setInitialCode("");
    setDialogOpen(true);
    const { data } = await supabase.from("collaborator_secrets").select("access_code").eq("collaborator_id", c.id).maybeSingle();
    if (data?.access_code) {
      setForm((f) => ({ ...f, access_code: data.access_code as string }));
      setInitialCode(data.access_code as string);
    }
  };
  const handleCardClick = (c: Collaborator) => { if (isAdmin) { void openEdit(c); } else { setDetailCollab(c); } };
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    set("access_code", code);
    setShowCode(true);
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { access_code, ...collabData } = form;
      const result = await upsert.mutateAsync({ ...collabData, ...(editingId ? { id: editingId } : {}) });
      const collabId = editingId || result?.id;

      // Only sync auth when the code actually changed (or is new)
      if (access_code && collabId && access_code !== initialCode) {
        const { data, error: fnError } = await supabase.functions.invoke("manage-collaborator-auth", {
          body: { email: form.email, access_code, collaborator_id: collabId },
        });
        let msg: string | null = data?.error ?? null;
        if (fnError) {
          try {
            const body = await (fnError as any).context?.json?.();
            msg = body?.error ?? fnError.message;
          } catch {
            msg = fnError.message;
          }
        }
        if (msg) {
          if (/weak|known to be/i.test(msg)) {
            throw new Error("Este código é demasiado comum e foi recusado por segurança. Use o botão \"Gerar\" para criar um código seguro.");
          }
          throw new Error(msg);
        }
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
        {isAdmin && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Novo Colaborador
          </button>
        )}
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
            return (
              <div key={collab.id} onClick={() => handleCardClick(collab)} className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{collab.name}</h3>
                    <p className="text-xs text-muted-foreground">{collab.role}</p>
                  </div>
                  {isAdmin && pushByUser && (() => {
                    const p = collab.user_id ? pushByUser.get(collab.user_id) : undefined;
                    return p ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/15 text-success"
                        title={`Notificações ativas em ${p.dispositivos} ${p.dispositivos === 1 ? "dispositivo" : "dispositivos"}`}>
                        <BellRing className="w-3 h-3" /> {p.dispositivos}
                      </span>
                    ) : (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" title="Sem notificações ativas no telemóvel">
                        <BellOff className="w-3 h-3" />
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{collab.email}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setClientsCollab(collab); }}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-2"
                >
                  <Building2 className="w-3.5 h-3.5" /> Ver clientes por tipo
                </button>
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
              <div>
                <label className="text-sm font-medium mb-1 block">Cargo</label>
                <input value={form.role} onChange={(e) => set("role", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" /> Código de Acesso
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showCode ? "text" : "password"}
                      value={form.access_code}
                      onChange={(e) => set("access_code", e.target.value)}
                      placeholder="Código para entrar na plataforma"
                      className="w-full px-3 py-2 pr-9 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono tracking-wider"
                    />
                    <button type="button" onClick={() => setShowCode((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground" aria-label={showCode ? "Ocultar código" : "Ver código"}>
                      {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="button" onClick={generateCode} className="px-3 py-2 rounded-lg border text-xs font-medium hover:bg-muted transition-colors whitespace-nowrap">
                    Gerar
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{editingId ? "Altere o código e guarde para atualizar o acesso do colaborador." : "Defina um código para o colaborador aceder à plataforma"}</p>
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

      {detailCollab && (
        <CollaboratorDetailDialog collaborator={detailCollab} onClose={() => setDetailCollab(null)} />
      )}

      {clientsCollab && (
        <CollaboratorClientsDialog collaborator={clientsCollab} onClose={() => setClientsCollab(null)} />
      )}
    </div>
  );
};

export default CollaboratorListView;
