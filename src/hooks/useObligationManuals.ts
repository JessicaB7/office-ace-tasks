import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ObligationManual } from "@/lib/obligationManuals";

// obligation_manuals ainda não está nos tipos gerados do Supabase.
const table = () => (supabase as any).from("obligation_manuals");

export function useObligationManuals() {
  return useQuery({
    queryKey: ["obligation_manuals"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await table().select("*").order("ordem").order("match_prefix");
      if (error) throw error;
      return (data || []) as ObligationManual[];
    },
  });
}

export function useSaveManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<ObligationManual> & { titulo: string; notion_url: string }) => {
      const row = {
        match_prefix: m.match_prefix ?? "",
        tipo_contabilidade: m.tipo_contabilidade || null,
        titulo: m.titulo,
        notion_url: m.notion_url,
        ordem: m.ordem ?? 0,
      };
      const { error } = m.id ? await table().update(row).eq("id", m.id) : await table().insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obligation_manuals"] }),
  });
}

export function useDeleteManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obligation_manuals"] }),
  });
}
