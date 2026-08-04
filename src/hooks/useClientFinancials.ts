import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FinancialAccount = {
  code: string;
  name: string;
  section: "vendas" | "pessoal" | "pessoal_socios" | "pessoal_colab" | "despesas" | "compras" | "iva_vendas" | "iva_compras" | "impostos";
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
  derrama_rate: number;
  ta_representacao: number;
  ta_kms: number;
  ta_nao_doc: number;
  ta_base_representacao: number;
  ta_base_ajudas_custo: number;
  irs_retencoes: number;
  ss_q1: number;
  ss_q2: number;
  ss_q3: number;
  ss_q4: number;
  tco: boolean;
  iva_q1: number | null;
  iva_q2: number | null;
  iva_q3: number | null;
  iva_q4: number | null;
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
        ta_base_representacao: 0,
        ta_base_ajudas_custo: 0,
        irs_retencoes: 0,
        ss_q1: 0,
        ss_q2: 0,
        ss_q3: 0,
        ss_q4: 0,
        tco: false,
        iva_q1: null,
        iva_q2: null,
        iva_q3: null,
        iva_q4: null,

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cfe", clientId, year] });
      qc.invalidateQueries({ queryKey: ["cfe_last_import", clientId, year] });
    },
  });
}

/** Data/hora da última importação de valores financeiros (apenas para análise interna). */
export function useLastImportDate(clientId: string, year: number) {
  return useQuery({
    queryKey: ["cfe_last_import", clientId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_financial_entries")
        .select("updated_at")
        .eq("client_id", clientId)
        .eq("year", year)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.updated_at as string | undefined) ?? null;
    },
    enabled: !!clientId,
  });
}

// ===================== Importações por slot =====================

export type ImportSlot = "mapa" | "t1" | "t2" | "t3" | "t4";

export const IMPORT_SLOTS: { slot: ImportSlot; label: string; months: number[] }[] = [
  { slot: "mapa", label: "Mapa de Exploração", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { slot: "t1", label: "Balancete 1º trimestre", months: [1, 2, 3] },
  { slot: "t2", label: "Balancete 2º trimestre", months: [4, 5, 6] },
  { slot: "t3", label: "Balancete 3º trimestre", months: [7, 8, 9] },
  { slot: "t4", label: "Balancete 4º trimestre", months: [10, 11, 12] },
];

export type FinancialImport = {
  id: string;
  client_id: string;
  year: number;
  slot: ImportSlot;
  file_name: string;
  entries: { month: number; account_code: string; value: number }[];
  created_at: string;
  updated_at: string;
};

export function useFinancialImports(clientId: string, year: number) {
  return useQuery({
    queryKey: ["cfi", clientId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_financial_imports")
        .select("*")
        .eq("client_id", clientId)
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as unknown as FinancialImport[];
    },
    enabled: !!clientId,
  });
}

/** Secções cujos valores vêm do Mapa de Exploração (faturação, despesas, lucro). */
const MAPA_SECTIONS = ["vendas", "compras", "despesas", "pessoal", "pessoal_socios", "pessoal_colab"];
/** Secções cujos valores vêm dos balancetes (IVA, Segurança Social, retenção na fonte). */
const BALANCETE_SECTIONS = ["iva_vendas", "iva_compras", "impostos"];

/**
 * Recalcula os valores do cliente a partir das importações guardadas.
 * - Mapa de Exploração: faturação, despesas e lucro (secções operacionais).
 * - Balancetes trimestrais: IVA, Segurança Social e retenção na fonte.
 * Cada fonte só escreve nas suas secções, por isso não se sobrepõem.
 */
async function materializeEntries(clientId: string, year: number) {
  const [{ data, error }, accRes] = await Promise.all([
    supabase
      .from("client_financial_imports")
      .select("slot,entries")
      .eq("client_id", clientId)
      .eq("year", year),
    supabase.from("financial_accounts").select("code,section"),
  ]);
  if (error) throw error;
  if (accRes.error) throw accRes.error;
  const imports = (data ?? []) as unknown as { slot: ImportSlot; entries: FinancialImport["entries"] }[];
  const sectionByCode = new Map((accRes.data ?? []).map((a: any) => [a.code, a.section as string]));

  // month -> code -> value
  const resolved = new Map<number, Map<string, number>>();
  const applySlot = (slot: ImportSlot) => {
    const imp = imports.find((i) => i.slot === slot);
    const months = IMPORT_SLOTS.find((s) => s.slot === slot)!.months;
    const allowed = slot === "mapa" ? MAPA_SECTIONS : BALANCETE_SECTIONS;
    if (slot !== "mapa") {
      // limpa apenas as secções que o balancete controla, nos meses do trimestre
      months.forEach((m) => {
        const bucket = resolved.get(m);
        if (!bucket) return;
        Array.from(bucket.keys()).forEach((code) => {
          if (allowed.includes(sectionByCode.get(code) ?? "")) bucket.delete(code);
        });
      });
    }
    if (!imp) return;
    for (const e of imp.entries ?? []) {
      if (!months.includes(e.month)) continue;
      if (!allowed.includes(sectionByCode.get(e.account_code) ?? "")) continue;
      const bucket = resolved.get(e.month) ?? new Map<string, number>();
      bucket.set(e.account_code, Number(e.value));
      resolved.set(e.month, bucket);
    }
  };
  (["mapa", "t1", "t2", "t3", "t4"] as ImportSlot[]).forEach(applySlot);


  const rows: { client_id: string; year: number; month: number; account_code: string; value: number }[] = [];
  resolved.forEach((bucket, month) => {
    bucket.forEach((value, account_code) => {
      rows.push({ client_id: clientId, year, month, account_code, value });
    });
  });

  const del = await supabase
    .from("client_financial_entries")
    .delete()
    .eq("client_id", clientId)
    .eq("year", year);
  if (del.error) throw del.error;

  if (rows.length) {
    const ins = await supabase.from("client_financial_entries").insert(rows);
    if (ins.error) throw ins.error;
  }
}

export function useSaveFinancialImport(clientId: string, year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { slot: ImportSlot; fileName: string; entries: FinancialImport["entries"] }) => {
      const { error } = await supabase
        .from("client_financial_imports")
        .upsert(
          {
            client_id: clientId,
            year,
            slot: payload.slot,
            file_name: payload.fileName,
            entries: payload.entries as any,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "client_id,year,slot" }
        );
      if (error) throw error;
      await materializeEntries(clientId, year);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cfi", clientId, year] });
      qc.invalidateQueries({ queryKey: ["cfe", clientId, year] });
      qc.invalidateQueries({ queryKey: ["cfe_last_import", clientId, year] });
    },
  });
}

export function useDeleteFinancialImport(clientId: string, year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slot: ImportSlot) => {
      const { error } = await supabase
        .from("client_financial_imports")
        .delete()
        .eq("client_id", clientId)
        .eq("year", year)
        .eq("slot", slot);
      if (error) throw error;
      await materializeEntries(clientId, year);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cfi", clientId, year] });
      qc.invalidateQueries({ queryKey: ["cfe", clientId, year] });
      qc.invalidateQueries({ queryKey: ["cfe_last_import", clientId, year] });
    },
  });
}
