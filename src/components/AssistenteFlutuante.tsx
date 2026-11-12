import { useState } from "react";
import { MessageCircleQuestion, X, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistente, type RespostaAssistente } from "@/hooks/useAssistente";
import AssistenteResposta from "@/components/AssistenteResposta";

/** Ícone flutuante: dúvidas de processos, respondidas só com base nos manuais do Notion. */
const AssistenteFlutuante = () => {
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [historico, setHistorico] = useState<{ pergunta: string; resposta?: RespostaAssistente; erro?: string }[]>([]);
  const assistente = useAssistente();

  const perguntar = () => {
    const p = pergunta.trim();
    if (!p || assistente.isPending) return;
    setPergunta("");
    setHistorico((h) => [...h, { pergunta: p }]);
    assistente.mutate({ acao: "processo", texto: p }, {
      onSuccess: (r) => setHistorico((h) => h.map((x, i) => (i === h.length - 1 ? { ...x, resposta: r } : x))),
      onError: (e: Error) => setHistorico((h) => h.map((x, i) => (i === h.length - 1 ? { ...x, erro: e.message } : x))),
    });
  };

  return (
    <>
      <button type="button" onClick={() => setAberto((v) => !v)} title="Dúvidas de processos (manuais)"
        aria-label="Abrir assistente de processos"
        className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90">
        {aberto ? <X className="w-5 h-5" /> : <MessageCircleQuestion className="w-5 h-5" />}
      </button>
      {aberto && (
        <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-[400px] z-40 rounded-xl border bg-card shadow-xl flex flex-col max-h-[70vh] animate-fade-in">
          <div className="px-4 py-3 border-b">
            <p className="font-semibold text-sm">Assistente de processos</p>
            <p className="text-xs text-muted-foreground">Responde só com base nos manuais do Notion (Técnica de contabilidade).</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {historico.length === 0 && <p className="text-sm text-muted-foreground">Ex.: "Como se lança uma fatura de compra de um TI no TOConline?"</p>}
            {historico.map((h, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm font-medium bg-primary/10 rounded-lg px-3 py-2 ml-8">{h.pergunta}</p>
                {h.resposta ? <AssistenteResposta resposta={h.resposta} />
                  : h.erro ? <p className="text-sm text-destructive">{h.erro}</p>
                  : <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> A procurar nos manuais...</p>}
              </div>
            ))}
          </div>
          <div className="p-3 border-t flex gap-2">
            <input value={pergunta} onChange={(e) => setPergunta(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") perguntar(); }}
              placeholder="Escreve a tua dúvida..." className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
            <button type="button" onClick={perguntar} disabled={assistente.isPending || !pergunta.trim()} aria-label="Enviar pergunta"
              className={cn("px-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-50")}>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AssistenteFlutuante;
