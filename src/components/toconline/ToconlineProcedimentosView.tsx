import { Fragment, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TOCONLINE_DOCS } from "@/lib/toconlineProcedures";

// Markdown simples dos manuais (títulos, listas, **negrito**, `código`)
const inline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="px-1 rounded bg-muted text-xs">{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });

const renderMarkdown = (md: string) =>
  md.split("\n").map((line, i) => {
    const indent = line.match(/^\s*/)?.[0].length || 0;
    const t = line.trim();
    if (!t) return <div key={i} className="h-2" />;
    if (t.startsWith("# ")) return <h3 key={i} className="text-xl font-bold mt-2">{inline(t.slice(2))}</h3>;
    if (t.startsWith("## ")) return <h4 key={i} className="text-lg font-semibold mt-4">{inline(t.slice(3))}</h4>;
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

const ToconlineProcedimentosView = () => {
  const [active, setActive] = useState(0);
  const doc = TOCONLINE_DOCS[active];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Procedimentos TOConline</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manual que o Claude segue no TOConline, por regime. Para alterar um procedimento, peça ao Claude no Claude Code.
        </p>
      </div>
      <div className="flex gap-1 border-b">
        {TOCONLINE_DOCS.map((d, i) => (
          <button key={d.path} onClick={() => setActive(i)}
            className={cn("px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
              active === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
            {d.regimeLabel}
          </button>
        ))}
      </div>
      {doc && <article className="bg-card rounded-xl border p-6 space-y-1">{renderMarkdown(doc.content)}</article>}
    </div>
  );
};

export default ToconlineProcedimentosView;
