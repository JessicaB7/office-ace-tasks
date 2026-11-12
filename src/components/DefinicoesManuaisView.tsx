import { useMemo, useState } from "react";
import { BookOpen, AlertTriangle, Plus, Trash2, ExternalLink, Save, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDeleteManual, useObligationManuals, useSaveManual } from "@/hooks/useObligationManuals";
import { tiposSemManual, TIPOS_CONTABILIDADE, type ObligationManual } from "@/lib/obligationManuals";

const inputClass = "w-full px-2 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

type Draft = Partial<ObligationManual> & { titulo: string; notion_url: string };

const Linha = ({ m, onSaved }: { m: Draft; onSaved?: () => void }) => {
  const save = useSaveManual();
  const del = useDeleteManual();
  const [d, setD] = useState<Draft>(m);
  const dirty = JSON.stringify(d) !== JSON.stringify(m);
  const set = (k: keyof Draft, v: any) => setD((x) => ({ ...x, [k]: v }));
  const guardar = () => {
    if (!d.titulo.trim() || !/^https?:\/\//.test(d.notion_url.trim())) {
      toast.error("Indica o título e um link válido (https://...).");
      return;
    }
    save.mutate({ ...d, titulo: d.titulo.trim(), notion_url: d.notion_url.trim(), match_prefix: (d.match_prefix || "").trim() }, {
      onSuccess: () => { toast.success("Manual guardado."); onSaved?.(); },
      onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "Já existe um manual para esse prefixo e regime." : e.message),
    });
  };
  return (
    <tr className="border-t align-top">
      <td className="px-2 py-1.5 w-44"><input value={d.match_prefix ?? ""} onChange={(e) => set("match_prefix", e.target.value)} placeholder="(geral)" className={cn(inputClass, "font-mono text-xs")} /></td>
      <td className="px-2 py-1.5 w-28">
        <select value={d.tipo_contabilidade ?? ""} onChange={(e) => set("tipo_contabilidade", e.target.value || null)} className={inputClass}>
          <option value="">Todos</option>
          {TIPOS_CONTABILIDADE.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5"><input value={d.titulo} onChange={(e) => set("titulo", e.target.value)} className={inputClass} /></td>
      <td className="px-2 py-1.5"><input value={d.notion_url} onChange={(e) => set("notion_url", e.target.value)} className={cn(inputClass, "text-xs")} /></td>
      <td className="px-2 py-1.5 w-20"><input type="number" value={d.ordem ?? 0} onChange={(e) => set("ordem", Number(e.target.value))} className={inputClass} /></td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <div className="flex items-center gap-1">
          {d.notion_url && (
            <a href={d.notion_url} target="_blank" rel="noopener noreferrer" title="Abrir" className="p-1 rounded hover:bg-muted text-muted-foreground"><ExternalLink className="w-4 h-4" /></a>
          )}
          <button type="button" onClick={guardar} disabled={(!dirty && !!m.id) || save.isPending} title="Guardar"
            className="p-1 rounded hover:bg-primary/10 text-primary disabled:opacity-30"><Save className="w-4 h-4" /></button>
          {m.id && (
            <button type="button" title="Apagar" onClick={() => del.mutate(m.id!, { onError: (e: Error) => toast.error(e.message) })}
              className="p-1 rounded hover:bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      </td>
    </tr>
  );
};

/** Admin: links dos manuais do Notion para cada tipo de obrigação (Definições → Manuais). */
/** Estado e sincronização manual das páginas do Notion usadas pelo assistente (manual_pages). */
const SyncManuais = () => {
  const qc = useQueryClient();
  const [aSincronizar, setASincronizar] = useState(false);
  const { data } = useQuery({
    queryKey: ["manual_pages_info"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("manual_pages").select("titulo, updated_at").order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as { titulo: string; updated_at: string }[];
    },
  });
  const sincronizar = async () => {
    setASincronizar(true);
    try {
      const { data: r, error } = await supabase.functions.invoke("sync-manuais", { body: {} });
      if (error) throw error;
      if ((r as any)?.error) throw new Error((r as any).error);
      toast.success(`${(r as any)?.paginas ?? 0} páginas sincronizadas.`);
      qc.invalidateQueries({ queryKey: ["manual_pages_info"] });
    } catch (e) {
      toast.error("Não foi possível sincronizar: " + (e as Error).message);
    } finally {
      setASincronizar(false);
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border bg-card px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        Assistente de processos: {data?.length ?? 0} páginas do «Manual · Técnica de contabilidade» sincronizadas
        {data?.[0] ? ` (última a ${new Date(data[0].updated_at).toLocaleString("pt-PT")})` : ""}. Sincroniza sozinho todos os dias.
      </span>
      <button type="button" onClick={sincronizar} disabled={aSincronizar}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-muted disabled:opacity-50">
        <RefreshCw className={cn("w-4 h-4", aSincronizar && "animate-spin")} /> Sincronizar agora
      </button>
    </div>
  );
};

const DefinicoesManuaisView = () => {
  const { data: manuals = [], isLoading } = useObligationManuals();
  const [novo, setNovo] = useState(0);
  const semManual = useMemo(() => tiposSemManual(manuals), [manuals]);
  const tiposUnicos = [...new Set(semManual.map((s) => s.type))];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">Definições · Manuais</h2>
      </div>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Cada tarefa da Gestão Mensal e das Obrigações Mensais mostra um ícone de livro que abre o manual do Notion.
        Vale o <strong>prefixo mais comprido</strong> que corresponda ao início do tipo de obrigação (ex.: <code>IVA</code> serve
        IVA, IVA_recapitulativa, IVA_flex_P1…) e cujo regime seja o do cliente (ou "Todos"). O prefixo vazio é o manual geral.
      </p>

      <SyncManuais />

      {semManual.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{tiposUnicos.length} {tiposUnicos.length === 1 ? "tipo de obrigação sem manual" : "tipos de obrigação sem manual"} específico (abrem o manual geral):</p>
            <p className="text-muted-foreground mt-1 text-xs">{semManual.map((s) => `${s.type} (${s.tipo})`).join(" · ")}</p>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-muted-foreground">A carregar...</p> : (
        <div className="overflow-x-auto bg-card rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-2 py-2">Prefixo</th>
                <th className="text-left font-semibold px-2 py-2">Regime</th>
                <th className="text-left font-semibold px-2 py-2">Título</th>
                <th className="text-left font-semibold px-2 py-2">Link do Notion</th>
                <th className="text-left font-semibold px-2 py-2">Ordem</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {manuals.map((m) => <Linha key={`${m.id}-${m.updated_at}`} m={m} />)}
              <Linha key={`novo-${novo}`} m={{ match_prefix: "", tipo_contabilidade: null, titulo: "", notion_url: "", ordem: 0 }} onSaved={() => setNovo((n) => n + 1)} />
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground px-3 py-2 border-t flex items-center gap-1"><Plus className="w-3 h-3" /> A última linha serve para adicionar um manual novo.</p>
        </div>
      )}
    </div>
  );
};

export default DefinicoesManuaisView;
