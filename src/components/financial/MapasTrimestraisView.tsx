import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Map as MapIcon, Check, Send, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCollaborators } from "@/hooks/useSupabaseQuery";
import { useCurrentCollaborator } from "@/hooks/useCurrentCollaborator";
import { contagemMapas, mapaFields, trimestreAtual, type Trimestre } from "@/lib/mapasTrimestrais";

const selectClass = "px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring";
const hoje = () => new Date().toLocaleDateString("sv-SE");
const fmt = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-PT") : "");

type Row = Record<string, any> & { client_id: string; year: number };

function useSettingsDoAno(year: number) {
  return useQuery({
    queryKey: ["cfs_mapas", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_financial_settings")
        .select("client_id,year,mapa_q1_enviado,mapa_q2_enviado,mapa_q3_enviado,mapa_q4_enviado,mapa_q1_data,mapa_q2_data,mapa_q3_data,mapa_q4_data,relatorio_q1_entregue,relatorio_q2_entregue,relatorio_q3_entregue,relatorio_q4_entregue,relatorio_q1_data,relatorio_q2_data,relatorio_q3_data,relatorio_q4_data")
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

interface Props {
  /** Vindo de uma notificação: ano e trimestre a mostrar. */
  initialYear?: number;
  initialQ?: number;
}

/** Mapas trimestrais por enviar: clientes com análise financeira no ano, por trimestre. */
const MapasTrimestraisView = ({ initialYear, initialQ }: Props) => {
  const { isAdmin } = useAuth();
  const me = useCurrentCollaborator();
  const qc = useQueryClient();
  const atual = trimestreAtual();
  const [year, setYear] = useState(initialYear || atual.year);
  const [q, setQ] = useState<Trimestre>(((initialQ && initialQ >= 1 && initialQ <= 4 ? initialQ : atual.q) as Trimestre));
  const [responsavel, setResponsavel] = useState<string>(isAdmin ? "" : "me");
  useEffect(() => { if (isAdmin) setResponsavel((r) => (r === "me" ? "" : r)); }, [isAdmin]);
  useEffect(() => { if (initialYear) setYear(initialYear); if (initialQ) setQ(initialQ as Trimestre); }, [initialYear, initialQ]);
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "por_enviar" | "enviados">("todos");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { data: rows = [], isLoading } = useSettingsDoAno(year);
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const f = mapaFields(q);

  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);
  const collabName = (id: string | null | undefined) => collaborators.find((c: any) => c.id === id)?.name || "Sem responsável";

  const linhas = useMemo(() => {
    const respId = responsavel === "me" ? me?.id ?? "__none__" : responsavel;
    return rows
      .map((r) => ({ r, c: clientById.get(r.client_id) as any }))
      .filter(({ c }) => c && c.active)
      .filter(({ c }) => !respId || (respId === "none" ? !c.responsavel_id : c.responsavel_id === respId))
      .sort((a, b) => a.c.name.localeCompare(b.c.name, "pt"));
  }, [rows, clientById, responsavel, me]);
  const visiveis = linhas.filter(({ r }) =>
    filtroEstado === "todos" || (filtroEstado === "enviados" ? r[f.enviado] === true : r[f.enviado] !== true));
  const cont = contagemMapas(linhas.map((l) => l.r), q);

  const marcar = useMutation({
    mutationFn: async ({ ids, campo, campoData, valor }: { ids: string[]; campo: string; campoData: string; valor: boolean }) => {
      const { error } = await supabase
        .from("client_financial_settings")
        .update({ [campo]: valor, [campoData]: valor ? hoje() : null } as any)
        .eq("year", year)
        .in("client_id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cfs_mapas", year] });
      qc.invalidateQueries({ queryKey: ["cfs"] });
      qc.invalidateQueries({ queryKey: ["cfs_relatorios", year] });
    },
    onError: (e: Error) => toast.error("Erro ao guardar: " + e.message),
  });

  const marcarMapa = (ids: string[], valor = true) =>
    marcar.mutate({ ids, campo: f.enviado, campoData: f.enviadoData, valor }, {
      onSuccess: () => { toast.success(valor ? (ids.length === 1 ? "Mapa marcado como enviado." : `${ids.length} mapas marcados como enviados.`) : "Mapa desmarcado."); setSel(new Set()); },
    });
  const marcarRelatorio = (ids: string[], valor = true) =>
    marcar.mutate({ ids, campo: f.relatorio, campoData: f.relatorioData, valor }, {
      onSuccess: () => toast.success(valor ? "Relatório marcado como entregue." : "Relatório desmarcado."),
    });

  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const porEnviarVisiveis = visiveis.filter(({ r }) => r[f.enviado] !== true).map(({ r }) => r.client_id);
  const anos = [atual.year + 1, atual.year, atual.year - 1, atual.year - 2].filter((y, i, a) => a.indexOf(y) === i).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapIcon className="w-6 h-6 text-primary" />
        <h2 className="text-2xl font-bold">Mapas trimestrais por enviar</h2>
      </div>

      <div className="rounded-xl border bg-card px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="text-2xl font-bold">{cont.enviados} <span className="text-base font-medium text-muted-foreground">de {cont.total}</span></div>
        <div className="text-sm text-muted-foreground">mapas do {q}º trimestre de {year} enviados · {cont.relatorios} relatórios entregues</div>
        <div className="flex-1 min-w-[160px] h-2 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full transition-all", cont.porEnviar === 0 ? "bg-success" : "bg-primary")}
            style={{ width: `${cont.total ? Math.round((cont.enviados / cont.total) * 100) : 0}%` }} />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setSel(new Set()); }} className={selectClass} aria-label="Ano">
          {anos.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex rounded-lg border bg-card p-0.5" role="group" aria-label="Trimestre">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => { setQ(n as Trimestre); setSel(new Set()); }} aria-pressed={q === n}
              className={cn("px-3 py-1.5 text-sm rounded-md", q === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
              T{n}
            </button>
          ))}
        </div>
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={selectClass} aria-label="Responsável">
          <option value="">Todos os responsáveis</option>
          {me && <option value="me">Os meus clientes</option>}
          {collaborators.filter((c: any) => c.active).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="none">Sem responsável</option>
        </select>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className={selectClass} aria-label="Estado">
          <option value="todos">Todos</option>
          <option value="por_enviar">Por enviar</option>
          <option value="enviados">Enviados</option>
        </select>
        {sel.size > 0 && (
          <button type="button" onClick={() => marcarMapa([...sel])} disabled={marcar.isPending}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50">
            <Send className="w-4 h-4" /> Marcar {sel.size} como enviados
          </button>
        )}
      </div>

      {isLoading ? <p className="text-center py-12 text-muted-foreground">A carregar...</p> : visiveis.length === 0 ? (
        <div className="bg-card rounded-xl border px-4 py-12 text-center text-muted-foreground">
          {linhas.length === 0 ? `Nenhum cliente com análise financeira em ${year}.` : "Nenhum cliente com estes filtros."}
        </div>
      ) : (
        <div className="bg-card rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" aria-label="Selecionar todos por enviar"
                    checked={porEnviarVisiveis.length > 0 && porEnviarVisiveis.every((id) => sel.has(id))}
                    onChange={(e) => setSel(e.target.checked ? new Set(porEnviarVisiveis) : new Set())} />
                </th>
                <th className="text-left font-semibold px-3 py-2">Cliente</th>
                <th className="text-left font-semibold px-3 py-2">Responsável</th>
                <th className="text-left font-semibold px-3 py-2">Mapa enviado</th>
                <th className="text-left font-semibold px-3 py-2">Relatório entregue</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map(({ r, c }) => {
                const enviado = r[f.enviado] === true;
                const entregue = r[f.relatorio] === true;
                return (
                  <tr key={r.client_id} className={cn("border-t", enviado && entregue && "bg-success/5")}>
                    <td className="px-3 py-2">
                      {!enviado && <input type="checkbox" checked={sel.has(r.client_id)} onChange={() => toggleSel(r.client_id)} aria-label={`Selecionar ${c.name}`} />}
                    </td>
                    <td className="px-3 py-2 font-medium">{c.name}<span className="ml-2 text-[11px] text-muted-foreground">{c.tipo_contabilidade}</span></td>
                    <td className="px-3 py-2 text-muted-foreground">{collabName(c.responsavel_id)}</td>
                    <td className="px-3 py-2">
                      {enviado ? (
                        <button type="button" onClick={() => marcarMapa([r.client_id], false)} title="Desmarcar"
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success/15 text-success">
                          <Check className="w-3 h-3" /> Sim{r[f.enviadoData] ? ` · ${fmt(r[f.enviadoData])}` : ""}
                        </button>
                      ) : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning">Não</span>}
                    </td>
                    <td className="px-3 py-2">
                      {entregue ? (
                        <button type="button" onClick={() => marcarRelatorio([r.client_id], false)} title="Desmarcar"
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success/15 text-success">
                          <Check className="w-3 h-3" /> Sim{r[f.relatorioData] ? ` · ${fmt(r[f.relatorioData])}` : ""}
                        </button>
                      ) : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Não</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        {!enviado && (
                          <button type="button" onClick={() => marcarMapa([r.client_id])} disabled={marcar.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border hover:bg-primary/10 hover:text-primary whitespace-nowrap">
                            <Send className="w-3.5 h-3.5" /> Marcar mapa como enviado
                          </button>
                        )}
                        {!entregue && (
                          <button type="button" onClick={() => marcarRelatorio([r.client_id])} disabled={marcar.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border hover:bg-success/10 hover:text-success whitespace-nowrap">
                            <FileCheck2 className="w-3.5 h-3.5" /> Marcar relatório entregue
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MapasTrimestraisView;
