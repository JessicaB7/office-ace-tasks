import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, ExternalLink, Lock, MessageCircle, UserCheck, CheckCircle2, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCollaborators, useUpsertClient } from "@/hooks/useSupabaseQuery";
import {
  useDeleteOnboarding,
  useOnboardingSecrets,
  useUpdateOnboarding,
  type Onboarding,
  type OnboardingUpdate,
} from "@/hooks/useOnboardings";
import {
  FORM_TYPES,
  answerLabel,
  checklistFor,
  fieldsFor,
  formLink,
  formMessage,
  formTypeClass,
  formTypeLabel,
} from "./onboardingConstants";
import { eur, fmtDate } from "./leadConstants";

interface Props {
  onboarding: Onboarding | null;
  onClose: () => void;
  /** Abre a ficha do cliente em "Dados de clientes" (chamado ao concluir). */
  onOpenClient?: (clientId: string) => void;
}

const IVA_FROM_LEAD: Record<string, string> = {
  isento_53: "Art.53º",
  isento_9: "Art. 9º",
  iva_mensal: "Mensal",
  iva_trimestral: "Trimestral",
};

const OnboardingDetailDialog = ({ onboarding: o, onClose, onOpenClient }: Props) => {
  const { isAdmin } = useAuth();
  const { data: collaborators = [] } = useCollaborators();
  const update = useUpdateOnboarding();
  const remove = useDeleteOnboarding();
  const upsertClient = useUpsertClient();
  const { data: secrets } = useOnboardingSecrets(o?.id ?? null, isAdmin && !!o?.submitted_at);
  const [notes, setNotes] = useState("");

  useEffect(() => setNotes(o?.notes || ""), [o?.id, o?.notes]);

  if (!o) return null;

  const answers = (o.answers || {}) as Record<string, string>;
  const name = answers.nome || o.lead?.name || "Novo cliente";
  const secretValues: Record<string, string | null | undefined> = {
    senha_at: secrets?.senha_at,
    senha_ss: secrets?.senha_ss,
    utilizador_faturacao: secrets?.utilizador_faturacao,
    senha_faturacao: secrets?.senha_faturacao,
  };

  const patch = (p: OnboardingUpdate, ok?: string) =>
    update.mutate(
      { id: o.id, ...p },
      {
        onSuccess: () => ok && toast.success(ok),
        onError: (e) => toast.error(e.message || "Não foi possível guardar."),
      }
    );

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ok);
    } catch {
      toast.error("Não foi possível copiar.");
    }
    if (!o.form_sent_at) patch({ form_sent_at: new Date().toISOString() });
  };

  const createClient = async (): Promise<string | null> => {
    if (!o.data_inicio) {
      toast.error("Indica a data de início do contrato antes de criar o cliente.");
      return null;
    }
    const tipo = FORM_TYPES.find((t) => t.id === o.form_type)?.tipoContabilidade || "TI RS";
    try {
      const client = await upsertClient.mutateAsync({
        name,
        nif: answers.nif || null,
        niss: answers.niss || null,
        email: answers.email || o.lead?.email || null,
        phone: o.lead?.phone || null,
        address: answers.morada || null,
        programa_faturacao: answers.usa_programa === "sim" ? answers.programa || null : null,
        mensalidade: o.lead?.estimated_value ?? null,
        inicio_contrato: o.data_inicio,
        tipo_contabilidade: tipo,
        fiscal_regime: o.form_type === "ti_rs" ? "simplificado" : "organizado",
        iva: o.lead?.iva_framework ? IVA_FROM_LEAD[o.lead.iva_framework] ?? null : null,
        responsavel_id: o.responsavel_id,
        notes: answers.informacoes || null,
        status: "ativo",
      });
      patch({ client_id: client.id }, "Cliente criado em Dados de clientes.");
      return client.id as string;
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível criar o cliente.");
      return null;
    }
  };

  const save = async () => {
    try {
      if (notes !== (o.notes || "")) await update.mutateAsync({ id: o.id, notes: notes || null });
      toast.success("Alterações guardadas.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível guardar.");
    }
  };

  // Conclui o processo e abre a ficha do cliente para completar os dados em falta
  const complete = async () => {
    const clientId = o.client_id ?? (await createClient());
    if (!clientId) return;
    try {
      await update.mutateAsync({
        id: o.id,
        completed_at: new Date().toISOString(),
        ...(notes !== (o.notes || "") ? { notes: notes || null } : {}),
      });
      toast.success("Processo concluído. Completa os dados do cliente.");
      onClose();
      onOpenClient?.(clientId);
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível concluir.");
    }
  };

  const checklist = checklistFor(o.form_type);
  const done = checklist.filter((c) => o[c.key]).length;

  return (
    <Dialog open={!!o} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle>{name}</DialogTitle>
            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", formTypeClass(o.form_type))}>
              {formTypeLabel(o.form_type)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Mensalidade {eur(o.lead?.estimated_value)} · Ganho em {fmtDate(o.created_at.slice(0, 10))}
          </p>
        </DialogHeader>

        {/* 1. Formulário */}
        <section className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">1. Formulário do cliente</h3>
            {!o.submitted_at && (
              <Select value={o.form_type} onValueChange={(v) => patch({ form_type: v })}>
                <SelectTrigger className="h-8 w-auto text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORM_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {o.submitted_at ? (
            <p className="text-xs text-success font-medium">
              Respondido em {new Date(o.submitted_at).toLocaleString("pt-PT")}
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {o.form_sent_at
                  ? `Enviado em ${new Date(o.form_sent_at).toLocaleDateString("pt-PT")} — à espera da resposta.`
                  : "Envia o link ao cliente por WhatsApp ou e-mail."}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => copy(formMessage(name, o.token), "Mensagem copiada.")}>
                  <MessageCircle className="w-4 h-4 mr-1.5" /> Copiar mensagem
                </Button>
                <Button size="sm" variant="outline" onClick={() => copy(formLink(o.token), "Link copiado.")}>
                  <Copy className="w-4 h-4 mr-1.5" /> Copiar link
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={formLink(o.token)} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir
                  </a>
                </Button>
              </div>
            </>
          )}

          {o.submitted_at && (
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 pt-1">
              {fieldsFor(o.form_type, answers).map((f) => (
                <div key={f.key} className={cn(f.kind === "textarea" && "sm:col-span-2")}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    {f.label} {f.secret && <Lock className="w-3 h-3" />}
                  </dt>
                  <dd className="text-sm whitespace-pre-wrap break-words">
                    {f.secret
                      ? isAdmin
                        ? secretValues[f.key] || "—"
                        : <span className="text-muted-foreground italic">Visível apenas para o admin</span>
                      : answerLabel(f, answers[f.key])}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* 2. Checklist */}
        <section className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">2. Checklist</h3>
            <span className="text-xs text-muted-foreground">{done}/{checklist.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${(done / checklist.length) * 100}%` }} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {checklist.map((c) => (
              <label
                key={c.key}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  o[c.key] ? "bg-success/5 border-success/30" : "hover:border-primary/40"
                )}
              >
                <Checkbox checked={o[c.key]} onCheckedChange={(v) => patch({ [c.key]: !!v })} className="mt-0.5" />
                <span>
                  <span className={cn("block text-sm font-medium", o[c.key] && "line-through text-muted-foreground")}>
                    {c.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* 3. Dados */}
        <section className="rounded-xl border p-4 grid sm:grid-cols-2 gap-4">
          <h3 className="font-semibold text-sm sm:col-span-2">3. Dados do contrato</h3>
          <div>
            <Label>Data de início</Label>
            <Input type="date" value={o.data_inicio || ""} onChange={(e) => patch({ data_inicio: e.target.value || null })} />
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={o.responsavel_id || "none"} onValueChange={(v) => patch({ responsavel_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não definido</SelectItem>
                {collaborators.filter((c) => c.active).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Notas internas</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (o.notes || "") && patch({ notes: notes || null })}
            />
          </div>
        </section>

        <DialogFooter className="gap-2 sm:justify-between flex-wrap">
          <div>
            {isAdmin && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (!window.confirm(`Apagar o processo de ${name}? A lead mantém-se.`)) return;
                  remove.mutate(o.id, { onSuccess: () => { toast.success("Processo apagado."); onClose(); } });
                }}
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Apagar
              </Button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {!o.client_id && (
              <Button variant="outline" onClick={() => createClient()} disabled={upsertClient.isPending || !o.submitted_at}
                title={!o.submitted_at ? "Disponível depois de o cliente responder ao formulário" : undefined}>
                <UserCheck className="w-4 h-4 mr-1.5" /> Criar cliente
              </Button>
            )}
            {o.client_id && (
              <span className="self-center text-xs text-success font-medium flex items-center gap-1">
                <UserCheck className="w-4 h-4" /> Cliente criado
              </span>
            )}
            {o.completed_at ? (
              <Button variant="outline" onClick={() => patch({ completed_at: null }, "Processo reaberto.")}>
                <RotateCcw className="w-4 h-4 mr-1.5" /> Reabrir
              </Button>
            ) : (
              <Button onClick={complete} disabled={update.isPending || upsertClient.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Concluir
              </Button>
            )}
            <Button variant="outline" onClick={save} disabled={update.isPending}>
              <Save className="w-4 h-4 mr-1.5" /> Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingDetailDialog;
