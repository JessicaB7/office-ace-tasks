import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isIOS, urlBase64ToUint8Array, type PushEstado } from "@/lib/push";

// Chave pública VAPID (é pública por natureza). Valor por omissão para o caso de a
// variável VITE_VAPID_PUBLIC_KEY ainda não estar definida no Vercel.
const VAPID_PUBLIC_KEY: string =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  "BHl4_Zo-HiWAs3A_awBwssOwWMR9dTfEGCzJQRxzf7rS_GL3-V2sPJs4QabHA_dKHbEwcUQyOwQgD_qT_ZE6beI";

const suportado = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

const naAppDoEcraPrincipal = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia?.("(display-mode: standalone)").matches;

const obterRegisto = async () =>
  (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));

/** Ativar/desativar notificações push neste dispositivo (subscrição em push_subscriptions). */
export function usePushSubscription() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<PushEstado>("indisponivel");
  const [aProcessar, setAProcessar] = useState(false);

  const avaliar = useCallback(async () => {
    if (isIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) && !naAppDoEcraPrincipal()) {
      setEstado("instalar_ios");
      return;
    }
    if (!suportado() || !VAPID_PUBLIC_KEY) {
      setEstado("indisponivel");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueado");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setEstado(sub && Notification.permission === "granted" ? "ativo" : "inativo");
  }, []);

  useEffect(() => {
    avaliar().catch(() => setEstado("indisponivel"));
  }, [avaliar]);

  /** Tem de ser chamado diretamente num toque/clique (exigência do iPhone). */
  const ativar = useCallback(async () => {
    if (!user?.id || !VAPID_PUBLIC_KEY) return;
    setAProcessar(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "inativo");
        return;
      }
      const reg = await obterRegisto();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      const j = sub.toJSON();
      // Um endpoint pertence a um só utilizador: se outro já o tinha neste dispositivo, apaga-se primeiro (RLS só deixa apagar os próprios)
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: j.keys?.p256dh ?? "",
        auth: j.keys?.auth ?? "",
        user_agent: navigator.userAgent.slice(0, 300),
      });
      if (error) throw error;
      setEstado("ativo");
    } finally {
      setAProcessar(false);
    }
  }, [user?.id]);

  const desativar = useCallback(async () => {
    setAProcessar(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setEstado("inativo");
    } finally {
      setAProcessar(false);
    }
  }, []);

  return { estado, aProcessar, ativar, desativar };
}
