import { useState, useEffect, useMemo } from "react";
import { useClients, useCollaborators, useMonthlyObligations, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { Search, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import ClientDetailDialog from "@/components/ClientDetailDialog";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const SUB_PAGE_CONFIG: Record<string, { label: string; filter: (c: any) => boolean }> = {
  TI_isento: {
    label: "TI Simplificado - Isento IVA",
    filter: (c) => c.tipo_contabilidade === "TI RS" && (c.iva === "Art.53º" || c.iva === "Art. 9º"),
  },
  TI_iva: {
    label: "TI Simplificado - Reg. IVA",
    filter: (c) => c.tipo_contabilidade === "TI RS" && c.iva !== "Art.53º" && c.iva !== "Art. 9º" && c.iva !== "" && c.iva != null,
  },
  organizada: {
    label: "Contabilidade Organizada",
    filter: (c) => c.tipo_contabilidade === "TI CO",
  },
  empresas: {
    label: "Empresas",
    filter: (c) => c.tipo_contabilidade === "SQ",
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

  const isTIiva = activeTab === "TI_iva";

  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage);
      setSubFilter(subPage === "TI_iva" ? "Mensal" : "all");
      setCollabFilter("all");
      setSearch("");
    }
  }, [subPage]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const activeClients = useMemo(() => clients.filter((c: any) => c.active), [clients]);

  const config = SUB_PAGE_CONFIG[activeTab];

  const getCollabName = (id: string | null) => {
    if (!id) return "—";
    const col = collaborators.find((c: any) => c.id === id);
    return col ? col.name : "—";
  };

  const oblType = `contabilidade_${activeTab}`;
  const oblTypeVendas = `contabilidade_${activeTab}_vendas`;
  const oblTypeCompras = `contabilidade_${activeTab}_compras`;
  const oblTypeEfatura = `contabilidade_${activeTab}_efatura`;

  const oblMap = useMemo(() => {
    const map: Record<string, any> = {};
    obligations.forEach((o: any) => {
      if (o.obligation_type === oblType) map[o.client_id] = o;
    });
    return map;
  }, [obligations, oblType]);

  const oblMapVendas = useMemo(() => {
    const map: Record<string, any> = {};
    obligations.forEach((o: any) => { if (o.obligation_type === oblTypeVendas) map[o.client_id] = o; });
    return map;
  }, [obligations, oblTypeVendas]);

  const oblMapCompras = useMemo(() => {
    const map: Record<string, any> = {};
    obligations.forEach((o: any) => { if (o.obligation_type === oblTypeCompras) map[o.client_id] = o; });
    return map;
  }, [obligations, oblTypeCompras]);

  const oblMapEfatura = useMemo(() => {
    const map: Record<string, any> = {};
    obligations.forEach((o: any) => { if (o.obligation_type === oblTypeEfatura) map[o.client_id] = o; });
    return map;
  }, [obligations, oblTypeEfatura]);

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
    if (isTIiva && subFilter !== "all") {
      list = list.filter((c: any) => c.iva === subFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c: any) => c.name.toLowerCase().includes(q) || (c.nif || "").includes(q));
    }
    return list.sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [activeClients, config, collabFilter, search, isTIiva, subFilter]);

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

  const toggleDone = (clientId: string) => toggleObl(clientId, oblType, oblMap);

  const doneCount = filteredClients.filter((c: any) => oblMap[c.id]?.status === "concluida").length;

  const tiIvaClients = useMemo(() => {
    if (!isTIiva || !config) return [];
    return activeClients.filter(config.filter);
  }, [activeClients, config, isTIiva]);
  const mensalCount = tiIvaClients.filter((c: any) => c.iva === "Mensal").length;
  const trimestralCount = tiIvaClients.filter((c: any) => c.iva === "Trimestral").length;

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

      {/* Sub-filter tabs for TI_iva */}
      {isTIiva && (
        <div className="flex gap-1 border-b pb-1">
          {[
            { value: "Mensal", label: "Mensal", count: mensalCount },
            { value: "Trimestral", label: "Trimestral", count: trimestralCount },
          ].map((tab) => (
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
                {!isTIiva && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NIF</th>}
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                {isTIiva ? (
                  <>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">Vendas</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">Compras</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">E-Fatura</th>
                  </>
                ) : (
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-12">✓</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client: any) => {
                const done = oblMap[client.id]?.status === "concluida";
                const vendasDone = oblMapVendas[client.id]?.status === "concluida";
                const comprasDone = oblMapCompras[client.id]?.status === "concluida";
                const efaturaDone = oblMapEfatura[client.id]?.status === "concluida";
                const allDone = isTIiva ? (vendasDone && comprasDone && efaturaDone) : done;

                return (
                  <tr key={client.id} className={cn("border-b last:border-0 transition-colors", allDone ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/30")}>
                    <td className={cn("px-4 py-3 font-medium", allDone && "line-through text-muted-foreground")}>
                      <button type="button" onClick={() => setSelectedClient(client)} className="hover:underline text-left">
                        {client.name}
                      </button>
                    </td>
                    {!isTIiva && <td className="px-4 py-3 text-muted-foreground">{client.nif || "—"}</td>}
                    <td className="px-4 py-3 text-muted-foreground">{getCollabName(client.responsavel_id)}</td>
                    {isTIiva ? (
                      <>
                        <td className="text-center px-3 py-3">
                          <CheckboxCell done={vendasDone} onClick={() => toggleObl(client.id, oblTypeVendas, oblMapVendas)} />
                        </td>
                        <td className="text-center px-3 py-3">
                          <CheckboxCell done={comprasDone} onClick={() => toggleObl(client.id, oblTypeCompras, oblMapCompras)} />
                        </td>
                        <td className="text-center px-3 py-3">
                          <CheckboxCell done={efaturaDone} onClick={() => toggleObl(client.id, oblTypeEfatura, oblMapEfatura)} />
                        </td>
                      </>
                    ) : (
                      <td className="text-center px-3 py-3">
                        <CheckboxCell done={done} onClick={() => toggleDone(client.id)} />
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr><td colSpan={isTIiva ? 5 : 4} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClientDetailDialog client={selectedClient} open={!!selectedClient} onClose={() => setSelectedClient(null)} allowDelete={false} />
    </div>
  );
};

export default ContabilidadesView;
