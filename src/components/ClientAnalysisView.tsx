import { useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Upload, Building2, Trash2, FileText } from "lucide-react";
import { useClients } from "@/hooks/useSupabaseQuery";
import {
  useFinancialAccounts,
  useLastImportDate,
  useFinancialImports,
  useSaveFinancialImport,
  useDeleteFinancialImport,
  IMPORT_SLOTS,
  type ImportSlot,
} from "@/hooks/useClientFinancials";
import AnaliseMensalTab from "./financial/AnaliseMensalTab";
import MapaExploracaoTab from "./financial/MapaExploracaoTab";
import IvaTab from "./financial/IvaTab";
import IndicadoresTab from "./financial/IndicadoresTab";
import TISimplificadoDashboard from "./financial/TISimplificadoDashboard";
import TIOrganizadoDashboard from "./financial/TIOrganizadoDashboard";
import EmpresasDashboard from "./financial/EmpresasDashboard";
import DashboardTrimestral from "./financial/DashboardTrimestral";

import ClientDetailDialog from "@/components/ClientDetailDialog";
import * as XLSX from "xlsx";
import { parseMapaPdf } from "@/lib/pdfMapaImport";
import { parseBalancetePdf, isBalancetePdf } from "@/lib/pdfBalanceteImport";
import { parseBalanceteXlsx, isBalanceteXlsx } from "@/lib/xlsxBalanceteImport";
import { toast } from "sonner";
import { validateDocumentNif } from "@/lib/nifCheck";
import { cn } from "@/lib/utils";

type Tab = "analise" | "mapa" | "iva" | "indicadores";
const TABS: { key: Tab; label: string }[] = [
  { key: "analise", label: "Análise mensal" },
  { key: "mapa", label: "Mapa de Exploração" },
  { key: "iva", label: "IVA" },
  { key: "indicadores", label: "Indicadores" },
];

type Section = "dados" | "dashboard" | "mensal";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "dados", label: "Dados" },
  { key: "dashboard", label: "Dashboard anual" },
  { key: "mensal", label: "Dashboard trimestral" },
];


