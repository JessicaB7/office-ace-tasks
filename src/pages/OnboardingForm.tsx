import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { fieldsFor, formTypeLabel, type FieldDef } from "@/components/comercial/onboardingConstants";

type FormInfo = { form_type: string; name: string | null; email: string | null; submitted: boolean };
type Status = "loading" | "ready" | "invalid" | "already" | "sending" | "done" | "error";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Formulário público (sem login) com os dados para o contrato de um novo cliente. */
const OnboardingForm = () => {
  const { token = "" } = useParams();
  const [status, setStatus] = useState<Status>("loading");
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.rpc("get_onboarding_form", { _token: token }).then(({ data, error }) => {
      if (error || !data) return setStatus("invalid");
      const d = data as unknown as FormInfo;
      setInfo(d);
      if (d.submitted) return setStatus("already");
      setValues({ nome: d.name || "", email: d.email || "" });
      setStatus("ready");
    });
  }, [token]);

  const fields = useMemo(() => (info ? fieldsFor(info.form_type, values) : []), [info, values]);

  const set = (key: string, v: string) => {
    setValues((p) => ({ ...p, [key]: v }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.key] || "").trim();
      if (f.required && !v) next[f.key] = "Campo obrigatório";
      else if (v && f.kind === "email" && !EMAIL_RE.test(v)) next[f.key] = "E-mail inválido";
      else if (v.length > 2000) next[f.key] = "Texto demasiado longo";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      document.querySelector("[data-error='true']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const answers: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.key] || "").trim();
      if (!v) continue;
      (f.secret ? secrets : answers)[f.key] = v;
    }
    setStatus("sending");
    const { data, error } = await supabase.rpc("submit_onboarding_form", {
      _token: token,
      _answers: answers,
      _secrets: secrets,
    });
    if (error) return setStatus("error");
    setStatus(data ? "done" : "already");
  };

  const renderField = (f: FieldDef) => {
    const id = `f-${f.key}`;
    const err = errors[f.key];
    return (
      <div key={`${f.key}-${f.label}`} className="space-y-1.5" data-error={!!err}>
        <Label htmlFor={id} className="flex items-center gap-1.5">
          {f.label}
          {f.required && <span className="text-primary">*</span>}
          {f.secret && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Informação protegida" />}
        </Label>
        {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
        {f.kind === "yesno" ? (
          <div className="flex gap-2">
            {[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => set(f.key, o.v)}
                className={cn(
                  "flex-1 sm:flex-none sm:w-28 py-2 rounded-lg border text-sm font-medium transition-colors",
                  values[f.key] === o.v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:border-primary/50"
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        ) : f.kind === "textarea" ? (
          <Textarea id={id} rows={3} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
        ) : (
          <Input
            id={id}
            type={f.kind === "email" ? "email" : "text"}
            autoComplete="off"
            value={values[f.key] || ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary h-40 sm:h-48" />
      <div className="max-w-2xl mx-auto px-4 -mt-28 sm:-mt-32 pb-12">
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b">
            <img src={logo} alt="Contabilista Explica" className="h-10 mb-6" />
            <h1 className="text-2xl font-bold">📩 Informações novo cliente</h1>
            {info && <p className="text-sm text-primary font-medium mt-1">{formTypeLabel(info.form_type)}</p>}
            {status === "ready" || status === "sending" ? (
              <div className="mt-4 space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>Desde já obrigada pelo voto de confiança!</p>
                <p>
                  Para darmos início ao serviço mensal, precisamos de algumas informações para elaborar o contrato e
                  verificar todo o enquadramento do teu negócio.
                </p>
                <p>
                  Neste serviço terás o suporte de uma equipa de contabilistas certificados disponíveis para tratarem
                  dos impostos e obrigações fiscais do teu negócio. Gratos pela confiança depositada 💰
                </p>
              </div>
            ) : null}
          </div>

          <div className="p-6 sm:p-8">
            {status === "loading" && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> A carregar…
              </div>
            )}
            {status === "invalid" && (
              <p className="text-sm text-muted-foreground">
                Este link não é válido. Confirma o link que recebeste ou contacta-nos.
              </p>
            )}
            {(status === "already" || status === "done") && (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto" />
                <h2 className="text-lg font-semibold">
                  {status === "done" ? "Obrigada! Recebemos as tuas informações." : "Este formulário já foi preenchido."}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Vamos preparar o contrato e entraremos em contacto contigo muito em breve 😊
                </p>
              </div>
            )}
            {status === "error" && (
              <p className="text-sm text-destructive mb-4">
                Não foi possível enviar. Tenta novamente dentro de alguns minutos.
              </p>
            )}
            {(status === "ready" || status === "sending" || status === "error") && (
              <form onSubmit={submit} className="space-y-5" noValidate>
                {fields.map(renderField)}
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>As senhas são guardadas de forma protegida e apenas acessíveis à responsável do gabinete.</span>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={status === "sending"}>
                  {status === "sending" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enviar
                </Button>
              </form>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">Contabilista Explica</p>
      </div>
    </div>
  );
};

export default OnboardingForm;
