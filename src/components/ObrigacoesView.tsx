import { useState, useEffect, useMemo } from "react";
import { useClients, useCollaborators, useMonthlyObligations, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import { Search, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const SAFT_GROUPS = ["Automático", "A entregar", "Não Aplicável"];
const SALARIOS_FILTERS = [
  { value: "Sim até dia 25", label: "Até dia 25" },
  { value: "Sim até ao fim do mês", label: "Até ao fim do mês" },
];

interface ObrigacoesViewProps {
  subPage?: string;
  onEditTask?: (task: any) => void;
}

const needsExtra = (client: any) =>
  client.tipo_contabilidade === "SQ" ||
  (client.tipo_contabilidade === "TI RS" && client.iva && client.iva !== "" && client.iva !== "Art.53º") ||
  client.tipo_contabilidade === "TI CO";

const hasSalarios = (c: any) => c.salarios && c.salarios !== "Não tem" && c.salarios !== "";
const isTI = (c: any) => c.tipo_contabilidade === "TI RS" || c.tipo_contabilidade === "TI CO";

// Helper: add N months to a 0-based month/year, returns { m, y } (0-based month)
const addMonths = (m: number, y: number, n: number) => {
  const total = m + n;
  return { m: ((total % 12) + 12) % 12, y: y + Math.floor(total / 12) };
};

const fmtDeadline = (day: number, m0: number, y: number) =>
  `Prazo: ${day}/${String(m0 + 1).padStart(2, "0")}/${y}`;

const ObrigacoesView = ({ subPage }: ObrigacoesViewProps) => {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<string>(subPage || "SAFT");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [dmrTab, setDmrTab] = useState<"DMR_AT" | "DMR_SS">("DMR_AT");
  const [search, setSearch] = useState("");

  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligations(referenceMonth);
  const upsert = useUpsertObligation();

  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage);
      setSubFilter("all");
      setSearch("");
      if (subPage === "DMR") setDmrTab("DMR_AT");
    }
  }, [subPage]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const activeClients = useMemo(() => clients.filter((c: any) => c.active), [clients]);

  const getCollabName = (id: string | null) => {
    if (!id) return "—";
    const col = collaborators.find((c: any) => c.id === id);
    return col ? col.name : "—";
  };

  const getDeadlineText = (): string => {
    switch (activeTab) {
      case "SAFT": {
        const d = addMonths(month, year, 1);
        return fmtDeadline(5, d.m, d.y);
      }
      case "IVA": {
        if (subFilter === "Trimestral") {
          // Trimestral: deadline day 20 of 2nd month after quarter end
          // Q1(Jan-Mar)->May 20, Q2(Apr-Jun)->Aug 20, Q3(Jul-Sep)->Nov 20, Q4(Oct-Dec)->Feb 20
          const quarterEndMonth = [2, 2, 2, 5, 5, 5, 8, 8, 8, 11, 11, 11][month]; // 0-based
          const d = addMonths(quarterEndMonth, year, 2);
          return fmtDeadline(20, d.m, d.y);
        }
        // Mensal: day 20 of 2nd month after reference
        const d = addMonths(month, year, 2);
        return fmtDeadline(20, d.m, d.y);
      }
      case "retencao_fonte": {
        const d = addMonths(month, year, 1);
        return fmtDeadline(20, d.m, d.y);
      }
      default: return "";
    }
  };

  const isDMR = activeTab === "DMR";

  const filteredClients = useMemo(() => {
    let list: any[] = [];
    switch (activeTab) {
      case "SAFT":
        list = activeClients.filter((c: any) => c.saft && c.saft !== "");
        if (subFilter !== "all") list = list.filter((c: any) => c.saft === subFilter);
        break;
      case "salarios":
        list = activeClients.filter((c: any) => hasSalarios(c));
        if (subFilter !== "all") list = list.filter((c: any) => c.salarios === subFilter);
        break;
      case "DMR":
        list = activeClients.filter((c: any) => hasSalarios(c));
        break;
      case "SS_TI":
        list = activeClients.filter((c: any) => isTI(c) && !hasSalarios(c));
        break;
      case "IVA":
        list = activeClients.filter((c: any) => c.iva && c.iva !== "");
        if (subFilter !== "all") list = list.filter((c: any) => c.iva === subFilter);
        break;
      case "retencao_fonte":
        list = activeClients.filter((c: any) => c.tipo_contabilidade === "SQ" || c.tipo_contabilidade === "TI CO");
        break;
      case "emissao_faturas":
        list = activeClients.filter((c: any) => c.faturacao === "Emitir");
        break;
      default:
        list = activeClients;
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: any) => c.name.toLowerCase().includes(s) || (c.nif || "").includes(s));
    }
    return list;
  }, [activeClients, activeTab, subFilter, search]);

  // Build obligation maps
  const oblMap = useMemo(() => {
    const map: Record<string, any> = {};
    const type = isDMR ? dmrTab : activeTab;
    obligations.forEach((o: any) => {
      if (o.obligation_type === type) map[o.client_id] = o;
    });
    return map;
  }, [obligations, activeTab, isDMR, dmrTab]);

  // For DMR: guia and pagamento tracked via extra_done
  // guia = status concluida, pagamento = extra_done
  const toggleObligation = async (clientId: string, oblType: string, currentMap: Record<string, any>) => {
    const existing = currentMap[clientId];
    if (existing) {
      const newStatus = existing.status === "concluida" ? "pendente" : "concluida";
      await upsert.mutateAsync({
        id: existing.id, client_id: clientId, obligation_type: oblType,
        reference_month: referenceMonth, status: newStatus,
        completed_at: newStatus === "concluida" ? new Date().toISOString() : null,
        completed_by: newStatus === "concluida" ? user?.id || null : null,
      });
    } else {
      await upsert.mutateAsync({
        client_id: clientId, obligation_type: oblType,
        reference_month: referenceMonth, status: "concluida",
        completed_at: new Date().toISOString(), completed_by: user?.id || null,
      });
    }
  };

  const toggleGuia = (clientId: string) => toggleObligation(clientId, isDMR ? dmrTab : activeTab, oblMap);

  const togglePagamento = async (clientId: string) => {
    const oblType = isDMR ? dmrTab : activeTab;
    const existing = oblMap[clientId];
    if (existing) {
      await upsert.mutateAsync({
        id: existing.id, client_id: clientId, obligation_type: oblType,
        reference_month: referenceMonth, status: existing.status, extra_done: !existing.extra_done,
      });
    } else {
      await upsert.mutateAsync({
        client_id: clientId, obligation_type: oblType,
        reference_month: referenceMonth, status: "pendente", extra_done: true,
      });
    }
  };

  const toggleExtra = async (clientId: string) => {
    const existing = oblMap[clientId];
    if (existing) {
      await upsert.mutateAsync({
        id: existing.id, client_id: clientId, obligation_type: activeTab,
        reference_month: referenceMonth, status: existing.status, extra_done: !existing.extra_done,
      });
    } else {
      await upsert.mutateAsync({
        client_id: clientId, obligation_type: activeTab,
        reference_month: referenceMonth, status: "pendente", extra_done: true,
      });
    }
  };

  const getSubFilterOptions = () => {
    switch (activeTab) {
      case "SAFT": return SAFT_GROUPS.map(g => ({ value: g, label: g }));
      case "salarios": return SALARIOS_FILTERS;
      case "SS_TI": return [
        { value: "Trimestral", label: "Trimestral" },
        { value: "Contabilidade Organizada", label: "Cont. Organizada" },
        { value: "TCO", label: "TCO" },
        { value: "Isento", label: "Isento" },
      ];
      case "IVA": return [
        { value: "Mensal", label: "Mensal" },
        { value: "Trimestral", label: "Trimestral" },
      ];
      default: return [];
    }
  };

  const subFilterOptions = getSubFilterOptions();
  const showSaftExtra = activeTab === "SAFT";
  const showGuiaPagamento = isDMR;
  const deadlineText = getDeadlineText();

  const doneCount = filteredClients.filter(c => oblMap[c.id]?.status === "concluida").length;

  const pageLabels: Record<string, string> = {
    SAFT: "SAFT", salarios: "Salários", DMR: "DMR", SS_TI: "Segurança Social TI",
    IVA: "IVA", retencao_fonte: "Retenção na Fonte", emissao_faturas: "Emissão de Faturas",
  };

  const totalCols = (() => {
    let cols = 5; // base: checkbox + name + nif + tipo + responsavel
    if (showGuiaPagamento) cols += 1; // extra pagamento column
    if (showSaftExtra) cols += 1; // importado TOC
    return cols;
  })();

  if (loadingClients || loadingObl) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  const CheckboxCell = ({ done, onClick }: { done: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={upsert.isPending}
      className={cn(
        "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
        done ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/30 hover:border-primary"
      )}
    >
      {done && <Check className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{pageLabels[activeTab] || activeTab}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {doneCount}/{filteredClients.length} concluídas
            {deadlineText && <span className="ml-3 text-orange-500 font-medium">{deadlineText}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* DMR tabs */}
      {isDMR && (
        <div className="flex gap-1 border-b">
          {(["DMR_AT", "DMR_SS"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDmrTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                dmrTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab === "DMR_AT" ? "DMR AT" : "DMR SS"}
            </button>
          ))}
        </div>
      )}

      {/* Sub-filter tabs */}
      {subFilterOptions.length > 0 && !isDMR && (
        <div className="flex gap-1 overflow-x-auto pb-1 border-b">
          {subFilterOptions.map((opt) => {
            const count = (() => {
              switch (activeTab) {
                case "SAFT": return activeClients.filter((c: any) => c.saft === opt.value).length;
                case "salarios": return activeClients.filter((c: any) => c.salarios === opt.value).length;
                case "SS_TI": return activeClients.filter((c: any) => isTI(c) && !hasSalarios(c) && c.seguranca_social === opt.value).length;
                case "IVA": return activeClients.filter((c: any) => c.iva === opt.value).length;
                default: return 0;
              }
            })();
            return (
              <button
                key={opt.value}
                onClick={() => setSubFilter(subFilter === opt.value ? "all" : opt.value)}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                  subFilter === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Pesquisar por nome ou NIF..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-12">
                  {showGuiaPagamento ? "Guia" : "✓"}
                </th>
                {showGuiaPagamento && (
                  <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-12">Pagamento</th>
                )}
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NIF</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                {showSaftExtra && <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Importado TOC</th>}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client: any) => {
                const obl = oblMap[client.id];
                const guiaDone = obl?.status === "concluida";
                const pagamentoDone = obl?.extra_done === true;
                const isExtraDone = obl?.extra_done === true;
                const showExtraForClient = showSaftExtra && needsExtra(client);
                const rowDone = showGuiaPagamento ? (guiaDone && pagamentoDone) : guiaDone;

                return (
                  <tr key={client.id} className={cn("border-b last:border-0 transition-colors", rowDone ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/30")}>
                    <td className="text-center px-3 py-3">
                      <CheckboxCell done={guiaDone} onClick={() => toggleGuia(client.id)} />
                    </td>
                    {showGuiaPagamento && (
                      <td className="text-center px-3 py-3">
                        <CheckboxCell done={pagamentoDone} onClick={() => togglePagamento(client.id)} />
                      </td>
                    )}
                    <td className={cn("px-4 py-3 font-medium", rowDone && "line-through text-muted-foreground")}>{client.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.nif || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">
                        {client.tipo_contabilidade || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{getCollabName(client.responsavel_id)}</td>
                    {showSaftExtra && (
                      <td className="text-center px-3 py-3">
                        {showExtraForClient ? (
                          <button
                            onClick={() => toggleExtra(client.id)}
                            disabled={upsert.isPending}
                            className={cn(
                              "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors mx-auto",
                              isExtraDone ? "bg-blue-500 border-blue-500 text-white" : "border-muted-foreground/30 hover:border-primary"
                            )}
                          >
                            {isExtraDone && <Check className="w-4 h-4" />}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
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
    </div>
  );
};

export default ObrigacoesView;
