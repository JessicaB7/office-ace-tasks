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
        .select("*, clients(name), collaborators!tasks_collaborator_id_fkey(name), created_by_collaborator:collaborators!tasks_created_by_fkey(name)")
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
      notes?: string | null;
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

// ---- LEADS (Comercial) ----
export interface Lead {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: string;
  estimated_value: number | null;
  proposal_sent_at: string | null;
  next_followup: string | null;
  owner_id: string | null;
  business_type: string | null;
  business_area: string | null;
  iva_framework: string | null;
  segment: string | null;
  notes: string | null;
  meeting: boolean;
  meeting_date: string | null;
  suggested_product: string | null;
  loss_reason: string | null;
  created_at: string;
  updated_at: string;
}


export function useLeads(segment?: string) {
  return useQuery({
    queryKey: ["leads", segment ?? "all"],
    queryFn: async () => {
      let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (segment) query = query.eq("segment", segment);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Lead[];
    },
  });
}

export function useUpsertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Partial<Lead> & { name: string; id?: string }) => {
      if (lead.id) {
        const { data, error } = await supabase.from("leads").update(lead as any).eq("id", lead.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from("leads").insert(lead as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });
}
