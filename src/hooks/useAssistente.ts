import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AcaoAssistente = "resumo" | "pendentes" | "pergunta" | "processo";

export interface RespostaAssistente {
  texto: string;
  fontes?: { titulo: string; url: string }[];
}

/** Chama a edge function "assistente" (a chave da Anthropic fica só no servidor). */
export function useAssistente() {
  return useMutation({
    mutationFn: async (vars: { acao: AcaoAssistente; client_id?: string; texto?: string }): Promise<RespostaAssistente> => {
      const { data, error } = await supabase.functions.invoke("assistente", { body: vars });
      if (error) {
        let msg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* sem corpo */ }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as RespostaAssistente;
    },
  });
}
