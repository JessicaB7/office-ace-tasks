import { useState } from "react";
import { Bot, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useClientFinancialEntries, useClientFinancialSettings, useFinancialAccounts } from "@/hooks/useClientFinancials";
import { buildRobotResumo } from "@/lib/robotAnalise";

/** Robot: escreve o texto da análise financeira do ano para enviar ao cliente. */
export default function RobotAnaliseDialog({ open, onClose, client, year }: {
  open: boolean;
  onClose: () => void;
  client: { id: string; name: string; tipo_contabilidade?: string | null };
  year: number;
}) {
  const { data: accounts = [] } = useFinancialAccounts();
  const { data: entries = [] } = useClientFinancialEntries(client.id, year);
  const { data: prevEntries = [] } = useClientFinancialEntries(client.id, year - 1);
  const { data: settings } = useClientFinancialSettings(client.id, year);
  const [pedido, setPedido] = useState("");
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);

  const gerar = async () => {
    if (!settings) return;
    const resumo = buildRobotResumo({ regime: client.tipo_contabilidade || "SQ", year, accounts, entries, settings, prevEntries });
    if (resumo.ultimoMes === 0) {
      toast.error(`Não há dados de ${year} para analisar — importe primeiro os mapas.`);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("robot-analise", {
        body: { cliente: client.name, resumo, pedido: pedido.trim() || undefined },
      });
      if (error) {
        const body = await (error as any).context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message);
      }
      setTexto(data.texto);
    } catch (e: any) {
      toast.error("Robot: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(texto);
    toast.success("Texto copiado");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" /> Robot · texto da análise
          </DialogTitle>
          <DialogDescription>
            Escreve a análise de {year} de <span className="font-medium text-foreground">{client.name}</span> para enviar ao
            cliente, com os números que estão na app. Reveja sempre antes de enviar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder="Pedido opcional ao robot (ex.: mais curto para WhatsApp; realçar a descida da faturação em setembro)"
            className="min-h-[60px] text-sm"
          />
          {texto && (
            <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} className="min-h-[340px] text-sm leading-relaxed" />
          )}
        </div>
        <DialogFooter className="gap-2">
          {texto && (
            <Button variant="outline" onClick={copiar}><Copy className="w-4 h-4 mr-1" /> Copiar</Button>
          )}
          <Button onClick={gerar} disabled={loading || !settings}>
            {texto ? <RefreshCw className="w-4 h-4 mr-1" /> : <Bot className="w-4 h-4 mr-1" />}
            {loading ? "A escrever…" : texto ? "Gerar outra vez" : "Gerar texto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
