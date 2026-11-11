import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpdateOffboarding } from "@/hooks/useOffboardings";
import { MOTIVOS_SAIDA, SAIDA_CHECKLIST, saidaProgresso, type Offboarding } from "@/lib/clientSaida";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

const fmt = (iso: unknown) =>
  typeof iso === "string" && iso ? new Date(iso).toLocaleDateString("pt-PT") : "";

/** Separador "Saída" da ficha do cliente: dados da saída + checklist (cada clique grava logo). */
const ClientSaidaTab = ({ offboarding: o }: { offboarding: Offboarding }) => {
  const update = useUpdateOffboarding();
  const { toast } = useToast();
  const [detalhe, setDetalhe] = useState(o.motivo_detalhe || "");
  const [notas, setNotas] = useState(o.notas || "");

  useEffect(() => {
    setDetalhe(o.motivo_detalhe || "");
    setNotas(o.notas || "");
  }, [o.id, o.motivo_detalhe, o.notas]);

  const patch = (p: Partial<Offboarding>) =>
    update.mutate(
      { id: o.id, ...p },
      { onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }) },
    );

  const done = saidaProgresso(o);
  const total = SAIDA_CHECKLIST.length;

  return (
    <div className="space-y-4 pt-2">
      {o.completed_at ? (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 text-success px-3 py-2 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" /> Saída concluída em {fmt(o.completed_at)} — cliente inativo.
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Quando os {total} itens estiverem marcados, a saída fica concluída e o cliente passa a inativo.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Data do aviso</label>
          <input type="date" value={o.data_aviso || ""} onChange={(e) => patch({ data_aviso: e.target.value || null })} className={inputClass} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Último mês de responsabilidade</label>
          <input
            type="month"
            value={o.ultimo_mes_responsabilidade?.slice(0, 7) || ""}
            onChange={(e) => patch({ ultimo_mes_responsabilidade: e.target.value ? `${e.target.value}-01` : null })}
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1 block">Motivo da saída</label>
          <select value={o.motivo_saida || ""} onChange={(e) => patch({ motivo_saida: e.target.value || null })} className={inputClass}>
            <option value="">— Selecionar —</option>
            {MOTIVOS_SAIDA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1 block">Detalhe do motivo</label>
          <textarea
            rows={2}
            value={detalhe}
            onChange={(e) => setDetalhe(e.target.value)}
            onBlur={() => detalhe !== (o.motivo_detalhe || "") && patch({ motivo_detalhe: detalhe || null })}
            className={cn(inputClass, "resize-y")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Checklist de saída</span>
          <span className="text-xs text-muted-foreground">{done}/{total}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        {SAIDA_CHECKLIST.map((c) => {
          const checked = o[c.key] === true;
          return (
            <label
              key={c.key}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors",
                checked ? "bg-success/5 border-success/30" : "hover:border-primary/40",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => patch({ [c.key]: e.target.checked } as Partial<Offboarding>)}
                className="mt-0.5 accent-primary"
              />
              <span className="flex-1 min-w-0">
                <span className={cn("block text-sm", checked && "line-through text-muted-foreground")}>{c.label}</span>
                {c.hint && <span className="block text-xs text-muted-foreground">{c.hint}</span>}
              </span>
              {checked && <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmt(o[`${c.key}_at`])}</span>}
            </label>
          );
        })}
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Notas</label>
        <textarea
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          onBlur={() => notas !== (o.notas || "") && patch({ notas: notas || null })}
          className={cn(inputClass, "resize-y")}
        />
      </div>
    </div>
  );
};

export default ClientSaidaTab;
