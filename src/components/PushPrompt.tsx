import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const KEY = "pushPromptDismissedAt";
const DIAS = 7;

const dispensadoRecentemente = () => {
  try {
    const v = localStorage.getItem(KEY);
    return !!v && Date.now() - Number(v) < DIAS * 86400000;
  } catch {
    return false;
  }
};

/** Depois do login, convida a ativar as notificações neste dispositivo (volta a perguntar ao fim de 7 dias). */
const PushPrompt = () => {
  const push = usePushSubscription();
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (push.estado === "inativo" && !dispensadoRecentemente()) {
      const t = setTimeout(() => setVisivel(true), 2500);
      return () => clearTimeout(t);
    }
    setVisivel(false);
  }, [push.estado]);

  if (!visivel) return null;

  const agoraNao = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* sem localStorage: volta a perguntar na próxima sessão */ }
    setVisivel(false);
  };
  const ativar = () =>
    push.ativar().then(
      () => { setVisivel(false); toast.success("Notificações ativadas neste dispositivo."); },
      (e: Error) => toast.error("Não foi possível ativar: " + (e?.message || "erro")),
    );

  return (
    <div role="dialog" aria-label="Ativar notificações"
      className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-xl border bg-card shadow-lg p-4 animate-fade-in">
      <button type="button" onClick={agoraNao} aria-label="Fechar" className="absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground">
        <X className="w-4 h-4" />
      </button>
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <BellRing className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">Receber notificações neste dispositivo?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Avisos de tarefas, seguimentos, isenções SS, mapas e automações. Escolhes o que recebes em Definições → Notificações.
          </p>
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={ativar} disabled={push.aProcessar}
              className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50">
              Ativar notificações
            </button>
            <button type="button" onClick={agoraNao} className="px-3 py-1.5 text-sm rounded-lg border hover:bg-muted">Agora não</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushPrompt;
