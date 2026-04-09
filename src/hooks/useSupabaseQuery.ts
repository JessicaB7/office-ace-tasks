import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Client, ClientInsert, Collaborator, CollaboratorInsert, DbTask, DbTaskInsert, FiscalDeadline } from "@/types/database";

// ---- CLIENTS ----
export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useUpsertClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: ClientInsert & { id?: string }) => {
      if (client.id) {
        const { data, error } = await supabase.from("clients").update(client).eq("id", client.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("clients").insert(client).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

// ---- COLLABORATORS ----
export function useCollaborators() {
  return useQuery({
    queryKey: ["collaborators"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collaborators").select("*").order("name");
      if (error) throw error;
      return data as Collaborator[];
    },
  });
}

export function useUpsertCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (collab: CollaboratorInsert & { id?: string }) => {
      if (collab.id) {
        const { data, error } = await supabase.from("collaborators").update(collab).eq("id", collab.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("collaborators").insert(collab).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collaborators"] }),
  });
}

export function useDeleteCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collaborators"] }),
  });
}

// ---- TASKS ----
export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, clients(name), collaborators(name)")
        .order("due_date");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: DbTaskInsert & { id?: string }) => {
      if (task.id) {
        const { data, error } = await supabase.from("tasks").update(task).eq("id", task.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("tasks").insert(task).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

// ---- FISCAL DEADLINES ----
export function useFiscalDeadlines() {
  return useQuery({
    queryKey: ["fiscal_deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_deadlines").select("*").order("day_of_month");
      if (error) throw error;
      return data as FiscalDeadline[];
    },
  });
}

// ---- MONTHLY OBLIGATIONS ----
export function useMonthlyObligations(referenceMonth: string) {
  return useQuery({
    queryKey: ["monthly_obligations", referenceMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_obligations")
        .select("*")
        .eq("reference_month", referenceMonth);
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertObligation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (obligation: {
      id?: string;
      client_id: string;
      obligation_type: string;
      reference_month: string;
      status: string;
      completed_at?: string | null;
      completed_by?: string | null;
      extra_done?: boolean;
    }) => {
      if (obligation.id) {
        const { data, error } = await supabase
          .from("monthly_obligations")
          .update(obligation)
          .eq("id", obligation.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("monthly_obligations")
        .insert(obligation)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly_obligations"] }),
  });
}

// ---- CLIENT OBLIGATIONS HISTORY ----
export function useClientObligationsHistory(clientId: string | null, obligationTypePrefix: string) {
  return useQuery({
    queryKey: ["client_obligations_history", clientId, obligationTypePrefix],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("monthly_obligations")
        .select("*")
        .eq("client_id", clientId)
        .like("obligation_type", `${obligationTypePrefix}%`)
        .order("reference_month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}
