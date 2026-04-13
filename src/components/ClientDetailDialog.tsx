import { useState, useEffect } from "react";
import { useCollaborators, useUpsertClient, useDeleteClient } from "@/hooks/useSupabaseQuery";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const TIPO_CONTAB_OPTIONS = [
  { value: "SQ", label: "Empresa (SQ)" },
  { value: "TI RS", label: "TI Simplificado" },
  { value: "TI CO", label: "TI Organizado" },
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

const FATURACAO_FREQ_OPTIONS = [
  { value: "", label: "— Selecionar —" },
  { value: "Semanal", label: "Semanal" },
  { value: "Mensal", label: "Mensal" },
  { value: "Pontual", label: "Pontual" },
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

const tipoContabColor = (tipo: string) => {
  switch (tipo) {
    case "SQ": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "TI CO": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "TI RS": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    default: return "bg-muted text-muted-foreground";
  }
};

interface ClientForm {
  name: string;
  nif: string;
  senha_at: string;
  niss: string;
  senha_ss: string;
  programa_faturacao: string;
  utilizador_faturacao: string;
  senha_faturacao: string;
  saft: string;
  via_ctt: string;
  mensalidade: string;
  inicio_contrato: string;
  tipo_contabilidade: string;
  seguranca_social: string;
  pag_seguranca_social: string;
  iva: string;
  iva_oss: string;
  recapitulativa: string;
  faturacao: string;
  faturacao_frequencia: string;
  responsavel_id: string;
}

const emptyForm: ClientForm = {
  name: "", nif: "", senha_at: "", niss: "", senha_ss: "",
  programa_faturacao: "", utilizador_faturacao: "", senha_faturacao: "",
  saft: "", via_ctt: "", mensalidade: "", inicio_contrato: "",
  tipo_contabilidade: "SQ", seguranca_social: "", pag_seguranca_social: "",
  iva: "", iva_oss: "", recapitulativa: "", faturacao: "", faturacao_frequencia: "",
  responsavel_id: "",
};

interface ClientDetailDialogProps {
  client: any | null;
  open: boolean;
  onClose: () => void;
  allowDelete?: boolean;
}

const inputClass = "w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

const ClientDetailDialog = ({ client, open, onClose, allowDelete = true }: ClientDetailDialogProps) => {
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertClient();
  const remove = useDeleteClient();
  const { toast } = useToast();
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [activeTab, setActiveTab] = useState("dados");

  const isEditing = !!client;

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name, nif: client.nif || "",
        senha_at: client.senha_at || "",
        niss: client.niss || "",
        senha_ss: client.senha_ss || "",
        programa_faturacao: client.programa_faturacao || "",
        utilizador_faturacao: client.utilizador_faturacao || "",
        senha_faturacao: client.senha_faturacao || "",
        saft: client.saft || "",
        via_ctt: client.via_ctt || "",
        mensalidade: client.mensalidade ? String(client.mensalidade) : "",
        inicio_contrato: client.inicio_contrato || "",
        tipo_contabilidade: client.tipo_contabilidade || "SQ",
        seguranca_social: client.seguranca_social || "",
        pag_seguranca_social: client.pag_seguranca_social || "",
        iva: client.iva || "",
        iva_oss: client.iva_oss || "",
        recapitulativa: client.recapitulativa || "",
        faturacao: client.faturacao || "",
        faturacao_frequencia: client.faturacao_frequencia || "",
        responsavel_id: client.responsavel_id || "",
      });
    } else {
      setForm(emptyForm);
    }
    setActiveTab("dados");
  }, [client]);

  if (!open) return null;

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: form.name,
        nif: form.nif || null,
        senha_at: form.senha_at || null,
        niss: form.niss || null,
        senha_ss: form.senha_ss || null,
        programa_faturacao: form.programa_faturacao || null,
        utilizador_faturacao: form.utilizador_faturacao || null,
        senha_faturacao: form.senha_faturacao || null,
        saft: form.saft || null,
        via_ctt: form.via_ctt || null,
        mensalidade: form.mensalidade ? parseFloat(form.mensalidade) : null,
        inicio_contrato: form.inicio_contrato || null,
        tipo_contabilidade: form.tipo_contabilidade,
        seguranca_social: form.seguranca_social || null,
        pag_seguranca_social: form.pag_seguranca_social || null,
        iva: form.iva || null,
        iva_oss: form.iva_oss || null,
        recapitulativa: form.recapitulativa || null,
        faturacao: form.faturacao || null,
        faturacao_frequencia: form.faturacao === "Emitir" ? (form.faturacao_frequencia || null) : null,
        responsavel_id: form.responsavel_id || null,
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

  const tipoLabel = TIPO_CONTAB_OPTIONS.find(o => o.value === form.tipo_contabilidade)?.label || form.tipo_contabilidade;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">{isEditing ? "Ficha de Cliente" : "Novo Cliente"}</h3>
            {isEditing && form.tipo_contabilidade && (
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", tipoContabColor(form.tipo_contabilidade))}>
                {tipoLabel}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSave}>
          {/* Name field always visible at top */}
          <div className="px-5 pt-5 pb-2">
            <label className="text-sm font-medium mb-1 block">Nome <span className="text-destructive">*</span></label>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-5">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="enquadramento" className="flex-1">Enquadramento</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">NIF</label>
                  <input maxLength={9} value={form.nif} onChange={(e) => set("nif", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Senha AT</label>
                  <input value={form.senha_at} onChange={(e) => set("senha_at", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">NISS</label>
                  <input value={form.niss} onChange={(e) => set("niss", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Senha SS</label>
                  <input value={form.senha_ss} onChange={(e) => set("senha_ss", e.target.value)} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Programa de Faturação</label>
                  <input value={form.programa_faturacao} onChange={(e) => set("programa_faturacao", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Utilizador</label>
                  <input value={form.utilizador_faturacao} onChange={(e) => set("utilizador_faturacao", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Senha</label>
                  <input value={form.senha_faturacao} onChange={(e) => set("senha_faturacao", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">SAFT</label>
                  <select value={form.saft} onChange={(e) => set("saft", e.target.value)} className={inputClass}>
                    {SAFT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Via CTT</label>
                  <input value={form.via_ctt} onChange={(e) => set("via_ctt", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Mensalidade (€)</label>
                  <input type="number" step="0.01" min="0" value={form.mensalidade} onChange={(e) => set("mensalidade", e.target.value)} placeholder="0,00" className={inputClass} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Início de Contrato</label>
                  <input type="date" value={form.inicio_contrato} onChange={(e) => set("inicio_contrato", e.target.value)} className={inputClass} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="enquadramento" className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Tipo de Contabilidade <span className="text-destructive">*</span></label>
                  <select required value={form.tipo_contabilidade} onChange={(e) => set("tipo_contabilidade", e.target.value)} className={inputClass}>
                    {TIPO_CONTAB_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Segurança Social</label>
                  <select value={form.seguranca_social} onChange={(e) => set("seguranca_social", e.target.value)} className={inputClass}>
                    {SS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Pag. Segurança Social</label>
                  <select value={form.pag_seguranca_social} onChange={(e) => set("pag_seguranca_social", e.target.value)} className={inputClass}>
                    {PAG_SS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">IVA</label>
                  <select value={form.iva} onChange={(e) => set("iva", e.target.value)} className={inputClass}>
                    {IVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">IVA OSS</label>
                  <select value={form.iva_oss} onChange={(e) => set("iva_oss", e.target.value)} className={inputClass}>
                    <option value="">— Selecionar —</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">IVA - Recapitulativa</label>
                  <select value={form.recapitulativa} onChange={(e) => set("recapitulativa", e.target.value)} className={inputClass}>
                    {RECAPITULATIVA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Faturação</label>
                  <select value={form.faturacao} onChange={(e) => set("faturacao", e.target.value)} className={inputClass}>
                    {FATURACAO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {form.faturacao === "Emitir" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Frequência</label>
                    <select value={form.faturacao_frequencia} onChange={(e) => set("faturacao_frequencia", e.target.value)} className={inputClass}>
                      {FATURACAO_FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-1 block">SAFT (Enquadramento)</label>
                  <select value={form.saft} onChange={(e) => set("saft", e.target.value)} className={inputClass}>
                    {SAFT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Responsável</label>
                  <select value={form.responsavel_id} onChange={(e) => set("responsavel_id", e.target.value)} className={inputClass}>
                    <option value="">— Selecionar —</option>
                    {collaborators.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3 p-5 pt-4">
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
