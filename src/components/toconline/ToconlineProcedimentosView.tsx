import { useState } from "react";
import { cn } from "@/lib/utils";
import { TOCONLINE_DOCS } from "@/lib/toconlineProcedures";
import { renderMarkdown } from "@/lib/markdown";

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
      <div className="flex gap-1 border-b overflow-x-auto">
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
