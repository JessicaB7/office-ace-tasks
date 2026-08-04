export const LEAD_STAGES = [
  { id: "novo", label: "Novo" },
  { id: "contactado", label: "Contactado" },
  { id: "reuniao", label: "Reunião" },
  { id: "proposta", label: "Proposta enviada" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
] as const;

export const stageLabel = (id: string) => LEAD_STAGES.find((s) => s.id === id)?.label || id;

export const stageClass = (id: string) => {
  switch (id) {
    case "ganho":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
    case "perdido":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "proposta":
      return "bg-amber-500/10 text-amber-700 border-amber-500/30";
    case "reuniao":
      return "bg-blue-500/10 text-blue-700 border-blue-500/30";
    case "contactado":
      return "bg-primary/10 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export const eur = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(v || 0));

export const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-PT") : "—";
