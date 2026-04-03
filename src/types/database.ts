import type { Database } from "@/integrations/supabase/types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type Collaborator = Database["public"]["Tables"]["collaborators"]["Row"];
export type CollaboratorInsert = Database["public"]["Tables"]["collaborators"]["Insert"];
export type DbTask = Database["public"]["Tables"]["tasks"]["Row"];
export type DbTaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type FiscalDeadline = Database["public"]["Tables"]["fiscal_deadlines"]["Row"];

export type FiscalRegime = Database["public"]["Enums"]["fiscal_regime"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type TaskCategory = Database["public"]["Enums"]["task_category"];

export const REGIME_LABELS: Record<FiscalRegime, string> = {
  simplificado: "Simplificado",
  organizado: "Organizado",
  isento: "Isento",
  misto: "Misto",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: "Pendente",
  em_progresso: "Em Progresso",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  IRS: "IRS",
  IRC: "IRC",
  IVA: "IVA",
  SS: "Seg. Social",
  contabilidade: "Contabilidade",
  fiscal: "Fiscal",
  outro: "Outro",
};
