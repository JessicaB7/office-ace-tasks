import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useObligationManuals } from "@/hooks/useObligationManuals";
import { resolveManual } from "@/lib/obligationManuals";

interface Props {
  obligationType: string;
  tipoContabilidade: string | null | undefined;
  className?: string;
}

/** Ícone de livro que abre (num separador novo) o manual do Notion da obrigação. */
const ManualLink = ({ obligationType, tipoContabilidade, className }: Props) => {
  const { data: manuals = [] } = useObligationManuals();
  const { manual, especifico } = resolveManual(manuals, obligationType, tipoContabilidade);
  if (!manual) return null;
  return (
    <a href={manual.notion_url} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Abrir manual: ${manual.titulo}${especifico ? "" : " (manual geral)"}`}
      aria-label={`Abrir manual ${manual.titulo}`}
      className={cn("inline-flex items-center justify-center p-0.5 rounded text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors shrink-0", className)}>
      <BookOpen className="w-3.5 h-3.5" />
    </a>
  );
};

export default ManualLink;
