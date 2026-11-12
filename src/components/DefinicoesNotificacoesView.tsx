import { BellRing, BellOff, Smartphone, Trash2, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import {
  PREFERENCIAS, descreverDispositivo, useDeletePushDevice, useMyPushDevices, useNotificationPreferences,
  useSaveNotificationPreferences, useSendTestNotification,
} from "@/hooks/useNotificationPreferences";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

/** Definições → Notificações: o que cada pessoa recebe, dispositivos ativos e teste. */
const DefinicoesNotificacoesView = () => {
  const { isAdmin } = useAuth();
  const push = usePushSubscription();
  const { data: prefs } = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const { data: devices = [] } = useMyPushDevices();
  const delDevice = useDeletePushDevice();
  const teste = useSendTestNotification();
  const [aEnviar, setAEnviar] = useState(false);

  const setPref = (key: string, value: boolean) =>
    save.mutate({ [key]: value }, { onError: (e: Error) => toast.error("Não foi possível guardar: " + e.message) });

  const enviarRelatorio = async () => {
    setAEnviar(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-weekly-digest", { body: { only: "admin_report" } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Relatório semanal enviado para o teu email.");
    } catch (e) {
      toast.error("Não foi possível enviar: " + (e as Error).message);
    } finally {
      setAEnviar(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <BellRing className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">Definições · Notificações</h2>
      </div>

      <section className="bg-card rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold">Este dispositivo</h3>
        {push.estado === "ativo" && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="flex items-center gap-2 text-success font-medium text-sm"><BellRing className="w-4 h-4" /> Notificações ativas neste dispositivo</span>
            <button type="button" onClick={() => push.desativar()} disabled={push.aProcessar}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><BellOff className="w-4 h-4" /> Desativar</button>
          </div>
        )}
        {push.estado === "inativo" && (
          <button type="button" onClick={() => push.ativar().catch((e: Error) => toast.error(e.message))} disabled={push.aProcessar}
            className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
            <BellRing className="w-4 h-4" /> Ativar notificações
          </button>
        )}
        {push.estado === "instalar_ios" && (
          <p className="text-sm text-muted-foreground flex gap-2"><Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
            No iPhone: no Safari, Partilhar → Adicionar ao ecrã principal, abrir a app pelo ícone e voltar aqui.</p>
        )}
        {push.estado === "bloqueado" && <p className="text-sm text-muted-foreground">As notificações estão bloqueadas. Permite-as nas definições do browser/telemóvel.</p>}
        {push.estado === "indisponivel" && <p className="text-sm text-muted-foreground">Este browser não suporta notificações.</p>}
        <div>
          <button type="button" disabled={teste.isPending}
            onClick={() => teste.mutate(undefined, {
              onSuccess: () => toast.success(devices.length ? "Notificação de teste enviada — deve chegar aos teus dispositivos." : "Notificação de teste criada (sem dispositivos ativos, só aparece no sino)."),
              onError: (e: Error) => toast.error(e.message),
            })}
            className="px-3 py-2 text-sm rounded-lg border hover:bg-muted inline-flex items-center gap-2 disabled:opacity-50">
            <Send className="w-4 h-4" /> Enviar notificação de teste
          </button>
        </div>
      </section>

      <section className="bg-card rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold">Dispositivos com notificações ({devices.length})</h3>
        {devices.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não ativaste notificações em nenhum dispositivo.</p> : (
          <ul className="divide-y border rounded-lg">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-muted-foreground" /> {descreverDispositivo(d.user_agent)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">desde {new Date(d.created_at).toLocaleDateString("pt-PT")}</span>
                  <button type="button" title="Remover dispositivo" onClick={() => delDevice.mutate(d.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card rounded-xl border p-5 space-y-1">
        <h3 className="font-semibold mb-2">O que queres receber no telemóvel</h3>
        <p className="text-xs text-muted-foreground mb-3">As notificações continuam sempre no sino da app; aqui escolhes as que também chegam aos teus dispositivos.</p>
        {PREFERENCIAS.map((p) => (
          <label key={p.key} className="flex items-center justify-between gap-4 py-2 border-t first:border-t-0 cursor-pointer">
            <span>
              <span className="text-sm font-medium block">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.hint}</span>
            </span>
            <Switch checked={!!prefs?.[p.key]} onCheckedChange={(v) => setPref(p.key, v)} disabled={!prefs} />
          </label>
        ))}
      </section>

      <section className="bg-card rounded-xl border p-5 space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4" /> Relatório semanal por email</h3>
        <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
          <span>
            <span className="text-sm font-medium block">Resumo semanal dos meus clientes</span>
            <span className="text-xs text-muted-foreground">À segunda-feira de manhã: fecho do mês, prazos da semana, tarefas em atraso e pedidos de documentos à espera.</span>
          </span>
          <Switch checked={!!prefs?.relatorio_semanal_pessoal} onCheckedChange={(v) => setPref("relatorio_semanal_pessoal", v)} disabled={!prefs} />
        </label>
        {isAdmin && (
          <div className={cn("pt-3 border-t")}>
            <p className="text-xs text-muted-foreground mb-2">A admin recebe sempre o relatório completo às segundas às 08:00.</p>
            <button type="button" onClick={enviarRelatorio} disabled={aEnviar}
              className="px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              <Send className="w-4 h-4" /> {aEnviar ? "A enviar..." : "Enviar relatório agora"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default DefinicoesNotificacoesView;
