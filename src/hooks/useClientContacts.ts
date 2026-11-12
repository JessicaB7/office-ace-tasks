import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClientContact, TimelineEntry } from "@/lib/clientContacts";

// client_contacts / client_timeline ainda não estão nos tipos gerados do Supabase.
const table = () => (supabase as any).from("client_contacts");

export function useClientTimeline(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client_timeline", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("client_timeline", { p_client_id: clientId });
      if (error) throw error;
      return (data || []) as TimelineEntry[];
    },
  });
}

export function useClientContacts(clientId?: string | null) {
  return useQuery({
    queryKey: ["client_contacts", clientId ?? "all"],
    queryFn: async () => {
      let q = table().select("*").order("data", { ascending: false });
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ClientContact[];
    },
  });
}

export function useAddContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Pick<ClientContact, "client_id" | "collaborator_id" | "tipo" | "data" | "resumo" | "seguimento_em">) => {
      const { error } = await table().insert(row);
      if (error) throw error;
    },
    onSuccess: (_d, row) => {
      qc.invalidateQueries({ queryKey: ["client_timeline", row.client_id] });
      qc.invalidateQueries({ queryKey: ["client_contacts"] });
      if (row.seguimento_em) qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; clientId: string }) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["client_timeline", v.clientId] });
      qc.invalidateQueries({ queryKey: ["client_contacts"] });
    },
  });
}
