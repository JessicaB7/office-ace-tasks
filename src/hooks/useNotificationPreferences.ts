import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationPreferences {
  user_id: string;
  ss_isencoes: boolean;
  mapas_por_enviar: boolean;
  erros_automacoes: boolean;
  seguimentos_contactos: boolean;
  tarefas_atribuidas: boolean;
  relatorio_semanal_pessoal: boolean;
}

export const PREFERENCIAS: { key: keyof Omit<NotificationPreferences, "user_id">; label: string; hint: string }[] = [
  { key: "tarefas_atribuidas", label: "Tarefas atribuídas", hint: "Quando alguém te atribui uma tarefa." },
  { key: "seguimentos_contactos", label: "Seguimentos de contactos", hint: "No dia do seguimento marcado num contacto." },
  { key: "ss_isencoes", label: "Isenções SS a terminar", hint: "60 e 15 dias antes do fim da isenção dos teus clientes." },
  { key: "mapas_por_enviar", label: "Mapas trimestrais por enviar", hint: "30 dias depois do fim do trimestre, com os mapas em falta." },
  { key: "erros_automacoes", label: "Erros das automações TOConline", hint: "Quando aparecem tarefas TOConline com erro ou bloqueadas." },
];

const DEFAULTS: Omit<NotificationPreferences, "user_id"> = {
  ss_isencoes: true, mapas_por_enviar: true, erros_automacoes: true,
  seguimentos_contactos: true, tarefas_atribuidas: true, relatorio_semanal_pessoal: false,
};

// notification_preferences ainda não está nos tipos gerados do Supabase.
const table = () => (supabase as any).from("notification_preferences");

export function useNotificationPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notification_preferences", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await table().select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return { user_id: user!.id, ...DEFAULTS, ...(data || {}) } as NotificationPreferences;
    },
  });
}

export function useSaveNotificationPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<NotificationPreferences, "user_id">>) => {
      const { data: cur } = await table().select("*").eq("user_id", user!.id).maybeSingle();
      const { error } = await table().upsert({ ...DEFAULTS, ...(cur || {}), ...patch, user_id: user!.id }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification_preferences"] }),
  });
}

export interface PushDevice {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
}

export function useMyPushDevices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["push_subscriptions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_subscriptions" as any)
        .select("id, endpoint, user_agent, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PushDevice[];
    },
  });
}

export function useDeletePushDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("push_subscriptions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["push_subscriptions"] }),
  });
}

export function useSendTestNotification() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("send_test_notification");
      if (error) throw error;
    },
  });
}

/** Admin: nº de dispositivos com notificações ativas por utilizador. */
export function usePushDevicesByUser(enabled: boolean) {
  return useQuery({
    queryKey: ["push_devices_by_user"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("push_devices_by_user");
      if (error) throw error;
      return new Map(((data || []) as { user_id: string; dispositivos: number; ultimo: string }[]).map((r) => [r.user_id, r]));
    },
  });
}

/** Descrição curta do dispositivo a partir do user agent. */
export const descreverDispositivo = (ua: string | null): string => {
  if (!ua) return "Dispositivo";
  const so = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Dispositivo";
  const nav = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return nav ? `${so} · ${nav}` : so;
};
