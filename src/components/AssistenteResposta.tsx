import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { RespostaAssistente } from "@/hooks/useAssistente";

/** Resposta do assistente, com botão de copiar e as fontes (manuais) usadas. */
const AssistenteResposta = ({ resposta }: { resposta: RespostaAssistente }) => (
  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
    <p className="text-sm whitespace-pre-wrap break-words">{resposta.texto}</p>
    {!!resposta.fontes?.length && (
      <div className="flex flex-wrap gap-2 pt-1">
        {resposta.fontes.map((f) => (
          <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="w-3 h-3" /> {f.titulo}
          </a>
        ))}
      </div>
    )}
    <button type="button"
      onClick={() => navigator.clipboard.writeText(resposta.texto).then(() => toast.success("Copiado."), () => toast.error("Não foi possível copiar."))}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border bg-card hover:bg-muted">
      <Copy className="w-3.5 h-3.5" /> Copiar
    </button>
  </div>
);

export default AssistenteResposta;
