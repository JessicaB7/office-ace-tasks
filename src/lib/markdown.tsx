import { Fragment, type ReactNode } from "react";
import { Square } from "lucide-react";

/** Markdown simples dos manuais: títulos (#, ##), listas (-, 1.), checklists (- [ ]),
 * **negrito**, _itálico_ e `código`. */
const inline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`|\b_[^_]+_\b)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="px-1 rounded bg-muted text-xs">{part.slice(1, -1)}</code>;
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) return <em key={i} className="text-muted-foreground">{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });

export const renderMarkdown = (md: string) =>
  md.split("\n").map((line, i) => {
    const indent = line.match(/^\s*/)?.[0].length || 0;
    const t = line.trim();
    if (!t) return <div key={i} className="h-2" />;
    if (t.startsWith("# ")) return <h3 key={i} className="text-xl font-bold mt-2">{inline(t.slice(2))}</h3>;
    if (t.startsWith("## ")) return <h4 key={i} className="text-base font-semibold mt-4 text-primary">{inline(t.slice(3))}</h4>;
    const check = t.match(/^- \[( |x)\]\s+(.*)$/i);
    if (check) {
      return (
        <div key={i} className="flex gap-2 text-sm items-start" style={{ paddingLeft: indent * 6 + 4 }}>
          <Square className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
          <span>{inline(check[2])}</span>
        </div>
      );
    }
    const bullet = t.match(/^(-|\d+\.)\s+(.*)$/);
    if (bullet) {
      return (
        <div key={i} className="flex gap-2 text-sm" style={{ paddingLeft: indent * 6 + 4 }}>
          <span className="text-muted-foreground shrink-0">{bullet[1] === "-" ? "•" : bullet[1]}</span>
          <span>{inline(bullet[2])}</span>
        </div>
      );
    }
    return <p key={i} className="text-sm" style={{ paddingLeft: indent * 6 }}>{inline(t)}</p>;
  });
