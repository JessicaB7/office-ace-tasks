import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Offboarding } from "@/lib/clientSaida";

// client_offboardings ainda não está nos tipos gerados do Supabase.
const table = () => (supabase as any).from("client_offboardings");

export function useOffboardings() {
  return useQuery({
    queryKey: ["client_offboardings"],
    queryFn: async () => {
      const { data, error } = await table().select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Offboarding[];
    },
  });
}

export function useClientOffboarding(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client_offboardings", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await table().select("*").eq("client_id", clientId).maybeSingle();
      if (error) throw error;
      return (data || null) as Offboarding | null;
    },
  });
}

export function useUpdateOffboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Offboarding> & { id: string }) => {
      const { error } = await table().update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_offboardings"] });
      // A conclusão muda o estado do cliente (inativo) e o último mês.
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}
