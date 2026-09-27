import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Clock, FileCheck2, CheckCircle2, Copy, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCollaborators } from "@/hooks/useSupabaseQuery";
import { useOnboardings, useUpdateOnboarding, type Onboarding } from "@/hooks/useOnboardings";
import { checklistFor, formMessage, formTypeClass, formTypeLabel } from "./onboardingConstants";
import { eur, fmtDate } from "./leadConstants";
import OnboardingDetailDialog from "./OnboardingDetailDialog";

type Tab = "a_tratar" | "concluidos";

const stateOf = (o: Onboarding) =>
  o.completed_at ? "concluido" : o.submitted_at ? "recebido" : o.form_sent_at ? "enviado" : "por_enviar";

const STATE_META = {
  por_enviar: { label: "Formulário por enviar", icon: Clock, className: "bg-muted text-muted-foreground" },
  enviado: { label: "À espera do cliente", icon: Clock, className: "bg-warning/15 text-warning-foreground" },
  recebido: { label: "Formulário recebido", icon: FileCheck2, className: "bg-info/15 text-info" },
  concluido: { label: "Concluído", icon: CheckCircle2, className: "bg-success/15 text-success" },
} as const;

const NovosClientesView = () => {
  const { data: onboardings = [], isLoading } = useOnboardings();
  const { data: collaborators = [] } = useCollaborators();
  const update = useUpdateOnboarding();
  const [tab, setTab] = useState<Tab>("a_tratar");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = onboardings.find((o) => o.id === selectedId) || null;
  const nameOf = (o: Onboarding) => (o.answers as Record<string, string>)?.nome || o.lead?.name || "Novo cliente";
  const collabName = (id: string | null) => collaborators.find((c) => c.id === id)?.name;

  const q = search.trim().toLowerCase();
  const filtered = onboardings.filter((o) => (tab === "concluidos" ? !!o.completed_at : !o.completed_at) &&
    (!q || nameOf(o).toLowerCase().includes(q)));
  const openCount = onboardings.filter((o) => !o.completed_at).length;
  const doneCount = onboardings.length - openCount;

  const copyMessage = async (o: Onboarding) => {
    try {
      await navigator.clipboard.writeText(formMessage(nameOf(o), o.token));
      toast.success("Mensagem com o link copiada.");
      if (!o.form_sent_at) update.mutate({ id: o.id, form_sent_at: new Date().toISOString() });
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Novos clientes</h1>
          <p className="text-sm text-muted-foreground">
            Leads ganhas e consultorias com serviço mensal: formulário para o contrato e checklist de entrada
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {([["a_tratar", "A tratar", openCount], ["concluidos", "Concluídos", doneCount]] as const).map(([id, label, n]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                tab === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label} <span className="ml-1 text-xs text-muted-foreground">{n}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Procurar cliente…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {tab === "a_tratar"
            ? "Sem novos clientes a tratar. Quando uma lead passar a \"Ganho\" (ou uma consultoria a \"Serviço mensal sim\"), o processo aparece aqui automaticamente."
            : "Ainda não há processos concluídos."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((o) => {
          const state = STATE_META[stateOf(o)];
          const checklist = checklistFor(o.form_type);
          const done = checklist.filter((c) => o[c.key]).length;
          const resp = collabName(o.responsavel_id);
          return (
            <Card key={o.id} className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all" onClick={() => setSelectedId(o.id)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight truncate">{nameOf(o)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {eur(o.lead?.estimated_value)}/mês{resp ? ` · ${resp}` : ""}
                    </p>
                  </div>
                  <span className={cn("shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium", formTypeClass(o.form_type))}>
                    {formTypeLabel(o.form_type).replace("Contabilidade ", "")}
                  </span>
                </div>

                <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium", state.className)}>
                  <state.icon className="w-3.5 h-3.5" /> {state.label}
                </span>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Checklist</span>
                    <span>{done}/{checklist.length}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(done / checklist.length) * 100}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                  <span>{o.data_inicio ? `Início ${fmtDate(o.data_inicio)}` : "Sem data de início"}</span>
                  {o.client_id ? (
                    <span className="flex items-center gap-1 text-success font-medium"><UserCheck className="w-3.5 h-3.5" /> Cliente criado</span>
                  ) : !o.submitted_at ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); copyMessage(o); }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar mensagem
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <OnboardingDetailDialog onboarding={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
};

export default NovosClientesView;
