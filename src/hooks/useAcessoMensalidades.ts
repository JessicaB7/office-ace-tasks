import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** A admin, ou um colaborador com acesso delegado (`collaborators.acesso_mensalidades`), gere a «Atualização de mensalidades». */
export function useAcessoMensalidades() {
  const { user, isAdmin } = useAuth();
  const { data: delegado = false } = useQuery({
    queryKey: ["acesso_mensalidades", user?.id],
    enabled: !!user && !isAdmin,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("collaborators").select("acesso_mensalidades").eq("user_id", user!.id).eq("active", true).maybeSingle();
      return !!data?.acesso_mensalidades;
    },
  });
  return { pode: isAdmin || delegado, delegado: !isAdmin && delegado };
}
