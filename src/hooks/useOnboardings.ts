import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Onboarding = Database["public"]["Tables"]["client_onboardings"]["Row"] & {
  lead: { id: string; name: string; email: string | null; phone: string | null; estimated_value: number | null; iva_framework: string | null } | null;
};
export type OnboardingUpdate = Database["public"]["Tables"]["client_onboardings"]["Update"];
export type OnboardingSecrets = Database["public"]["Tables"]["client_onboarding_secrets"]["Row"];

export function useOnboardings() {
  return useQuery({
    queryKey: ["client_onboardings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_onboardings")
        .select("*, lead:leads!client_onboardings_lead_id_fkey(id, name, email, phone, estimated_value, iva_framework)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Onboarding[];
    },
  });
}

export function useUpdateOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: OnboardingUpdate & { id: string }) => {
      const { error } = await supabase.from("client_onboardings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_onboardings"] }),
  });
}

export function useCreateOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { lead_id: string; form_type: string }) => {
      const { error } = await supabase.from("client_onboardings").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_onboardings"] }),
  });
}

export function useDeleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_onboardings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_onboardings"] }),
  });
}

/** Senhas do formulário — a RLS só as devolve ao admin. */
export function useOnboardingSecrets(onboardingId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["client_onboarding_secrets", onboardingId],
    enabled: !!onboardingId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_onboarding_secrets")
        .select("*")
        .eq("onboarding_id", onboardingId!)
        .maybeSingle();
      if (error) throw error;
      return data as OnboardingSecrets | null;
    },
  });
}
