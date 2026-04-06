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

const addMonths = (m: number, y: number, n: number) => {
  const total = m + n;
  return { m: ((total % 12) + 12) % 12, y: y + Math.floor(total / 12) };
};
const fmtDeadline = (day: number, m0: number, y: number) =>
  `Prazo: ${day}/${String(m0 + 1).padStart(2, "0")}/${y}`;

// Pages where checkboxes go on the RIGHT side
const checkboxRight = new Set(["DMR", "retencao_fonte", "IVA", "SS_TI", "SAFT", "salarios"]);
// Pages where NIF is hidden
const hideNif = new Set(["DMR", "SS_TI", "IVA", "retencao_fonte", "SAFT", "salarios"]);
const SS_TI_FILTERS = [
  { value: "Referência", label: "Referência" },
  { value: "Débito Direto", label: "Débito Direto" },
];
const SS_TI_DT_FILTERS = [
  { value: "Trimestral", label: "Trimestral" },
  { value: "Mensal", label: "Mensal" },
  { value: "TCO", label: "TCO" },
  { value: "Isento", label: "Isento" },
];

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
  const [ssTiTab, setSsTiTab] = useState<"SS_TI" | "SS_TI_DT">("SS_TI");
  const [collabFilter, setCollabFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const referenceMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligations(referenceMonth);
  const upsert = useUpsertObligation();

  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage);
      setSubFilter("all");
      setCollabFilter("all");
      setSearch("");
      if (subPage === "DMR") setDmrTab("DMR_AT");
      if (subPage === "SS_TI") setSsTiTab("SS_TI");
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

  const getDeadlineText = (): string => {
    switch (activeTab) {
      case "SAFT": { const d = addMonths(month, year, 1); return fmtDeadline(5, d.m, d.y); }
      case "DMR": { const d = addMonths(month, year, 1); return fmtDeadline(20, d.m, d.y); }
      case "retencao_fonte": { const d = addMonths(month, year, 1); return fmtDeadline(20, d.m, d.y); }
      case "IVA": {
        if (subFilter === "Trimestral") {
          const qEnd = [2,2,2,5,5,5,8,8,8,11,11,11][month];
          const d = addMonths(qEnd, year, 2);
          return fmtDeadline(20, d.m, d.y);
        }
        const d = addMonths(month, year, 2);
        return fmtDeadline(20, d.m, d.y);
      }
      case "SS_TI": { const d = addMonths(month, year, 1); return fmtDeadline(20, d.m, d.y); }
      default: return "";
    }
  };

  const isDMR = activeTab === "DMR";
  const isIVA = activeTab === "IVA";
  const isSSTI = activeTab === "SS_TI";
  const isRight = checkboxRight.has(activeTab);
  const showNif = !hideNif.has(activeTab);
  const showSaftExtra = activeTab === "SAFT";
  const showGuiaPagamento = isDMR;
  const isSalarios = activeTab === "salarios";
  const showSalariosColumns = isSalarios;

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
        if (ssTiTab === "SS_TI_DT") {
          list = activeClients.filter((c: any) => isTI(c));
          if (subFilter !== "all") list = list.filter((c: any) => c.seguranca_social === subFilter);
        } else {
          list = activeClients.filter((c: any) => isTI(c) && !hasSalarios(c));
          if (subFilter !== "all") list = list.filter((c: any) => c.pag_seguranca_social === subFilter);
        }
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
    // Filter by collaborator (IVA and global)
    if (collabFilter !== "all") {
      if (collabFilter === "none") list = list.filter((c: any) => !c.responsavel_id);
      else list = list.filter((c: any) => c.responsavel_id === collabFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: any) => c.name.toLowerCase().includes(s) || (c.nif || "").includes(s));
    }
    return list;
  }, [activeClients, activeTab, subFilter, search, collabFilter, ssTiTab]);

  const oblMap = useMemo(() => {
    const map: Record<string, any> = {};
    const type = isDMR ? dmrTab : isSSTI ? ssTiTab : activeTab;
    obligations.forEach((o: any) => { if (o.obligation_type === type) map[o.client_id] = o; });
    return map;
  }, [obligations, activeTab, isDMR, dmrTab, isSSTI, ssTiTab]);

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
        client_id: clientId, obligation_type: oblType, reference_month: referenceMonth,
        status: "concluida", completed_at: new Date().toISOString(), completed_by: user?.id || null,
      });
    }
  };

  const getOblType = () => isDMR ? dmrTab : isSSTI ? ssTiTab : activeTab;
  const toggleGuia = (clientId: string) => toggleObligation(clientId, getOblType(), oblMap);

  const togglePagamento = async (clientId: string) => {
    const oblType = getOblType();
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
      case "IVA": return [{ value: "Mensal", label: "Mensal" }, { value: "Trimestral", label: "Trimestral" }];
      case "SS_TI": return ssTiTab === "SS_TI_DT" ? SS_TI_DT_FILTERS : SS_TI_FILTERS;
      default: return [];
    }
  };

  const subFilterOptions = getSubFilterOptions();
  const deadlineText = getDeadlineText();
  const doneCount = filteredClients.filter(c => oblMap[c.id]?.status === "concluida").length;

  const pageLabels: Record<string, string> = {
    SAFT: "SAFT", salarios: "Salários", DMR: "DMR", SS_TI: "Segurança Social TI",
    IVA: "IVA", retencao_fonte: "Retenção na Fonte", emissao_faturas: "Emissão de Faturas",
  };

  // IVA collaborator tabs data
  const ivaCollabData = useMemo(() => {
    if (!isIVA) return [];
    const ivaClients = activeClients.filter((c: any) => c.iva && c.iva !== "" && (subFilter === "all" || c.iva === subFilter));
    const counts: Record<string, number> = {};
    let noneCount = 0;
    ivaClients.forEach((c: any) => {
      if (c.responsavel_id) counts[c.responsavel_id] = (counts[c.responsavel_id] || 0) + 1;
      else noneCount++;
    });
    const tabs = collaborators.filter((col: any) => counts[col.id]).map((col: any) => ({ id: col.id, name: col.name, count: counts[col.id] }));
    if (noneCount > 0) tabs.push({ id: "none", name: "Sem responsável", count: noneCount });
    return tabs;
  }, [isIVA, activeClients, collaborators, subFilter]);

  if (loadingClients || loadingObl) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  const CheckboxCell = ({ done, onClick }: { done: boolean; onClick: () => void }) => (
    <button onClick={onClick} disabled={upsert.isPending}
      className={cn("w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
        done ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/30 hover:border-primary")}>
      {done && <Check className="w-4 h-4" />}
    </button>
  );

  // Build columns config
  const leftCheckbox = !isRight && !showGuiaPagamento && !showSalariosColumns;

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
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* DMR tabs */}
      {isDMR && (
        <div className="flex gap-1 border-b">
          {(["DMR_AT", "DMR_SS"] as const).map((tab) => (
            <button key={tab} onClick={() => setDmrTab(tab)}
              className={cn("px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                dmrTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              {tab === "DMR_AT" ? "DMR AT" : "DMR SS"}
            </button>
          ))}
        </div>
      )}

      {/* SS TI tabs */}
      {isSSTI && (
        <div className="flex gap-1 border-b">
          {(["SS_TI", "SS_TI_DT"] as const).map((tab) => (
            <button key={tab} onClick={() => { setSsTiTab(tab); setSubFilter("all"); }}
              className={cn("px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                ssTiTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              {tab === "SS_TI" ? "Pagamento" : "Declaração Trimestral"}
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
                case "IVA": return activeClients.filter((c: any) => c.iva === opt.value).length;
                case "SS_TI": return ssTiTab === "SS_TI_DT"
                  ? activeClients.filter((c: any) => isTI(c) && c.seguranca_social === opt.value).length
                  : activeClients.filter((c: any) => isTI(c) && !hasSalarios(c) && c.pag_seguranca_social === opt.value).length;
                default: return 0;
              }
            })();
            return (
              <button key={opt.value} onClick={() => { setSubFilter(subFilter === opt.value ? "all" : opt.value); setCollabFilter("all"); }}
                className={cn("px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                  subFilter === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                {opt.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* IVA collaborator tabs */}
      {isIVA && ivaCollabData.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 border-b">
          {ivaCollabData.map((col) => (
            <button key={col.id} onClick={() => setCollabFilter(collabFilter === col.id ? "all" : col.id)}
              className={cn("px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                collabFilter === col.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              {col.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {!isIVA && (
          <select value={collabFilter} onChange={(e) => setCollabFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">Todos os responsáveis</option>
            {collaborators.filter((c: any) => c.active).map((col: any) => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
            <option value="none">Sem responsável</option>
          </select>
        )}
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {leftCheckbox && <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-12">✓</th>}
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                {showNif && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NIF</th>}
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                {isSSTI && <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Enquadramento SS</th>}
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
                {showSaftExtra && <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Entregue</th>}
                {showSaftExtra && <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Importado TOC</th>}
                {showGuiaPagamento && (
                  <>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">Guia</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">Pagamento</th>
                  </>
                )}
                {showSalariosColumns && (
                  <>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">Processado</th>
                    <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">Enviado</th>
                  </>
                )}
                {isRight && !showGuiaPagamento && !showSaftExtra && !showSalariosColumns && <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-12">✓</th>}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client: any) => {
                const obl = oblMap[client.id];
                const guiaDone = obl?.status === "concluida";
                const pagamentoDone = obl?.extra_done === true;
                const isExtraDone = obl?.extra_done === true;
                const showExtraForClient = showSaftExtra && needsExtra(client);
                const rowDone = showGuiaPagamento ? (guiaDone && pagamentoDone) : showSalariosColumns ? (guiaDone && pagamentoDone) : guiaDone;

                return (
                  <tr key={client.id} className={cn("border-b last:border-0 transition-colors", rowDone ? "bg-green-50 dark:bg-green-950/20" : "hover:bg-muted/30")}>
                    {leftCheckbox && (
                      <td className="text-center px-3 py-3">
                        <CheckboxCell done={guiaDone} onClick={() => toggleGuia(client.id)} />
                      </td>
                    )}
                    <td className={cn("px-4 py-3 font-medium", rowDone && "line-through text-muted-foreground")}>{client.name}</td>
                    {showNif && <td className="px-4 py-3 text-muted-foreground">{client.nif || "—"}</td>}
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded",
                        client.tipo_contabilidade === "SQ" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                        client.tipo_contabilidade === "TI CO" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
                        client.tipo_contabilidade === "TI RS" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                        "bg-secondary"
                      )}>{client.tipo_contabilidade || "—"}</span>
                    </td>
                    {isSSTI && (
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">{client.seguranca_social || "—"}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground">{getCollabName(client.responsavel_id)}</td>
                    {showSaftExtra && (
                      <td className="text-center px-3 py-3">
                        <CheckboxCell done={guiaDone} onClick={() => toggleGuia(client.id)} />
                      </td>
                    )}
                    {showSaftExtra && (
                      <td className="text-center px-3 py-3">
                        {showExtraForClient ? (
                          <button onClick={() => toggleExtra(client.id)} disabled={upsert.isPending}
                            className={cn("w-6 h-6 rounded border-2 flex items-center justify-center transition-colors mx-auto",
                              isExtraDone ? "bg-blue-500 border-blue-500 text-white" : "border-muted-foreground/30 hover:border-primary")}>
                            {isExtraDone && <Check className="w-4 h-4" />}
                          </button>
                        ) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    )}
                    {showGuiaPagamento && (
                      <>
                        <td className="text-center px-3 py-3"><CheckboxCell done={guiaDone} onClick={() => toggleGuia(client.id)} /></td>
                        <td className="text-center px-3 py-3"><CheckboxCell done={pagamentoDone} onClick={() => togglePagamento(client.id)} /></td>
                      </>
                    )}
                    {showSalariosColumns && (
                      <>
                        <td className="text-center px-3 py-3"><CheckboxCell done={guiaDone} onClick={() => toggleGuia(client.id)} /></td>
                        <td className="text-center px-3 py-3"><CheckboxCell done={pagamentoDone} onClick={() => togglePagamento(client.id)} /></td>
                      </>
                    )}
                    {isRight && !showGuiaPagamento && !showSaftExtra && !showSalariosColumns && (
                      <td className="text-center px-3 py-3">
                        <CheckboxCell done={guiaDone} onClick={() => toggleGuia(client.id)} />
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredClients.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ObrigacoesView;
