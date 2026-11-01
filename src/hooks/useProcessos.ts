import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProcessoArea = "comercial" | "consultorias" | "gestao_mensal" | "obrigacoes";

/** Tipo de cliente (valores de clients.tipo_contabilidade). */
export type ProcessoRegime = "TI RS" | "TI CO" | "SQ";

export interface ProcessoLink {
  label: string;
  url: string;
}

export interface Processo {
  id: string;
  area: ProcessoArea;
  grupo: string;
  title: string;
  frequencia: string | null;
  aplica_se: string | null;
  toconline_doc: string | null;
  /** Tipos de cliente a que se aplica; vazio = todos. */
  regimes: ProcessoRegime[];
  body: string;
  /** Gravação do processo (Google Drive, OneDrive, Loom ou YouTube). */
  video_url: string | null;
  /** Ligações à Drive (pastas, modelos, exemplos). */
  links: ProcessoLink[];
  position: number;
  updated_at: string;
}

export type ProcessoInput = Omit<Processo, "id" | "updated_at"> & { id?: string };

// Tabela nova — ainda fora dos tipos gerados
const table = () => supabase.from("processos" as any) as any;

export function useProcessos() {
  return useQuery({
    queryKey: ["processos"],
    queryFn: async () => {
      const { data, error } = await table().select("*").order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Processo[];
    },
  });
}

export function useSaveProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...row }: ProcessoInput & { updated_by?: string | null }) => {
      const { data, error } = id
        ? await table().update(row).eq("id", id).select().single()
        : await table().insert(row).select().single();
      if (error) throw error;
      return data as Processo;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["processos"] }),
  });
}

export function useDeleteProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["processos"] }),
  });
}
