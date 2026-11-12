import { useState } from "react";
import { Sparkles, FileText, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistente, type AcaoAssistente, type RespostaAssistente } from "@/hooks/useAssistente";
import AssistenteResposta from "@/components/AssistenteResposta";

const inputClass = "w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

/** Separador "Assistente" da ficha de cliente: resumo, rascunho de pedido de pendentes e pergunta livre.
 * Nada é enviado ao cliente — só se gera texto para copiar. */
const ClientAssistenteTab = ({ clientId }: { clientId: string }) => {
  const assistente = useAssistente();
  const [modo, setModo] = useState<AcaoAssistente>("resumo");
  const [texto, setTexto] = useState("");
  const [resposta, setResposta] = useState<RespostaAssistente | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const executar = () => {
    setErro(null);
    setResposta(null);
    assistente.mutate(
      { acao: modo, client_id: clientId, texto: modo === "resumo" ? undefined : texto },
      { onSuccess: setResposta, onError: (e: Error) => setErro(e.message) },
    );
  };

  const MODOS: { id: AcaoAssistente; label: string; icon: typeof Sparkles }[] = [
    { id: "resumo", label: "Resumo do cliente", icon: Sparkles },
    { id: "pendentes", label: "Pedido de pendentes", icon: FileText },
    { id: "pergunta", label: "Pergunta", icon: HelpCircle },
  ];

  return (
    <div className="space-y-3 pt-2" onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}>
      <div className="flex gap-1.5 flex-wrap">
        {MODOS.map((m) => (
          <button key={m.id} type="button" onClick={() => { setModo(m.id); setResposta(null); setErro(null); }} aria-pressed={modo === m.id}
            className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border",
              modo === m.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}>
            <m.icon className="w-3.5 h-3.5" /> {m.label}
          </button>
        ))}
      </div>

      {modo === "resumo" && (
        <p className="text-xs text-muted-foreground">Resumo interno (em dia / pendente / alertas) com base no enquadramento, notas, dívidas, obrigações dos últimos 3 meses, tarefas abertas e últimos contactos.</p>
      )}
      {modo === "pendentes" && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Cola a lista de movimentos sem documento. O assistente organiza um pedido ao cliente (falta fatura / fatura sem NIF / movimento a explicar) com prazo, pronto a copiar — nada é enviado.</p>
          <textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} className={cn(inputClass, "resize-y font-mono text-xs")}
            placeholder={"03/10  Compra Continente  -45,30\n07/10  Transferência recebida  +250,00\n..."} />
        </div>
      )}
      {modo === "pergunta" && (
        <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} className={cn(inputClass, "resize-y")}
          placeholder="Ex.: o IVA do 3º trimestre já foi entregue?" />
      )}

      <button type="button" onClick={executar} disabled={assistente.isPending || (modo !== "resumo" && !texto.trim())}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50">
        {assistente.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {assistente.isPending ? "A pensar..." : modo === "resumo" ? "Gerar resumo" : modo === "pendentes" ? "Gerar rascunho" : "Perguntar"}
      </button>

      {erro && <p className="text-sm text-destructive">{erro}</p>}
      {resposta && <AssistenteResposta resposta={resposta} />}
      <p className="text-[11px] text-muted-foreground">As senhas, chaves de acesso, utilizador de faturação e NISS nunca são enviados ao assistente.</p>
    </div>
  );
};

export default ClientAssistenteTab;
