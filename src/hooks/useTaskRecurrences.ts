import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { TaskCategory, TaskPriority } from "@/types/database";
import type { RecurrenceDayMode, RecurrenceFrequency, RecurrenceRule } from "@/lib/taskRecurrence";

// task_recurrences / tasks.recurrence_id ainda não estão nos tipos gerados do Supabase.
export const untypedSupabase = supabase as unknown as SupabaseClient;
const table = () => untypedSupabase.from("task_recurrences");

export interface TaskRecurrence {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  collaborator_id: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  frequency: RecurrenceFrequency;
  interval_n: number;
  day_mode: RecurrenceDayMode;
  day_of_month: number | null;
  weekday: number | null;
  start_date: string;
  end_date: string | null;
  lead_days: number;
  next_due_date: string | null;
  active: boolean;
  last_generated_at: string | null;
  created_by: string | null;
  created_at: string;
  clients?: { name: string } | null;
  collaborators?: { name: string } | null;
  created_by_collaborator?: { name: string } | null;
}

export type TaskRecurrenceInput = Omit<
  TaskRecurrence,
  "id" | "created_at" | "last_generated_at" | "created_by" | "clients" | "collaborators" | "created_by_collaborator"
>;

/** Regra (formato da lib) de uma série guardada. */
export const ruleOf = (r: Pick<TaskRecurrence, "frequency" | "interval_n" | "day_mode" | "day_of_month" | "weekday" | "start_date" | "end_date">): RecurrenceRule => ({
  frequency: r.frequency,
  interval: r.interval_n,
  day_mode: r.day_mode,
  day_of_month: r.day_of_month,
  weekday: r.weekday,
  start_date: r.start_date,
  end_date: r.end_date,
});

export function useTaskRecurrences() {
  return useQuery({
    queryKey: ["task_recurrences"],
    queryFn: async () => {
      const { data, error } = await table()
        .select("*, clients(name), collaborators!task_recurrences_collaborator_id_fkey(name), created_by_collaborator:collaborators!task_recurrences_created_by_fkey(name)")
        .order("title");
      if (error) throw error;
      return (data || []) as TaskRecurrence[];
    },
  });
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["task_recurrences"] });
  qc.invalidateQueries({ queryKey: ["tasks"] });
};

/** Cria a série e, se `startNow`, gera logo a ocorrência em aberto. Devolve o id da série. */
export function useCreateTaskRecurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ row, startNow }: { row: TaskRecurrenceInput; startNow: boolean }) => {
      const { data, error } = await table().insert(row).select("id").single();
      if (error) throw error;
      if (startNow) {
        const { error: e2 } = await untypedSupabase.rpc("task_recurrence_start", { p_id: data.id });
        if (e2) throw e2;
      }
      return data.id as string;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateTaskRecurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TaskRecurrenceInput> }) => {
      const { error } = await table().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Cria já a próxima ocorrência (se a série não tiver nenhuma em aberto). */
export function useStartTaskRecurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await untypedSupabase.rpc("task_recurrence_start", { p_id: id });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Apaga a série; as ocorrências já criadas ficam (recurrence_id passa a null). */
export function useDeleteTaskRecurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}
