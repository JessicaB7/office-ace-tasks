import { useMemo, useState } from "react";
import { Search, ChevronRight, Filter, X } from "lucide-react";
import { useClients, useCollaborators } from "@/hooks/useSupabaseQuery";
import ClientAnalysisView from "@/components/ClientAnalysisView";
import ClientDetailDialog from "@/components/ClientDetailDialog";

const TYPE_CONFIG: Record<string, { label: string; tipo: string; accentClass: string }> = {
  TI_simplificado: {
    label: "Análise Financeira — TI Simplificado",
    tipo: "TI RS",
    accentClass: "text-emerald-700",
  },
  TI_organizado: {
    label: "Análise Financeira — TI Organizado",
    tipo: "TI CO",
    accentClass: "text-amber-700",
  },
  empresas: {
    label: "Análise Financeira — Empresas",
    tipo: "SQ",
    accentClass: "text-blue-700",
  },
};

export default function AnaliseFinanceiraView({ subPage }: { subPage: string }) {
  const cfg = TYPE_CONFIG[subPage] ?? TYPE_CONFIG.TI_simplificado;
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fichaClient, setFichaClient] = useState<any | null>(null);
  const [ivaFilter, setIvaFilter] = useState("");
  const [respFilter, setRespFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const ivaOptions = useMemo(() => {
    const set = new Set<string>();
    (clients as any[]).forEach((c) => { if (c.iva) set.add(c.iva); });
    return Array.from(set).sort();
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients as any[])
      .filter((c) => c.tipo_contabilidade === cfg.tipo)
      .filter((c) => (!ivaFilter ? true : c.iva === ivaFilter))
      .filter((c) => (!respFilter ? true : c.responsavel_id === respFilter))
      .filter((c) => (!statusFilter ? true : (c.status || "ativo") === statusFilter))
      .filter((c) =>
        !q
          ? true
          : (c.name || "").toLowerCase().includes(q) ||
            String(c.nif || "").includes(q),
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [clients, cfg.tipo, search, ivaFilter, respFilter, statusFilter]);

  const activeFilters = (ivaFilter ? 1 : 0) + (respFilter ? 1 : 0) + (statusFilter ? 1 : 0);


  if (selectedId) {
    return (
      <ClientAnalysisView
        clientId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{cfg.label}</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} cliente{filtered.length === 1 ? "" : "s"} neste regime
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar cliente ou NIF…"
              className="pl-9 pr-3 py-2 rounded-lg border bg-card text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {ivaOptions.length > 0 && (
            <select
              value={ivaFilter}
              onChange={(e) => setIvaFilter(e.target.value)}
              className="py-2 px-3 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Todos os IVA</option>
              {ivaOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}

          <select
            value={respFilter}
            onChange={(e) => setRespFilter(e.target.value)}
            className="py-2 px-3 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos os responsáveis</option>
            {collaborators.map((col: any) => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Todos os estados</option>
            <option value="ativo">Ativo</option>
            <option value="a_sair">A sair</option>
            <option value="inativo">Inativo</option>
          </select>

          {activeFilters > 0 && (
            <button
              onClick={() => { setIvaFilter(""); setRespFilter(""); setStatusFilter(""); }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border bg-card text-sm hover:bg-muted transition-colors"
              title="Limpar filtros"
            >
              <X className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">A carregar…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          Não existem clientes neste regime.
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">NIF</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">IVA</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40">Responsável</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c: any) => {
                const resp = collaborators.find((col: any) => col.id === c.responsavel_id);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <td className={`px-4 py-2.5 font-medium ${cfg.accentClass}`}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFichaClient(c); }}
                        className="hover:underline text-left"
                        title="Abrir ficha do cliente"
                      >
                        {c.name}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.nif || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.iva || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{resp?.name || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        (c.status || "ativo") === "ativo"
                          ? "bg-emerald-100 text-emerald-700"
                          : c.status === "a_sair"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      }`}>
                        {(c.status || "ativo") === "ativo" ? "Ativo" : c.status === "a_sair" ? "A sair" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ClientDetailDialog
        client={fichaClient}
        open={!!fichaClient}
        onClose={() => setFichaClient(null)}
      />
    </div>
  );
}
