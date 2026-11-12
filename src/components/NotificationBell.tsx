import { useState, useRef, useEffect, useId } from "react";
import { Bell, BellOff, BellRing, CheckCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActivateToconlineJobs } from "@/hooks/useToconlineJobs";
import { usePushSubscription } from "@/hooks/usePushSubscription";

const typeIcon: Record<string, string> = {
  task_assigned: "📋",
  task_completed: "✅",
  weekly_digest: "📅",
  daily_summary: "📊",
  calendly_lead: "📅",
  iva_entregue: "🧾",
  consultoria_form_submitted: "⚡",
  ss_isencao: "⏳",
  mapas_por_enviar: "🗺️",
  toconline_erros: "⚠️",
  seguimento_contacto: "📞",
  teste: "🔔",
  info: "ℹ️",
};

/** Dados da notificação "IVA entregue": a tarefa a ativar na Fila TOConline. */
type MapaJobData = { procedure_id: string; client_id: string; reference_month: string };
const mapaJob = (n: { type: string; data?: unknown }): MapaJobData | null => {
  const d = n.data as Partial<MapaJobData> | null | undefined;
  return n.type === "iva_entregue" && d?.procedure_id && d.client_id && d.reference_month ? (d as MapaJobData) : null;
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: notifications = [] } = useNotifications();
  const unreadCount = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const { user } = useAuth();
  const instanceId = useId();
  const activateJobs = useActivateToconlineJobs();
  const push = usePushSubscription();
  const ativarPush = () =>
    push.ativar().then(
      () => undefined,
      (e: Error) => toast.error("Não foi possível ativar as notificações: " + (e?.message || "erro")),
    );
  const desativarPush = () =>
    push.desativar().catch((e: Error) => toast.error("Não foi possível desativar: " + (e?.message || "erro")));
  const activate = (job: MapaJobData) =>
    activateJobs.mutate({ procedureId: job.procedure_id, clientIds: [job.client_id], referenceMonth: job.reference_month, userId: user?.id });

  // Pop up de cada notificação nova (canal Realtime próprio, separado do da lista)
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-popup-${user.id}-${instanceId.replace(/:/g, "")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as { title: string; message: string | null; type: string; data?: unknown };
          const job = mapaJob(n);
          toast(`${typeIcon[n.type] || "ℹ️"} ${n.title}`, {
            description: n.message ?? undefined,
            // Marcações do Calendly e formulários de consultoria ficam no ecrã até serem fechados
            duration: n.type === "calendly_lead" || n.type === "consultoria_form_submitted" || job ? Infinity : 8000,
            closeButton: true,
            action: job
              ? { label: "Ativar Mapa de análise", onClick: () => activate(job) }
              : { label: "Ver", onClick: () => setOpen(true) },
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, instanceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);


  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border rounded-xl shadow-lg z-50 animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h4 className="font-semibold text-sm">Notificações</h4>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="border-b px-4 py-3 bg-muted/30 text-xs">
            {push.estado === "instalar_ios" && (
              <p className="flex gap-2 text-muted-foreground">
                <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Para receber notificações no iPhone: no Safari, Partilhar → Adicionar ao ecrã principal, abrir a app pelo
                  ícone e voltar aqui.
                </span>
              </p>
            )}
            {push.estado === "inativo" && (
              <button
                onClick={ativarPush}
                disabled={push.aProcessar}
                className="flex items-center gap-2 font-medium text-primary hover:underline disabled:opacity-50"
              >
                <BellRing className="w-4 h-4" /> Ativar notificações neste dispositivo
              </button>
            )}
            {push.estado === "ativo" && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-success font-medium">
                  <BellRing className="w-4 h-4" /> Notificações ativas neste dispositivo
                </span>
                <button
                  onClick={desativarPush}
                  disabled={push.aProcessar}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                >
                  <BellOff className="w-3.5 h-3.5" /> Desativar
                </button>
              </div>
            )}
            {push.estado === "bloqueado" && (
              <p className="flex gap-2 text-muted-foreground">
                <BellOff className="w-4 h-4 shrink-0 mt-0.5" />
                <span>As notificações estão bloqueadas neste dispositivo. Permite-as nas definições do browser/telemóvel.</span>
              </p>
            )}
            {push.estado === "indisponivel" && (
              <p className="text-muted-foreground">Este browser não suporta notificações no dispositivo.</p>
            )}
          </div>
          <div className="max-h-[min(400px,60vh)] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem notificações</p>
            ) : (
              notifications.map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markRead.mutate(n.id);
                    if (n.link) {
                      setOpen(false);
                      navigate(n.link);
                    }
                  }}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/50",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <span className="text-base mt-0.5">{typeIcon[n.type] || "ℹ️"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", !n.read && "font-semibold")}>{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                    {mapaJob(n) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          activate(mapaJob(n)!);
                          if (!n.read) markRead.mutate(n.id);
                        }}
                        disabled={activateJobs.isPending}
                        className="mt-1.5 text-xs font-medium px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Ativar Mapa de análise
                      </button>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt })}
                    </p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
