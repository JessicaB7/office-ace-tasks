/** Notificações push (Web Push) — funções puras de suporte. */

/** Chave pública VAPID (base64url) → bytes, como pede o pushManager.subscribe. */
export const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

/** iPhone/iPad (inclui iPad com iPadOS, que se apresenta como Mac com ecrã tátil). */
export const isIOS = (ua: string, platform = "", maxTouchPoints = 0) =>
  /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);

export type PushEstado =
  | "indisponivel" // browser sem suporte (ou sem chave VAPID)
  | "instalar_ios" // iPhone fora da app do ecrã principal
  | "bloqueado" // permissão recusada
  | "ativo"
  | "inativo";
