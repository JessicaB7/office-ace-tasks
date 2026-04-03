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

// Which clients need "Importado no TOC" extra column
const needsExtra = (client: any) =>
  client.tipo_contabilidade === "SQ" ||
  (client.tipo_contabilidade === "TI RS" && client.iva && client.iva !== "" && client.iva !== "Art.53º") ||
  client.tipo_contabilidade === "TI CO";

const ObrigacoesView = ({ subPage }: ObrigacoesViewProps) => {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [activeTab, setActiveTab] = useState<string>(subPage || "SAFT");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligations(referenceMonth);
  const upsert = useUpsertObligation();

  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage);
      setSubFilter("all");
      setSearch("");
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

  // Get deadline info
  const getDeadlineText = (): string => {
    switch (activeTab) {
      case "SAFT": {
        const deadlineMonth = month + 1 > 11 ? 0 : month + 1;
        const deadlineYear = month + 1 > 11 ? year + 1 : year;
        return `Prazo: 5/${String(deadlineMonth + 1).padStart(2, "0")}/${deadlineYear}`;
      }
      default: return "";
    }
  };

  // Filter clients for current tab
  const filteredClients = useMemo(() => {
    let list: any[] = [];
    switch (activeTab) {
      case "SAFT":
        list = activeClients.filter((c: any) => c.saft && c.saft !== "");
        if (subFilter !== "all") list = list.filter((c: any) => c.saft === subFilter);
        break;
      case "salarios":
        list = activeClients.filter((c: any) => c.salarios && c.salarios !== "Não tem" && c.salarios !== "");
        if (subFilter !== "all") list = list.filter((c: any) => c.salarios === subFilter);
        break;
      case "DMR":
        list = activeClients.filter((c: any) => c.salarios && c.salarios !== "Não tem" && c.salarios !== "");
        break;
      case "SS_TI":
        list = activeClients.filter((c: any) => c.seguranca_social && c.seguranca_social !== "");
        if (subFilter !== "all") list = list.filter((c: any) => c.seguranca_social === subFilter);
        break;
      case "IVA":
        list = activeClients.filter((c: any) => c.iva && c.iva !== "");
        if (subFilter !== "all") list = list.filter((c: any) => c.iva === subFilter);
        break;
      case "retencao_fonte":
        list = activeClients.filter((c: any) => c.tipo_contabilidade === "TI CO" || c.tipo_contabilidade === "TI RS");
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

  // Build obligation lookup: client_id -> obligation record
  const oblMap = useMemo(() => {
    const map: Record<string, any> = {};
    obligations.forEach((o: any) => {
      if (o.obligation_type === activeTab) {
        map[o.client_id] = o;
      }
    });
    return map;
  }, [obligations, activeTab]);

  const toggleStatus = async (clientId: string) => {
    const existing = oblMap[clientId];
    if (existing) {
      const newStatus = existing.status === "concluida" ? "pendente" : "concluida";
      await upsert.mutateAsync({
        id: existing.id,
        client_id: clientId,
        obligation_type: activeTab,
        reference_month: referenceMonth,
        status: newStatus,
        completed_at: newStatus === "concluida" ? new Date().toISOString() : null,
        completed_by: newStatus === "concluida" ? user?.id || null : null,
      });
    } else {
      await upsert.mutateAsync({
        client_id: clientId,
        obligation_type: activeTab,
        reference_month: referenceMonth,
        status: "concluida",
        completed_at: new Date().toISOString(),
        completed_by: user?.id || null,
      });
    }
  };

  const toggleExtra = async (clientId: string) => {
    const existing = oblMap[clientId];
    if (existing) {
      await upsert.mutateAsync({
        id: existing.id,
        client_id: clientId,
        obligation_type: activeTab,
        reference_month: referenceMonth,
        status: existing.status,
        extra_done: !existing.extra_done,
      });
    } else {
      await upsert.mutateAsync({
        client_id: clientId,
        obligation_type: activeTab,
        reference_month: referenceMonth,
        status: "pendente",
        extra_done: true,
      });
    }
  };

  const getSubFilterOptions = () => {
    switch (activeTab) {
      case "SAFT": return SAFT_GROUPS.map(g => ({ value: g, label: g }));
      case "salarios": return SALARIOS_FILTERS;
      case "SS_TI": return [
        { value: "Mensal", label: "Mensal" },
        { value: "Trimestral", label: "Trimestral" },
        { value: "Contabilidade Organizada", label: "Cont. Organizada" },
        { value: "TCO", label: "TCO" },
        { value: "Isento", label: "Isento" },
      ];
      case "IVA": return [
        { value: "Mensal", label: "Mensal" },
        { value: "Trimestral", label: "Trimestral" },
        { value: "Art. 9º", label: "Isenção Art. 9º" },
        { value: "Art.53º", label: "Isenção Art. 53º" },
      ];
      default: return [];
    }
  };

  const subFilterOptions = getSubFilterOptions();
  const showExtra = activeTab === "SAFT";
  const deadlineText = getDeadlineText();

  const doneCount = filteredClients.filter(c => oblMap[c.id]?.status === "concluida").length;

  const pageLabels: Record<string, string> = {
    SAFT: "SAFT", salarios: "Salários", DMR: "DMR", SS_TI: "Segurança Social TI",
    IVA: "IVA", retencao_fonte: "Retenção na Fonte", emissao_faturas: "Emissão de Faturas",
  };

  if (loadingClients || loadingObl) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-5">
      {/* Header with month navigation */}
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

      {/* Sub-filter tabs */}
      {subFilterOptions.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 border-b">
          {subFilterOptions.map((opt) => {
            const count = (() => {
              switch (activeTab) {
                case "SAFT": return activeClients.filter((c: any) => c.saft === opt.value).length;
                case "salarios": return activeClients.filter((c: any) => c.salarios === opt.value).length;
                case "SS_TI": return activeClients.filter((c: any) => c.seguranca_social === opt.value).length;
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Pesquisar por nome ou NIF..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Client checklist table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-12">✓</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NIF</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                {showExtra && <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Importado TOC</th>}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client: any) => {
                const obl = oblMap[client.id];
                const isDone = obl?.status === "concluida";
                const isExtraDone = obl?.extra_done === true;
                const showExtraForClient = showExtra && needsExtra(client);

                return (
                  <tr key={client.id} className={cn("border-b last:border-0 transition-colors", isDone ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/30")}>
                    <td className="text-center px-3 py-3">
                      <button
                        onClick={() => toggleStatus(client.id)}
                        disabled={upsert.isPending}
                        className={cn(
                          "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                          isDone
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-muted-foreground/30 hover:border-primary"
                        )}
                      >
                        {isDone && <Check className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className={cn("px-4 py-3 font-medium", isDone && "line-through text-muted-foreground")}>{client.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.nif || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">
                        {client.tipo_contabilidade || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{getCollabName(client.responsavel_id)}</td>
                    {showExtra && (
                      <td className="text-center px-3 py-3">
                        {showExtraForClient ? (
                          <button
                            onClick={() => toggleExtra(client.id)}
                            disabled={upsert.isPending}
                            className={cn(
                              "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors mx-auto",
                              isExtraDone
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "border-muted-foreground/30 hover:border-primary"
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
                <tr><td colSpan={showExtra ? 6 : 5} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ObrigacoesView;
