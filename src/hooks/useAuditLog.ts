import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AuditEntry } from "@/lib/auditLabels";

// audit_log ainda não está nos tipos gerados do Supabase.
const table = () => (supabase as any).from("audit_log");

export interface AuditFiltros {
  clientId?: string;
  userId?: string;
  campo?: string;
  desde?: string; // "YYYY-MM-DD"
  ate?: string; // "YYYY-MM-DD"
}

export function useAuditLog(filtros: AuditFiltros, enabled = true) {
  return useQuery({
    queryKey: ["audit_log", filtros],
    enabled,
    queryFn: async () => {
      let q = table().select("*").eq("tabela", "clients").order("alterado_em", { ascending: false }).limit(500);
      if (filtros.clientId) q = q.eq("registo_id", filtros.clientId);
      if (filtros.userId) q = q.eq("alterado_por", filtros.userId);
      if (filtros.campo) q = q.eq("campo", filtros.campo);
      if (filtros.desde) q = q.gte("alterado_em", `${filtros.desde}T00:00:00`);
      if (filtros.ate) q = q.lte("alterado_em", `${filtros.ate}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AuditEntry[];
    },
  });
}
