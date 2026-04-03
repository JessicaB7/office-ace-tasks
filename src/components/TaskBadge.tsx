import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, STATUS_LABELS, type TaskPriority, type TaskStatus } from "@/types/database";

const statusStyles: Record<TaskStatus, string> = {
  pendente: "bg-warning/15 text-warning",
  em_progresso: "bg-info/15 text-info",
  concluida: "bg-success/15 text-success",
  cancelada: "bg-destructive/15 text-destructive",
};

const priorityStyles: Record<TaskPriority, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-info/15 text-info",
  alta: "bg-warning/15 text-warning",
  urgente: "bg-destructive/15 text-destructive",
};

export const StatusBadge = ({ status }: { status: TaskStatus }) => (
  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", statusStyles[status])}>
    {STATUS_LABELS[status]}
  </span>
);

export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => (
  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", priorityStyles[priority])}>
    {PRIORITY_LABELS[priority]}
  </span>
);
