import { useMemo, useState } from "react";
import { Mail, Phone, MessageCircle, Users, FileQuestion, StickyNote, Send, UserCog, ClipboardList, Search, Plus, Trash2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentCollaborator } from "@/hooks/useCurrentCollaborator";
import { useAddContact, useClientTimeline, useDeleteContact } from "@/hooks/useClientContacts";
import { CONTACT_TIPOS, contactTipoLabel, filtrarTimeline, type ContactTipo } from "@/lib/clientContacts";

const ICONS: Record<string, typeof Mail> = {
  email: Mail,
  chamada: Phone,
  whatsapp: MessageCircle,
  reuniao: Users,
  pedido_documentos: FileQuestion,
  outro: StickyNote,
  email_app: Send,
  responsavel: UserCog,
  nota_obrigacao: ClipboardList,
};

const inputClass = "w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring";
const hoje = () => new Date().toLocaleDateString("sv-SE");
const fmtData = (iso: string, comHora = false) =>
  new Date(iso).toLocaleDateString("pt-PT", comHora
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" });

/** Separador "Histórico" da ficha de cliente: linha do tempo de contactos (mais recentes primeiro). */
const ClientHistoricoTab = ({ clientId }: { clientId: string }) => {
  const { user, isAdmin } = useAuth();
  const me = useCurrentCollaborator();
  const { data: entries = [], isLoading } = useClientTimeline(clientId);
  const add = useAddContact();
  const del = useDeleteContact();
  const [tipoFiltro, setTipoFiltro] = useState("all");
  const [pesquisa, setPesquisa] = useState("");
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ tipo: "chamada" as ContactTipo, data: hoje(), resumo: "", seguimento_em: "" });

  const lista = useMemo(() => filtrarTimeline(entries, tipoFiltro, pesquisa), [entries, tipoFiltro, pesquisa]);

  const guardar = () => {
    if (!form.resumo.trim()) {
      toast.error("Escreve um resumo do contacto.");
      return;
    }
    add.mutate(
      {
        client_id: clientId,
        collaborator_id: me?.id ?? null,
        tipo: form.tipo,
        data: form.data || hoje(),
        resumo: form.resumo.trim(),
        seguimento_em: form.seguimento_em || null,
      },
      {
        onSuccess: () => {
          toast.success(form.seguimento_em ? "Contacto registado e tarefa de seguimento criada." : "Contacto registado.");
          setForm({ tipo: "chamada", data: hoje(), resumo: "", seguimento_em: "" });
          setAberto(false);
        },
        onError: (e: Error) => toast.error("Erro ao registar: " + e.message),
      },
    );
  };

  return (
    // Enter num campo não pode submeter o formulário da ficha de cliente (este separador está dentro dele).
    <div className="space-y-3 pt-2" onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}>
      {!aberto ? (
        <button type="button" onClick={() => setAberto(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm font-medium text-primary hover:bg-primary/5">
          <Plus className="w-4 h-4" /> Registar contacto
        </button>
      ) : (
        <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium mb-1 block">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as ContactTipo }))} className={inputClass}>
                {CONTACT_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Resumo</label>
            <textarea rows={3} value={form.resumo} onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
              placeholder="O que se falou / pediu..." className={cn(inputClass, "resize-y")} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Seguimento em (opcional)</label>
            <input type="date" value={form.seguimento_em} onChange={(e) => setForm((f) => ({ ...f, seguimento_em: e.target.value }))} className={inputClass} />
            <p className="text-[11px] text-muted-foreground mt-1">Com data, cria uma tarefa para ti com esse prazo.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAberto(false)} className="px-3 py-1.5 text-sm rounded-lg border hover:bg-muted">Cancelar</button>
            <button type="button" onClick={guardar} disabled={add.isPending}
              className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50">
              {add.isPending ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} placeholder="Pesquisar no histórico..."
            className={cn(inputClass, "pl-8 py-1.5")} />
        </div>
        <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className={cn(inputClass, "w-40 py-1.5")} aria-label="Filtrar por tipo">
          <option value="all">Todos os tipos</option>
          {CONTACT_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          <option value="email_app">Emails da app</option>
          <option value="responsavel">Responsável</option>
          <option value="nota_obrigacao">Notas de obrigações</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">A carregar...</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sem registos{pesquisa || tipoFiltro !== "all" ? " com estes filtros" : ""}.</p>
      ) : (
        <ol className="relative border-l ml-3 space-y-3 max-h-[45vh] overflow-y-auto pr-1">
          {lista.map((e) => {
            const Icon = ICONS[e.tipo] || StickyNote;
            const podeApagar = e.origem === "contacto" && (isAdmin || e.created_by === user?.id);
            return (
              <li key={`${e.origem}-${e.id}`} className="ml-5">
                <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-card border">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </span>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {fmtData(e.quando, e.origem !== "contacto")} · {contactTipoLabel(e.tipo)}{e.autor ? ` · ${e.autor}` : ""}
                    </p>
                    {e.titulo && <p className="text-sm font-medium">{e.titulo}</p>}
                    {e.resumo && <p className="text-sm whitespace-pre-wrap break-words">{e.resumo}</p>}
                    {e.seguimento_em && (
                      <p className="text-xs text-primary mt-0.5 inline-flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Seguimento a {fmtData(`${e.seguimento_em}T12:00:00`)}
                      </p>
                    )}
                  </div>
                  {podeApagar && (
                    <button type="button" title="Apagar contacto" aria-label="Apagar contacto"
                      onClick={() => del.mutate({ id: e.id, clientId }, { onError: (err: Error) => toast.error(err.message) })}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default ClientHistoricoTab;
