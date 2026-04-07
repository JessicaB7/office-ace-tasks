import { useState, useEffect } from "react";
import { useCollaborators, useUpsertClient, useDeleteClient } from "@/hooks/useSupabaseQuery";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TIPO_CONTAB_OPTIONS = [
  { value: "SQ", label: "Empresa (SQ)" },
  { value: "TI RS", label: "TI Simplificado" },
  { value: "TI CO", label: "TI Organizado" },
];

const SALARIOS_OPTIONS = [
  { value: "", label: "Não aplicável" },
  { value: "Sim até dia 25", label: "Até dia 25" },
  { value: "Sim até ao fim do mês", label: "Até ao fim do mês" },
];

const SS_OPTIONS = [
  { value: "", label: "— Selecionar —" },
  { value: "Mensal", label: "Mensal" },
  { value: "Trimestral", label: "Trimestral" },
  { value: "Contabilidade Organizada", label: "Cont. Organizada" },
  { value: "TCO", label: "TCO" },
  { value: "Isento", label: "Isento" },
];

const IVA_OPTIONS = [
  { value: "", label: "— Selecionar —" },
  { value: "Mensal", label: "Mensal" },
  { value: "Trimestral", label: "Trimestral" },
  { value: "Art. 9º", label: "Isenção Art. 9º" },
  { value: "Art.53º", label: "Isenção Art. 53º" },
];

const RECAPITULATIVA_OPTIONS = [
  { value: "", label: "— Selecionar —" },
  { value: "Mensal", label: "Mensal" },
  { value: "Trimestral", label: "Trimestral" },
  { value: "Não Aplicável", label: "Não Aplicável" },
];

const FATURACAO_OPTIONS = [
  { value: "", label: "— Selecionar —" },
  { value: "Emitir", label: "Emitir" },
  { value: "Não Aplicável", label: "Não aplicável" },
];

const SAFT_OPTIONS = [
  { value: "", label: "— Selecionar —" },
  { value: "Automático", label: "Automático" },
  { value: "A entregar", label: "A entregar" },
  { value: "Não Aplicável", label: "Não Aplicável" },
];

const PAG_SS_OPTIONS = [
  { value: "", label: "— Selecionar —" },
  { value: "Referência", label: "Referência" },
  { value: "Débito Direto", label: "Débito Direto" },
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

const emptyForm: ClientForm = {
  name: "", nif: "", tipo_contabilidade: "SQ", salarios: "", mensalidade: "",
  inicio_contrato: "", responsavel_id: "",
  seguranca_social: "", pag_seguranca_social: "", iva: "", recapitulativa: "", faturacao: "", saft: "",
};

interface ClientDetailDialogProps {
  client: any | null;
  open: boolean;
  onClose: () => void;
  allowDelete?: boolean;
}

const ClientDetailDialog = ({ client, open, onClose, allowDelete = true }: ClientDetailDialogProps) => {
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertClient();
  const remove = useDeleteClient();
  const { toast } = useToast();
  const [form, setForm] = useState<ClientForm>(emptyForm);

  const isEditing = !!client;

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name, nif: client.nif || "",
        tipo_contabilidade: client.tipo_contabilidade || "SQ",
        salarios: client.salarios || "",
        mensalidade: client.mensalidade ? String(client.mensalidade) : "",
        inicio_contrato: client.inicio_contrato || "",
        responsavel_id: client.responsavel_id || "",
        seguranca_social: client.seguranca_social || "",
        pag_seguranca_social: client.pag_seguranca_social || "",
        iva: client.iva || "",
        recapitulativa: client.recapitulativa || "",
        faturacao: client.faturacao || "",
        saft: client.saft || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [client]);

  if (!open) return null;

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

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
      if (isEditing) payload.id = client.id;
      await upsert.mutateAsync(payload);
      onClose();
      toast({ title: isEditing ? "Cliente atualizado" : "Cliente criado", description: form.name });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    try {
      await remove.mutateAsync(client.id);
      onClose();
      toast({ title: "Cliente eliminado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold">{isEditing ? "Ficha de Cliente" : "Novo Cliente"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
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
              {upsert.isPending ? "A guardar..." : isEditing ? "Guardar" : "Criar Cliente"}
            </button>
            {isEditing && allowDelete && (
              <button type="button" onClick={handleDelete} className="px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive font-medium text-sm hover:bg-destructive/20 transition-colors">
                Eliminar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientDetailDialog;
