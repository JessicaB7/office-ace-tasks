export const LEAD_STAGES = [
  { id: "reuniao_agendada", label: "Reunião agendada" },
  { id: "proposta_enviada", label: "Proposta enviada" },
  { id: "followup", label: "Follow up" },
  { id: "ganho", label: "Ganho" },
  { id: "perda", label: "Perda" },
] as const;

export const CONSULTORIA_STAGES = [
  { id: "reuniao_agendada", label: "Reunião agendada" },
  { id: "resumo_enviado", label: "Resumo enviado" },
  { id: "followup", label: "Follow up" },
  { id: "mensal_sim", label: "Serviço mensal sim" },
  { id: "mensal_nao", label: "Serviço mensal não" },
] as const;

export const stagesFor = (segment?: string) =>
  segment === "consultoria" ? CONSULTORIA_STAGES : LEAD_STAGES;

export const closedStagesFor = (segment?: string) =>
  segment === "consultoria" ? ["mensal_sim", "mensal_nao"] : ["ganho", "perda"];

export const BUSINESS_TYPES = [
  { id: "ti_rs", label: "TI RS" },
  { id: "ti_co", label: "TI CO" },
  { id: "empresa", label: "Empresa" },
] as const;

export const IVA_FRAMEWORKS = [
  { id: "isento_53", label: "Isento art.º 53º" },
  { id: "isento_9", label: "Isento art.º 9º" },
  { id: "iva_mensal", label: "IVA mensal" },
  { id: "iva_trimestral", label: "IVA trimestral" },
] as const;

export const businessTypeLabel = (id: string | null) =>
  BUSINESS_TYPES.find((t) => t.id === id)?.label || "—";

export const ivaFrameworkLabel = (id: string | null) =>
  IVA_FRAMEWORKS.find((t) => t.id === id)?.label || "—";

export const stageLabel = (id: string) =>
  [...LEAD_STAGES, ...CONSULTORIA_STAGES].find((s) => s.id === id)?.label || id;

export const stageClass = (id: string) => {
  switch (id) {
    case "ganho":
    case "mensal_sim":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
    case "perda":
    case "mensal_nao":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "proposta_enviada":
    case "resumo_enviado":
      return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    case "followup":
      return "bg-blue-500/10 text-blue-700 border-blue-500/30";
    case "reuniao_agendada":
      return "bg-primary/10 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export const eur = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(v || 0));

export const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-PT") : "—";
