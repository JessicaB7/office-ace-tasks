import { useMemo, useState } from "react";
import { useClients, useCollaborators, useUpsertClient } from "@/hooks/useSupabaseQuery";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Estado da dívida (AT ou SS) de cada cliente. Vazio = por verificar. */
export const DIVIDA_AT_OPTIONS = [
  { value: "por_verificar", label: "Por verificar", cls: "bg-muted text-muted-foreground" },
  { value: "sem_divida", label: "Sem dívida", cls: "bg-success/15 text-success" },
  { value: "com_divida", label: "Com dívida", cls: "bg-destructive/15 text-destructive" },
] as const;

const TIPO_LABELS: Record<string, string> = { SQ: "Empresa", "TI RS": "TI Simplificado", "TI CO": "TI Organizado" };
const tipoColor = (tipo: string | null) => {
  switch (tipo) {
    case "SQ": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "TI CO": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "TI RS": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    default: return "bg-muted text-muted-foreground";
  }
};

const inputClass = "w-full text-xs px-2 py-1 rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring";

/** Visão geral → Controlo de dívidas CRM: todos os clientes, estado da dívida à AT e à SS, e descrição. */
const DividasView = () => {
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertClient();
  const [search, setSearch] = useState("");
  // Filtro: "all" ou "<at|ss>:<estado>"
  const [filtro, setFiltro] = useState("all");
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const nomeResp = (id: string | null) => collaborators.find((c: any) => c.id === id)?.name || "—";

  const lista = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c: any) => {
      if (!mostrarInativos && c.status === "inativo") return false;
      if (filtro !== "all") {
        const [ent, val] = filtro.split(":");
        if ((c[`divida_${ent}`] || "por_verificar") !== val) return false;
      }
      return !q || c.name.toLowerCase().includes(q) || (c.nif || "").includes(q);
    });
  }, [clients, search, filtro, mostrarInativos]);

  const contagem = (ent: "at" | "ss", v: string) =>
    clients.filter((c: any) => (mostrarInativos || c.status !== "inativo") && (c[`divida_${ent}`] || "por_verificar") === v).length;

  const guardar = (c: any, campos: Record<string, string | null>) =>
    upsert.mutate({ id: c.id, name: c.name, ...campos } as any, {
      onError: (e: any) => toast.error("Não foi possível guardar: " + (e.message || "erro")),
    });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Controlo de dívidas CRM</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Dívidas dos clientes à AT (Finanças) e à Segurança Social. Escolha o estado e descreva a situação — grava automaticamente.
        </p>
      </div>

      <div className="space-y-2">
        {(["at", "ss"] as const).map((ent) => (
          <div key={ent} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground w-[110px]">{ent === "at" ? "AT / Finanças" : "Segurança Social"}</span>
            {DIVIDA_AT_OPTIONS.map((o) => {
              const key = `${ent}:${o.value}`;
              return (
                <button
                  key={key}
                  onClick={() => setFiltro(filtro === key ? "all" : key)}
                  className={cn("text-xs font-medium px-3 py-1.5 rounded-full border transition-colors", filtro === key ? "ring-2 ring-ring" : "", o.cls)}
                >
                  {o.label} · {contagem(ent, o.value)}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Procurar nome ou NIF…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos
        </label>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Cliente</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-left px-4 py-3">Responsável</th>
              <th className="text-left px-4 py-3 w-[160px]">AT / Finanças</th>
              <th className="text-left px-4 py-3 w-[160px]">Segurança Social</th>
              <th className="text-left px-4 py-3 min-w-[320px]">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c: any) => {
              const optOf = (ent: "at" | "ss") => DIVIDA_AT_OPTIONS.find((o) => o.value === (c[`divida_${ent}`] || "por_verificar"))!;
              return (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.nif || "—"}{c.status === "a_sair" ? " · A sair" : c.status === "inativo" ? " · Inativo" : ""}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", tipoColor(c.tipo_contabilidade))}>
                      {TIPO_LABELS[c.tipo_contabilidade] || c.tipo_contabilidade || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{nomeResp(c.responsavel_id)}</td>
                  {(["at", "ss"] as const).map((ent) => {
                    const opt = optOf(ent);
                    return (
                      <td key={ent} className="px-4 py-2">
                        <select
                          value={opt.value}
                          onChange={(e) => guardar(c, { [`divida_${ent}`]: e.target.value })}
                          className={cn("text-xs font-medium px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-ring", opt.cls)}
                        >
                          {DIVIDA_AT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      key={`${c.id}-divida`}
                      defaultValue={c.divida_descricao || ""}
                      placeholder="Descrever a situação…"
                      className={inputClass}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (c.divida_descricao || "")) guardar(c, { divida_descricao: val || null });
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                  </td>
                </tr>
              );
            })}
            {!isLoading && lista.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Sem clientes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DividasView;
