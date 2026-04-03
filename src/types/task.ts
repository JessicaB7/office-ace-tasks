export type TaskStatus = "pendente" | "em_progresso" | "concluida" | "cancelada";
export type TaskPriority = "baixa" | "media" | "alta" | "urgente";
export type TaskCategory = "IRS" | "IRC" | "IVA" | "SS" | "contabilidade" | "fiscal" | "outro";

export interface Task {
  id: string;
  title: string;
  description: string;
  client: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string;
  assignee: string;
  createdAt: string;
}

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
