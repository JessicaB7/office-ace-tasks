import { useState, useMemo } from "react";
import { X, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useClientObligationsHistory } from "@/hooks/useSupabaseQuery";
import { cn } from "@/lib/utils";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface ClientMonthlyHistoryDialogProps {
  client: any | null;
  open: boolean;
  onClose: () => void;
  activeTab: string;
  columns?: string[];
}

const ClientMonthlyHistoryDialog = ({ client, open, onClose, activeTab, columns }: ClientMonthlyHistoryDialogProps) => {
  const oblPrefix = `contabilidade_${activeTab}`;
  const { data: obligations = [], isLoading } = useClientObligationsHistory(
    client?.id || null,
    oblPrefix
  );

  const hasMultiColumns = !!columns && columns.length > 0;

  // Build column obligation type keys
  const colOblTypes = useMemo(() => {
    if (!columns) return [];
    return columns.map((col) => `contabilidade_${activeTab}_${col.toLowerCase().replace(/[- ]/g, "_")}`);
  }, [columns, activeTab]);

  // Group obligations by month
  const [historyYear, setHistoryYear] = useState(new Date().getFullYear());

  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; year: number; month: number }[] = [];
    
    // Show Jan-Dec for selected year
    for (let m = 0; m < 12; m++) {
      months.push({
        key: `${historyYear}-${String(m + 1).padStart(2, "0")}-01`,
        label: `${MONTH_NAMES[m]} ${historyYear}`,
        year: historyYear,
        month: m,
      });
    }

    return months.map((monthInfo) => {
      const monthObls = obligations.filter((o: any) => o.reference_month === monthInfo.key);

      if (hasMultiColumns) {
        const colStatus = colOblTypes.map((type) => {
          const obl = monthObls.find((o: any) => o.obligation_type === type);
          return obl?.status === "concluida";
        });
        return { ...monthInfo, colStatus, done: colStatus.every(Boolean), allDone: colStatus.every(Boolean) };
      } else {
        const obl = monthObls.find((o: any) => o.obligation_type === oblPrefix);
        const done = obl?.status === "concluida";
        return { ...monthInfo, colStatus: [] as boolean[], done, allDone: done };
      }
    });
  }, [obligations, oblPrefix, hasMultiColumns, colOblTypes, historyYear]);

  if (!open || !client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-bold">{client.name}</h3>
           <p className="text-sm text-muted-foreground">Histórico de tarefas realizadas</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1">
              <button onClick={() => setHistoryYear(y => y - 1)} className="p-0.5 hover:bg-background rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-medium min-w-[50px] text-center">{historyYear}</span>
              <button onClick={() => setHistoryYear(y => y + 1)} className="p-0.5 hover:bg-background rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">A carregar...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Mês</th>
                  {hasMultiColumns ? (
                    columns!.map((col) => (
                      <th key={col} className="text-center px-2 py-2 font-semibold text-muted-foreground text-xs">{col}</th>
                    ))
                  ) : (
                    <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Estado</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row) => (
                  <tr key={row.key} className={cn("border-b last:border-0", row.allDone && "bg-green-50 dark:bg-green-950/20")}>
                    <td className={cn("px-3 py-2.5 font-medium", row.allDone && "text-muted-foreground")}>{row.label}</td>
                    {hasMultiColumns ? (
                      row.colStatus!.map((done, i) => (
                        <td key={i} className="text-center px-2 py-2.5">
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center mx-auto",
                            done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/20"
                          )}>
                            {done && <Check className="w-3 h-3" />}
                          </div>
                        </td>
                      ))
                    ) : (
                      <td className="text-center px-3 py-2.5">
                        <div className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center mx-auto",
                          row.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/20"
                        )}>
                          {row.done && <Check className="w-3 h-3" />}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientMonthlyHistoryDialog;
