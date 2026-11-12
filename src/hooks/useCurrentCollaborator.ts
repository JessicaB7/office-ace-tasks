import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCollaborators } from "@/hooks/useSupabaseQuery";

/** Colaborador da sessão atual (pelo user_id ou, na falta, pelo email). */
export function useCurrentCollaborator() {
  const { user } = useAuth();
  const { data: collaborators = [] } = useCollaborators();
  return useMemo(() => {
    if (!user) return null;
    return (
      collaborators.find((c: any) => c.user_id === user.id) ||
      collaborators.find((c: any) => c.email?.toLowerCase() === user.email?.toLowerCase()) ||
      null
    );
  }, [user, collaborators]);
}
