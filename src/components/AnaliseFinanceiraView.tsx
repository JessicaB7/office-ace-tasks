import { useMemo, useState } from "react";
import { Building2, Search, ChevronRight } from "lucide-react";
import { useClients } from "@/hooks/useSupabaseQuery";
import ClientAnalysisView from "@/components/ClientAnalysisView";

const TYPE_CONFIG: Record<string, { label: string; tipo: string; accentClass: string }> = {
  TI_simplificado: {
    label: "Análise Financeira — TI Simplificado",
    tipo: "TI RS",
    accentClass: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  },
  TI_organizado: {
    label: "Análise Financeira — TI Organizado",
    tipo: "TI CO",
    accentClass: "bg-amber-500/10 text-amber-700 border-amber-200",
  },
  empresas: {
    label: "Análise Financeira — Empresas",
    tipo: "SQ",
    accentClass: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
};

export default function AnaliseFinanceiraView({ subPage }: { subPage: string }) {
  const cfg = TYPE_CONFIG[subPage] ?? TYPE_CONFIG.TI_simplificado;
  const { data: clients = [], isLoading } = useClients();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients as any[])
      .filter((c) => c.tipo_contabilidade === cfg.tipo)
      .filter((c) =>
        !q
          ? true
          : (c.name || "").toLowerCase().includes(q) ||
            String(c.nif || "").includes(q),
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [clients, cfg.tipo, search]);

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
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar cliente ou NIF…"
            className="pl-9 pr-3 py-2 rounded-lg border bg-card text-sm w-72 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">A carregar…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          Não existem clientes neste regime.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:border-primary hover:shadow-sm transition-all"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${cfg.accentClass}`}>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.nif ? `NIF ${c.nif}` : "Sem NIF"}
                  {c.iva ? ` · IVA ${c.iva}` : ""}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
