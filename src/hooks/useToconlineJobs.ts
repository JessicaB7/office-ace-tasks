import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { ToconlineJobStatus } from "@/lib/toconlineProcedures";

export type ToconlineJob = Database["public"]["Tables"]["toconline_jobs"]["Row"];

export function useToconlineJobs() {
  return useQuery({
    queryKey: ["toconline_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toconline_jobs")
        .select("*")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data as ToconlineJob[];
    },
  });
}

/** Ativa um procedimento para vários clientes num mês. Tarefas que já existam
 * (mesmo procedimento × cliente × mês) voltam a "pendente". */
export function useActivateToconlineJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ procedureId, clientIds, referenceMonth, userId }: {
      procedureId: string; clientIds: string[]; referenceMonth: string; userId?: string | null;
    }) => {
      const now = new Date().toISOString();
      const rows = clientIds.map((client_id) => ({
        procedure_id: procedureId, client_id, reference_month: referenceMonth,
        status: "pendente", result_notes: null, started_at: null, finished_at: null,
        requested_by: userId ?? null, requested_at: now,
      }));
      const { error } = await supabase
        .from("toconline_jobs")
        .upsert(rows, { onConflict: "procedure_id,client_id,reference_month" });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["toconline_jobs"] });
      toast.success(n === 1 ? "1 tarefa ativada." : `${n} tarefas ativadas.`);
    },
    onError: (e: Error) => toast.error("Erro ao ativar: " + e.message),
  });
}

export function useUpdateToconlineJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, result_notes }: { id: string; status: ToconlineJobStatus; result_notes?: string | null }) => {
      const now = new Date().toISOString();
      const patch: Database["public"]["Tables"]["toconline_jobs"]["Update"] = { status };
      if (result_notes !== undefined) patch.result_notes = result_notes;
      if (status === "em_curso") { patch.started_at = now; patch.finished_at = null; }
      else if (status === "pendente") { patch.started_at = null; patch.finished_at = null; }
      else patch.finished_at = now;
      const { error } = await supabase.from("toconline_jobs").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["toconline_jobs"] }),
    onError: (e: Error) => toast.error("Erro ao atualizar: " + e.message),
  });
}

export function useDeleteToconlineJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("toconline_jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["toconline_jobs"] }),
    onError: (e: Error) => toast.error("Erro ao apagar: " + e.message),
  });
}