export default function ClientAnalysisView({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const { data: clients = [] } = useClients();
  const client = clients.find((c: any) => c.id === clientId);
  const [year, setYear] = useState(new Date().getFullYear());
  const [section, setSection] = useState<Section>("dashboard");
  const [tab, setTab] = useState<Tab>("analise");

  const { data: accounts = [] } = useFinancialAccounts();
  const { data: lastImport } = useLastImportDate(clientId, year);
  const { data: imports = [] } = useFinancialImports(clientId, year);
  const saveImport = useSaveFinancialImport(clientId, year);
  const deleteImport = useDeleteFinancialImport(clientId, year);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<ImportSlot>("mapa");
  const [fichaOpen, setFichaOpen] = useState(false);

  const handleImport = async (file: File, slot: ImportSlot) => {
    try {
      const codes = new Set(accounts.map((a) => a.code));
      let entries: { month: number; account_code: string; value: number }[] = [];

      // 1) Validação obrigatória do NIF do documento vs NIF do cliente
      const nifCheck = await validateDocumentNif(file, client?.nif);
      if (!nifCheck.ok) {
        toast.error(
          `NIF do documento (${nifCheck.docNif}) não corresponde ao NIF do cliente (${nifCheck.clientNif}). Importação cancelada.`,
        );
        return;
      }
      if (!nifCheck.docNif) {
        toast.warning("Não foi possível ler o NIF no documento — confirma que pertence a este cliente.");
      }

      const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      if (isPdf) {
        if (await isBalancetePdf(file)) {
          const res = await parseBalancetePdf(file, Array.from(codes));
          if (res.year !== year) {
            toast.warning(`Balancete é de ${res.year}, mas estás a ver ${year}. Importei na vista atual.`);
          }
          entries = res.entries;
          toast.info(`Balancete ${res.startMonth.toString().padStart(2, "0")}–${res.endMonth.toString().padStart(2, "0")}/${res.year} carregado no mês de fecho.`);
        } else {
          const res = await parseMapaPdf(file, codes);
          entries = res.entries;
        }
      } else {

        // Try balancete XLSX first (TOConline "Balancete (Período, Acumulado)")
        if (await isBalanceteXlsx(file)) {
          const res = await parseBalanceteXlsx(file, Array.from(codes));
          if (res.year !== year) {
            toast.warning(`Balancete é de ${res.year}, mas estás a ver ${year}. Importei na vista atual.`);
          }
          entries = res.entries;
          toast.info(`Balancete ${res.startMonth.toString().padStart(2, "0")}–${res.endMonth.toString().padStart(2, "0")}/${res.year} carregado no mês de fecho.`);
        } else {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array" });
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
            for (const row of rows) {
              if (!row || row.length < 3) continue;
              let codeCellIdx = -1;
              for (let i = 0; i < Math.min(3, row.length); i++) {
                const cell = row[i];
                if (cell != null && codes.has(String(cell).trim())) { codeCellIdx = i; break; }
              }
              if (codeCellIdx < 0) continue;
              const code = String(row[codeCellIdx]).trim();
              for (let start = codeCellIdx + 1; start <= row.length - 12; start++) {
                const slice = row.slice(start, start + 12);
                const numericCount = slice.filter((v) => typeof v === "number").length;
                if (numericCount >= 6) {
                  slice.forEach((v, i) => {
                    if (typeof v === "number" && v !== 0) {
                      entries.push({ month: i + 1, account_code: code, value: Math.abs(Number(v)) });
                    }
                  });
                  break;
                }
              }
            }
          }
        }
      }

      if (!entries.length) {
        toast.error("Não foram encontradas linhas com códigos de conta reconhecidos.");
        return;
      }

      const slotMonths = IMPORT_SLOTS.find((s) => s.slot === slot)!.months;
      const kept = entries.filter((e) => slotMonths.includes(e.month));
      if (!kept.length) {
        toast.error("Os valores do ficheiro não pertencem ao período selecionado.");
        return;
      }
      if (kept.length !== entries.length) {
        toast.warning(`${entries.length - kept.length} valores fora do período selecionado foram ignorados.`);
      }
      entries = kept;
      await saveImport.mutateAsync({ slot, fileName: file.name, entries });
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
            <button
              onClick={() => setFichaOpen(true)}
              className="text-2xl font-bold hover:underline text-left"
              title="Abrir ficha do cliente"
            >
              {client.name}
            </button>
            <p className="text-sm text-muted-foreground">Análise financeira {year}{client.nif ? ` · NIF ${client.nif}` : ""}</p>
            <p className="text-xs text-muted-foreground/80">
              Última importação: {lastImport ? new Date(lastImport).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—"}
            </p>
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
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.pdf,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f, pendingSlot.current); e.target.value = ""; }} />
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={cn(
              "px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
              section === s.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "dados" && (
      <div className="rounded-xl border bg-card p-4">

        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold">Ficheiros importados {year}</h3>
          <p className="text-xs text-muted-foreground">Mapa de Exploração: faturação, despesas e lucro. Balancetes: IVA, Segurança Social e retenção na fonte.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {IMPORT_SLOTS.map((s) => {
            const imp = imports.find((i) => i.slot === s.slot);
            return (
              <div key={s.slot} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
                <FileText className={cn("w-4 h-4 shrink-0", imp ? "text-primary" : "text-muted-foreground/50")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {imp
                      ? `${imp.file_name} · ${new Date(imp.updated_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}`
                      : "Sem ficheiro"}
                  </p>
                </div>
                <button
                  onClick={() => { pendingSlot.current = s.slot; fileRef.current?.click(); }}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  title={imp ? "Substituir ficheiro" : "Importar ficheiro"}
                >
                  <Upload className="w-4 h-4" />
                </button>
                {imp && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Eliminar "${imp.file_name}"? Os valores deste ficheiro serão removidos.`)) return;
                      try {
                        await deleteImport.mutateAsync(s.slot);
                        toast.success("Ficheiro eliminado.");
                      } catch (e: any) {
                        toast.error("Erro a eliminar: " + e.message);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                    title="Eliminar ficheiro importado"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      {section === "dados" && (
        <>
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
        </>
      )}

      {section === "dashboard" && (
        client.tipo_contabilidade === "TI RS" ? (
          <TISimplificadoDashboard clientId={clientId} year={year} client={client} />
        ) : client.tipo_contabilidade === "TI CO" ? (
          <TIOrganizadoDashboard clientId={clientId} year={year} client={client} />
        ) : (
          <EmpresasDashboard clientId={clientId} year={year} client={client} />
        )
      )}

      {section === "mensal" && (
        <DashboardTrimestral clientId={clientId} year={year} client={client} />
      )}



      <ClientDetailDialog
        client={fichaOpen ? client : null}
        open={fichaOpen}
        onClose={() => setFichaOpen(false)}
      />
    </div>
  );
}
