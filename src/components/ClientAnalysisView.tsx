import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Upload, Building2 } from "lucide-react";
import { useClients } from "@/hooks/useSupabaseQuery";
import { useBulkUpsertEntries, useFinancialAccounts } from "@/hooks/useClientFinancials";
import AnaliseMensalTab from "./financial/AnaliseMensalTab";
import MapaExploracaoTab from "./financial/MapaExploracaoTab";
import IvaTab from "./financial/IvaTab";
import IndicadoresTab from "./financial/IndicadoresTab";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "analise" | "mapa" | "iva" | "indicadores";
const TABS: { key: Tab; label: string }[] = [
  { key: "analise", label: "Análise mensal" },
  { key: "mapa", label: "Mapa de Exploração" },
  { key: "iva", label: "IVA" },
  { key: "indicadores", label: "Indicadores" },
];

export default function ClientAnalysisView({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const { data: clients = [] } = useClients();
  const client = clients.find((c: any) => c.id === clientId);
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState<Tab>("analise");
  const { data: accounts = [] } = useFinancialAccounts();
  const bulk = useBulkUpsertEntries(clientId, year);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const codes = new Set(accounts.map((a) => a.code));
      const entries: { month: number; account_code: string; value: number }[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        for (const row of rows) {
          if (!row || row.length < 3) continue;
          // Detect code column: first cell or second cell that matches an account code
          let codeCellIdx = -1;
          for (let i = 0; i < Math.min(3, row.length); i++) {
            const cell = row[i];
            if (cell != null && codes.has(String(cell).trim())) { codeCellIdx = i; break; }
          }
          if (codeCellIdx < 0) continue;
          const code = String(row[codeCellIdx]).trim();
          // 12 month values follow the name (assume codeCellIdx + 2 is Janeiro if there's a name, else codeCellIdx + 1)
          // We'll detect: starting from codeCellIdx+1, find first contiguous run of 12 numeric cells.
          for (let start = codeCellIdx + 1; start <= row.length - 12; start++) {
            const slice = row.slice(start, start + 12);
            const numericCount = slice.filter((v) => typeof v === "number").length;
            if (numericCount >= 6) {
              slice.forEach((v, i) => {
                if (typeof v === "number" && v !== 0) {
                  entries.push({ month: i + 1, account_code: code, value: Number(v) });
                }
              });
              break;
            }
          }
        }
      }

      if (!entries.length) {
        toast.error("Não foram encontradas linhas com códigos de conta reconhecidos.");
        return;
      }
      await bulk.mutateAsync(entries);
      toast.success(`Importação concluída: ${entries.length} valores carregados.`);
    } catch (e: any) {
      toast.error("Erro a importar: " + e.message);
    }
  };

  if (!client) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="text-muted-foreground">Cliente não encontrado.</div>
      </div>
    );
  }

  const years = [year - 2, year - 1, year, year + 1];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{client.name}</h2>
            <p className="text-sm text-muted-foreground">Análise financeira {year}{client.nif ? ` · NIF ${client.nif}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1">
            <button onClick={() => setYear(year - 1)} className="p-1 rounded hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-transparent text-sm font-semibold px-2 focus:outline-none">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => setYear(year + 1)} className="p-1 rounded hover:bg-muted"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted text-sm transition-colors">
            <Upload className="w-4 h-4" /> Importar Excel
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "analise" && <AnaliseMensalTab clientId={clientId} year={year} />}
      {tab === "mapa" && <MapaExploracaoTab clientId={clientId} year={year} />}
      {tab === "iva" && <IvaTab clientId={clientId} year={year} />}
      {tab === "indicadores" && <IndicadoresTab clientId={clientId} year={year} />}
    </div>
  );
}
