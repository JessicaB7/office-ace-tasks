import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ConsultoriaForm = Database["public"]["Tables"]["consultoria_forms"]["Row"] & {
  lead: { id: string; name: string; meeting_date: string | null; given_by: string | null } | null;
};

const SELECT = "*, lead:leads!consultoria_forms_lead_id_fkey(id, name, meeting_date, given_by)";

/** Formulário de consultoria de uma lead (criado automaticamente com a lead). */
export function useConsultoriaForm(leadId: string | null | undefined) {
  return useQuery({
    queryKey: ["consultoria_forms", "lead", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase.from("consultoria_forms").select(SELECT).eq("lead_id", leadId!).maybeSingle();
      if (error) throw error;
      return data as unknown as ConsultoriaForm | null;
    },
  });
}

/** Formulários de consultoria respondidos de um cliente: pelo NIF da lead ou pelo onboarding que criou o cliente. */
export function useClientConsultoriaForms(clientId: string | null | undefined, nif: string | null | undefined) {
  return useQuery({
    queryKey: ["consultoria_forms", "client", clientId, nif],
    enabled: !!clientId,
    queryFn: async () => {
      const leadIds = new Set<string>();
      const { data: onb, error: e1 } = await supabase.from("client_onboardings").select("lead_id").eq("client_id", clientId!);
      if (e1) throw e1;
      onb?.forEach((o) => o.lead_id && leadIds.add(o.lead_id));
      const cleanNif = (nif || "").replace(/\s/g, "");
      if (cleanNif) {
        const { data: leads, error: e2 } = await supabase.from("leads").select("id").eq("segment", "consultoria").eq("nif", cleanNif);
        if (e2) throw e2;
        leads?.forEach((l) => leadIds.add(l.id));
      }
      if (leadIds.size === 0) return [];
      const { data, error } = await supabase
        .from("consultoria_forms")
        .select(SELECT)
        .in("lead_id", [...leadIds])
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ConsultoriaForm[];
    },
  });
}

export function useMarkConsultoriaFormSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consultoria_forms").update({ form_sent_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultoria_forms"] }),
  });
}
