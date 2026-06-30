import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FinancialAccount = {
  code: string;
  name: string;
  section: "vendas" | "pessoal" | "despesas" | "compras" | "iva_vendas" | "iva_compras";
  display_order: number;
};

export type FinancialEntry = {
  client_id: string;
  year: number;
  month: number;
  account_code: string;
  value: number;
};

export type FinancialSettings = {
  client_id: string;
  year: number;
  corporate_tax_rate: number;
  ta_representacao: number;
  ta_kms: number;
  ta_nao_doc: number;
  irs_retencoes: number;
};

export function useFinancialAccounts() {
  return useQuery({
    queryKey: ["financial_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("code,name,section,display_order")
        .order("display_order");
      if (error) throw error;
      return data as FinancialAccount[];
    },
    staleTime: 1000 * 60 * 30,
  });
}

export function useClientFinancialEntries(clientId: string, year: number) {
  return useQuery({
    queryKey: ["cfe", clientId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_financial_entries")
        .select("client_id,year,month,account_code,value")
        .eq("client_id", clientId)
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as FinancialEntry[];
    },
    enabled: !!clientId,
  });
}

export function useClientFinancialSettings(clientId: string, year: number) {
  return useQuery({
    queryKey: ["cfs", clientId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_financial_settings")
        .select("*")
        .eq("client_id", clientId)
        .eq("year", year)
        .maybeSingle();
      if (error) throw error;
      return (data ?? {
        client_id: clientId,
        year,
        corporate_tax_rate: 0.16,
        ta_representacao: 0.10,
        ta_kms: 0.05,
        ta_nao_doc: 0.50,
        irs_retencoes: 0,
      }) as FinancialSettings;
    },
    enabled: !!clientId,
  });
}

export function useUpsertEntry(clientId: string, year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { month: number; account_code: string; value: number }) => {
      const { error } = await supabase
        .from("client_financial_entries")
        .upsert(
          { client_id: clientId, year, month: entry.month, account_code: entry.account_code, value: entry.value },
          { onConflict: "client_id,year,month,account_code" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cfe", clientId, year] }),
  });
}

export function useUpsertSettings(clientId: string, year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<FinancialSettings>) => {
      const { error } = await supabase
        .from("client_financial_settings")
        .upsert({ client_id: clientId, year, ...s }, { onConflict: "client_id,year" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cfs", clientId, year] }),
  });
}

export function useBulkUpsertEntries(clientId: string, year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: { month: number; account_code: string; value: number }[]) => {
      if (!entries.length) return;
      const rows = entries.map((e) => ({
        client_id: clientId,
        year,
        month: e.month,
        account_code: e.account_code,
        value: e.value,
      }));
      const { error } = await supabase
        .from("client_financial_entries")
        .upsert(rows, { onConflict: "client_id,year,month,account_code" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cfe", clientId, year] }),
  });
}
