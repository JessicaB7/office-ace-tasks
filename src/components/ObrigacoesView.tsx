import { useState, useEffect } from "react";
import { useClients, useCollaborators } from "@/hooks/useSupabaseQuery";
import { Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ObrigacaoPage = "SAFT" | "salarios" | "DMR" | "SS_TI" | "IVA" | "retencao_fonte" | "emissao_faturas";

const OBRIGACAO_PAGES: { id: ObrigacaoPage; label: string }[] = [
  { id: "SAFT", label: "SAFT" },
  { id: "salarios", label: "Salários" },
  { id: "DMR", label: "DMR" },
  { id: "SS_TI", label: "Segurança Social TI" },
  { id: "IVA", label: "IVA" },
  { id: "retencao_fonte", label: "Retenção na Fonte" },
  { id: "emissao_faturas", label: "Emissão de Faturas" },
];

const SAFT_GROUPS = ["Automático", "A entregar", "Não Aplicável"];

interface ObrigacoesViewProps {
  subPage?: string;
  onEditTask: (task: any) => void;
}

const ObrigacoesView = ({ subPage }: ObrigacoesViewProps) => {
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const [activeTab, setActiveTab] = useState<string>(subPage || "SAFT");
  const [search, setSearch] = useState("");
  const [subFilter, setSubFilter] = useState<string>("all");

  useEffect(() => {
    if (subPage) {
      setActiveTab(subPage);
      setSubFilter("all");
      setSearch("");
    }
  }, [subPage]);

  const activeClients = clients.filter((c: any) => c.active);

  const getCollabName = (id: string | null) => {
    if (!id) return "—";
    const col = collaborators.find((c: any) => c.id === id);
    return col ? col.name : "—";
  };

  // Filter clients based on active tab
  const getFilteredClients = () => {
    let list: any[] = [];

    switch (activeTab) {
      case "SAFT":
        list = activeClients.filter((c: any) => {
          if (subFilter !== "all" && c.saft !== subFilter) return false;
          return true;
        });
        break;
      case "salarios":
        list = activeClients.filter((c: any) =>
          c.salarios && c.salarios !== "Não tem" && c.salarios !== ""
        );
        if (subFilter !== "all") {
          list = list.filter((c: any) => c.salarios === subFilter);
        }
        break;
      case "DMR":
        // DMR applies to clients with salários
        list = activeClients.filter((c: any) =>
          c.salarios && c.salarios !== "Não tem" && c.salarios !== ""
        );
        break;
      case "SS_TI":
        list = activeClients.filter((c: any) =>
          c.seguranca_social && c.seguranca_social !== ""
        );
        if (subFilter !== "all") {
          list = list.filter((c: any) => c.seguranca_social === subFilter);
        }
        break;
      case "IVA":
        list = activeClients.filter((c: any) =>
          c.iva && c.iva !== ""
        );
        if (subFilter !== "all") {
          list = list.filter((c: any) => c.iva === subFilter);
        }
        break;
      case "retencao_fonte":
        list = activeClients.filter((c: any) =>
          c.tipo_contabilidade === "TI CO" || c.tipo_contabilidade === "TI RS"
        );
        break;
      case "emissao_faturas":
        list = activeClients.filter((c: any) =>
          c.faturacao === "Emitir"
        );
        break;
      default:
        list = activeClients;
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: any) =>
        c.name.toLowerCase().includes(s) || (c.nif || "").includes(s)
      );
    }

    return list;
  };

  const getSubFilterOptions = (): { value: string; label: string }[] => {
    switch (activeTab) {
      case "SAFT":
        return SAFT_GROUPS.map((g) => ({ value: g, label: g }));
      case "salarios":
        return [
          { value: "Sim até dia 25", label: "Até dia 25" },
          { value: "Sim até ao fim do mês", label: "Até ao fim do mês" },
        ];
      case "SS_TI":
        return [
          { value: "Mensal", label: "Mensal" },
          { value: "Trimestral", label: "Trimestral" },
          { value: "Contabilidade Organizada", label: "Cont. Organizada" },
          { value: "TCO", label: "TCO" },
          { value: "Isento", label: "Isento" },
        ];
      case "IVA":
        return [
          { value: "Mensal", label: "Mensal" },
          { value: "Trimestral", label: "Trimestral" },
          { value: "Art. 9º", label: "Isenção Art. 9º" },
          { value: "Art.53º", label: "Isenção Art. 53º" },
        ];
      default:
        return [];
    }
  };

  const filtered = getFilteredClients();
  const subFilterOptions = getSubFilterOptions();
  const pageLabel = OBRIGACAO_PAGES.find((p) => p.id === activeTab)?.label || activeTab;

  // Get detail text per client based on active tab
  const getDetailText = (client: any): string => {
    switch (activeTab) {
      case "SAFT": return client.saft || "—";
      case "salarios": return client.salarios?.replace("Sim ", "") || "—";
      case "DMR": return client.salarios?.replace("Sim ", "") || "—";
      case "SS_TI": return client.seguranca_social || "—";
      case "IVA": return client.iva || "—";
      case "retencao_fonte": return client.tipo_contabilidade === "TI CO" ? "TI Organizado" : "TI Simplificado";
      case "emissao_faturas": return "Emitir";
      default: return "—";
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">A carregar...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">{pageLabel}</h2>
        <p className="text-muted-foreground text-sm mt-1">{filtered.length} clientes</p>
      </div>

      {/* Sub-filter tabs */}
      {subFilterOptions.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 border-b">
          <button
            onClick={() => setSubFilter("all")}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
              subFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            Todos ({activeTab === "salarios" || activeTab === "DMR"
              ? activeClients.filter((c: any) => c.salarios && c.salarios !== "Não tem" && c.salarios !== "").length
              : activeTab === "SS_TI"
              ? activeClients.filter((c: any) => c.seguranca_social && c.seguranca_social !== "").length
              : activeTab === "IVA"
              ? activeClients.filter((c: any) => c.iva && c.iva !== "").length
              : activeClients.length
            })
          </button>
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
                onClick={() => setSubFilter(opt.value)}
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Pesquisar por nome ou NIF..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">NIF</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{pageLabel}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client: any, i: number) => (
                <tr key={client.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{client.nif || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">
                      {client.tipo_contabilidade || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{getDetailText(client)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{getCollabName(client.responsavel_id)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ObrigacoesView;
