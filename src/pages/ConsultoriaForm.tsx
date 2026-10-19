import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { CONSULTORIA_FIELDS, type ConsultoriaFieldDef } from "@/components/comercial/consultoriaFormConstants";

type FormInfo = { name: string | null; phone: string | null; nif: string | null; meeting_date: string | null; submitted: boolean };
type Status = "loading" | "ready" | "invalid" | "already" | "sending" | "done" | "error";

/** Formulário público (sem login) para preparar a sessão de consultoria. */
const ConsultoriaForm = () => {
  const { token = "" } = useParams();
  const [status, setStatus] = useState<Status>("loading");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.rpc("get_consultoria_form", { _token: token }).then(({ data, error }) => {
      if (error || !data) return setStatus("invalid");
      const d = data as unknown as FormInfo;
      if (d.submitted) return setStatus("already");
      setValues({ nome: d.name || "", nif: d.nif || "", telemovel: d.phone || "" });
      setStatus("ready");
    });
  }, [token]);

  const set = (key: string, v: string) => {
    setValues((p) => ({ ...p, [key]: v }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    for (const f of CONSULTORIA_FIELDS) {
      const v = (values[f.key] || "").trim();
      if (f.required && !v) next[f.key] = "Campo obrigatório";
      else if (v && f.key === "nif" && !/^\d{9}$/.test(v.replace(/\s/g, ""))) next[f.key] = "O NIF tem 9 dígitos";
      else if (v.length > 4000) next[f.key] = "Texto demasiado longo";
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
    for (const f of CONSULTORIA_FIELDS) {
      const v = (values[f.key] || "").trim();
      if (v) answers[f.key] = f.key === "nif" ? v.replace(/\s/g, "") : v;
    }
    setStatus("sending");
    const { data, error } = await supabase.rpc("submit_consultoria_form", { _token: token, _answers: answers });
    if (error) return setStatus("error");
    setStatus(data ? "done" : "already");
  };

  const renderField = (f: ConsultoriaFieldDef) => {
    const id = `f-${f.key}`;
    const err = errors[f.key];
    return (
      <div key={f.key} className="space-y-1.5" data-error={!!err}>
        <Label htmlFor={id} className="flex items-center gap-1.5 leading-snug">
          {f.label}
          {f.required && <span className="text-primary">*</span>}
        </Label>
        {f.kind === "choice" ? (
          <div className="flex flex-wrap gap-2">
            {f.options!.map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => set(f.key, o.v)}
                className={cn(
                  "flex-1 sm:flex-none sm:min-w-28 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
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
          <Textarea id={id} rows={4} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
        ) : (
          <Input
            id={id}
            inputMode={f.key === "nif" || f.key === "telemovel" ? "numeric" : undefined}
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
            <img src={logo} alt="Contabilista Explica" className="h-14 mb-6" />
            <h1 className="text-2xl font-bold">⚡ Consultoria — as tuas dúvidas</h1>
            {status === "ready" || status === "sending" || status === "error" ? (
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Para que possamos preparar a nossa sessão antecipadamente e aproveitar o tempo da melhor forma,
                responde por favor a este breve questionário.
              </p>
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
                  {status === "done" ? "Obrigada! Recebemos as tuas respostas." : "Este formulário já foi preenchido."}
                </h2>
                <p className="text-sm text-muted-foreground">Até à nossa sessão 😊</p>
              </div>
            )}
            {status === "error" && (
              <p className="text-sm text-destructive mb-4">
                Não foi possível enviar. Tenta novamente dentro de alguns minutos.
              </p>
            )}
            {(status === "ready" || status === "sending" || status === "error") && (
              <form onSubmit={submit} className="space-y-5" noValidate>
                {CONSULTORIA_FIELDS.map(renderField)}
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

export default ConsultoriaForm;
