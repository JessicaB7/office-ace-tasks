import { useState, useEffect, useMemo } from "react";
import { useClients, useCollaborators, useMonthlyObligations, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { Search, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import ClientDetailDialog from "@/components/ClientDetailDialog";
import ClientMonthlyHistoryDialog from "@/components/ClientMonthlyHistoryDialog";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface TabConfig {
  label: string;
  filter: (c: any) => boolean;
  hasIvaTabs?: boolean;
  hideNif?: boolean;
  columns?: string[];
  subFilters?: { value: string; label: string; match: (c: any) => boolean }[];
}

const SUB_PAGE_CONFIG: Record<string, TabConfig> = {
  TI_isento: {
    label: "TI Simplificado - Isento IVA",
    filter: (c) => c.tipo_contabilidade === "TI RS" && (c.iva === "Art.53º" || c.iva === "Art. 9º"),
  },
  TI_iva: {
    label: "TI Simplificado - Reg. IVA",
    filter: (c) => c.tipo_contabilidade === "TI RS" && c.iva !== "Art.53º" && c.iva !== "Art. 9º" && c.iva !== "" && c.iva != null,
    hasIvaTabs: true,
    hideNif: true,
    columns: ["Vendas", "Compras", "E-Fatura"],
    subFilters: [
      { value: "Mensal", label: "Mensal", match: (c) => c.iva === "Mensal" },
      { value: "Trimestral", label: "Trimestral", match: (c) => c.iva === "Trimestral" },
    ],
  },
  organizada: {
    label: "TI Contabilidade Organizada",
    filter: (c) => c.tipo_contabilidade === "TI CO",
    hasIvaTabs: true,
    hideNif: true,
    columns: ["Vendas", "Compras", "Bancos", "E-Fatura", "Análise"],
    subFilters: [
      { value: "Isento", label: "Isento", match: (c) => c.iva === "Art.53º" || c.iva === "Art. 9º" },
      { value: "Trimestral", label: "Trimestral", match: (c) => c.iva === "Trimestral" },
    ],
  },
  empresas: {
    label: "Empresas",
    filter: (c) => c.tipo_contabilidade === "SQ",
    hideNif: true,
  },
};

interface ContabilidadesViewProps {
  subPage?: string;
}

const CheckboxCell = ({ done, onClick }: { done: boolean; onClick: () => void }) => (
  <button onClick={onClick}
    className={cn("w-6 h-6 rounded border-2 flex items-center justify-center transition-colors mx-auto",
      done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 hover:border-primary")}>
    {done && <Check className="w-4 h-4" />}
  </button>
);

const ContabilidadesView = ({ subPage }: ContabilidadesViewProps) => {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<string>(subPage || "TI_isento");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [collabFilter, setCollabFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligations(referenceMonth);
  const upsert = useUpsertObligation();

  const config = SUB_PAGE_CONFIG[activeTab];
  const hasIvaTabs = config?.hasIvaTabs ?? false;
  const hideNif = config?.hideNif ?? false;
  const columns = config?.columns;
  const hasMultiColumns = !!columns && columns.length > 0;

  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage);
      const cfg = SUB_PAGE_CONFIG[subPage];
      setSubFilter(cfg?.subFilters?.[0]?.value || "all");
      setCollabFilter("all");
      setSearch("");
    }
  }, [subPage]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const activeClients = useMemo(() => clients.filter((c: any) => c.active), [clients]);

  const getCollabName = (id: string | null) => {
    if (!id) return "—";
    const col = collaborators.find((c: any) => c.id === id);
    return col ? col.name : "—";
  };

  // Build obligation type keys for each column
  const colOblTypes = useMemo(() => {
    if (!columns) return [];
    return columns.map((col) => `contabilidade_${activeTab}_${col.toLowerCase().replace(/[- ]/g, "_")}`);
  }, [columns, activeTab]);

  const oblType = `contabilidade_${activeTab}`;

  // Build maps for each column
  const colMaps = useMemo(() => {
    return colOblTypes.map((type) => {
      const map: Record<string, any> = {};
      obligations.forEach((o: any) => { if (o.obligation_type === type) map[o.client_id] = o; });
      return map;
    });
  }, [obligations, colOblTypes]);

  // Single column map (for simple tabs)
  const oblMap = useMemo(() => {
    const map: Record<string, any> = {};
    obligations.forEach((o: any) => { if (o.obligation_type === oblType) map[o.client_id] = o; });
    return map;
  }, [obligations, oblType]);

  const filteredClients = useMemo(() => {
    if (!config) return [];
    let list = activeClients.filter(config.filter);

    if (collabFilter !== "all") {
      if (collabFilter === "none") {
        list = list.filter((c: any) => !c.responsavel_id);
      } else {
        list = list.filter((c: any) => c.responsavel_id === collabFilter);
      }
    }
    if (hasIvaTabs && subFilter !== "all" && config.subFilters) {
      const sf = config.subFilters.find((f) => f.value === subFilter);
      if (sf) list = list.filter(sf.match);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c: any) => c.name.toLowerCase().includes(q) || (c.nif || "").includes(q));
    }
    return list.sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [activeClients, config, collabFilter, search, hasIvaTabs, subFilter]);

  const toggleObl = (clientId: string, type: string, map: Record<string, any>) => {
    const obl = map[clientId];
    const done = obl?.status === "concluida";
    upsert.mutate({
      client_id: clientId,
      obligation_type: type,
      reference_month: referenceMonth,
      status: done ? "pendente" : "concluida",
      completed_at: done ? null : new Date().toISOString(),
      completed_by: done ? null : user?.id || null,
      ...(obl?.id ? { id: obl.id } : {}),
    });
  };

  const doneCount = filteredClients.filter((c: any) => {
    if (hasMultiColumns) {
      return colMaps.every((map) => map[c.id]?.status === "concluida");
    }
    return oblMap[c.id]?.status === "concluida";
  }).length;

  // Sub-filter counts
  const baseClients = useMemo(() => {
    if (!hasIvaTabs || !config) return [];
    return activeClients.filter(config.filter);
  }, [activeClients, config, hasIvaTabs]);

  const subFilterCounts = useMemo(() => {
    if (!config?.subFilters) return [];
    return config.subFilters.map((sf) => ({
      ...sf,
      count: baseClients.filter(sf.match).length,
    }));
  }, [config, baseClients]);

  const totalCols = 2 + (hideNif ? 0 : 1) + (activeTab === "empresas" ? 1 : 0) + (hasMultiColumns ? columns!.length : 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{config?.label || "Contabilidades"}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {doneCount}/{filteredClients.length} concluídos
          </p>
        </div>
        <div className="flex items-center gap-2 bg-card rounded-lg border px-2 py-1">
          <button onClick={prevMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {hasIvaTabs && subFilterCounts.length > 0 && (
        <div className="flex gap-1 border-b pb-1">
          {subFilterCounts.map((tab) => (
            <button key={tab.value} onClick={() => setSubFilter(tab.value)}
              className={cn("px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                subFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select value={collabFilter} onChange={(e) => setCollabFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Todos os responsáveis</option>
          {collaborators.filter((c: any) => c.active).map((col: any) => (
            <option key={col.id} value={col.id}>{col.name}</option>
          ))}
          <option value="none">Sem responsável</option>
        </select>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                {!hideNif && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NIF</th>}
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                {activeTab === "empresas" && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Notas</th>}
                {hasMultiColumns ? (
                  columns!.map((col) => (
                    <th key={col} className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">{col}</th>
                  ))
                ) : (
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-12">✓</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client: any) => {
                const singleDone = oblMap[client.id]?.status === "concluida";
                const allDone = hasMultiColumns
                  ? colMaps.every((map) => map[client.id]?.status === "concluida")
                  : singleDone;

                return (
                  <tr key={client.id} className={cn("border-b last:border-0 transition-colors", allDone ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/30")}>
                    <td className={cn("px-4 py-3 font-medium", allDone && "line-through text-muted-foreground")}>
                      <button type="button" onClick={() => setSelectedClient(client)} className="hover:underline text-left">
                        {client.name}
                      </button>
                    </td>
                    {!hideNif && <td className="px-4 py-3 text-muted-foreground">{client.nif || "—"}</td>}
                    <td className="px-4 py-3 text-muted-foreground">{getCollabName(client.responsavel_id)}</td>
                    {activeTab === "empresas" && <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs whitespace-pre-wrap">{client.notas_internas || "—"}</td>}
                    {hasMultiColumns ? (
                      colMaps.map((map, i) => {
                        const done = map[client.id]?.status === "concluida";
                        return (
                          <td key={colOblTypes[i]} className="text-center px-3 py-3">
                            <CheckboxCell done={done} onClick={() => toggleObl(client.id, colOblTypes[i], map)} />
                          </td>
                        );
                      })
                    ) : (
                      <td className="text-center px-3 py-3">
                        <CheckboxCell done={singleDone} onClick={() => toggleObl(client.id, oblType, oblMap)} />
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr><td colSpan={totalCols} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(activeTab === "TI_iva" || activeTab === "organizada" || activeTab === "empresas") ? (
        <ClientMonthlyHistoryDialog
          client={selectedClient}
          open={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          activeTab={activeTab}
          columns={columns}
        />
      ) : (
        <ClientDetailDialog client={selectedClient} open={!!selectedClient} onClose={() => setSelectedClient(null)} allowDelete={false} />
      )}
    </div>
  );
};

export default ContabilidadesView;
