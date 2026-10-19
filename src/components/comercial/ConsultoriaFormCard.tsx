import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMarkConsultoriaFormSent, type ConsultoriaForm } from "@/hooks/useConsultoriaForms";
import { CONSULTORIA_FIELDS, answerLabel, consultoriaFormLink, consultoriaFormMessage } from "./consultoriaFormConstants";

/** Respostas do formulário de consultoria, só leitura. */
export const ConsultoriaAnswers = ({ form }: { form: ConsultoriaForm }) => {
  const answers = (form.answers || {}) as Record<string, string>;
  return (
    <dl className="space-y-2.5">
      {CONSULTORIA_FIELDS.map((f) => {
        const v = answerLabel(f, answers[f.key]);
        if (!v) return null;
        return (
          <div key={f.key}>
            <dt className="text-xs text-muted-foreground">{f.label}</dt>
            <dd className="text-sm whitespace-pre-wrap">{v}</dd>
          </div>
        );
      })}
    </dl>
  );
};

/** Formulário de consultoria de uma lead: enviar o link ou ver as respostas. */
const ConsultoriaFormCard = ({ form, name, sessionDate }: { form: ConsultoriaForm; name: string; sessionDate?: string | null }) => {
  const markSent = useMarkConsultoriaFormSent();

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ok);
    } catch {
      toast.error("Não foi possível copiar.");
    }
    if (!form.form_sent_at) markSent.mutate(form.id);
  };

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Formulário da consultoria</p>
        {form.submitted_at ? (
          <span className="text-xs text-success font-medium">
            Respondido em {new Date(form.submitted_at).toLocaleDateString("pt-PT")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {form.form_sent_at
              ? `Enviado em ${new Date(form.form_sent_at).toLocaleDateString("pt-PT")} — à espera da resposta`
              : "Ainda não enviado"}
          </span>
        )}
      </div>
      {form.submitted_at ? (
        <ConsultoriaAnswers form={form} />
      ) : (
        <div className="flex gap-2 flex-wrap">
          <Button type="button" size="sm" onClick={() => copy(consultoriaFormMessage(name, form.token, sessionDate), "Mensagem copiada.")}>
            <MessageCircle className="w-4 h-4 mr-1.5" /> Copiar mensagem
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => copy(consultoriaFormLink(form.token), "Link copiado.")}>
            <Copy className="w-4 h-4 mr-1.5" /> Copiar link
          </Button>
          <Button type="button" size="sm" variant="ghost" asChild>
            <a href={consultoriaFormLink(form.token)} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4 mr-1.5" /> Abrir
            </a>
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConsultoriaFormCard;
