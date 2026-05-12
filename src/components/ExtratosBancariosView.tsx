import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, FileSpreadsheet, FileText, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  extractPdfText,
  parseBankText,
  parseSpreadsheet,
  buildToconlineXlsx,
  detectBank,
  type BankTransaction,
} from "@/lib/bankParsers";

const BANCOS = ["Auto", "Millennium", "CGD", "Santander", "BPI", "Novo Banco", "ActivoBank", "Genérico"];

const ExtratosBancariosView = () => {
  const [loading, setLoading] = useState(false);
  const [bankHint, setBankHint] = useState<string>("Auto");
  const [bank, setBank] = useState<string>("");
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [saldoInicial, setSaldoInicial] = useState<string>("");
  const [saldoFinal, setSaldoFinal] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState<string>("");

  const processFile = async (file: File, password?: string) => {
    setLoading(true);
    setFileName(file.name);
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      let result;
      if (ext === "pdf") {
        const text = await extractPdfText(file, password);
        result = parseBankText(text, bankHint === "Auto" ? null : bankHint);
      } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        result = await parseSpreadsheet(file);
        if (bankHint !== "Auto") result.bank = bankHint;
      } else {
        toast.error("Formato não suportado. Use PDF, Excel ou CSV.");
        return;
      }

      setBank(result.bank);
      setTransactions(result.transactions);
      if (result.saldoInicial !== undefined) setSaldoInicial(String(result.saldoInicial));
      if (result.saldoFinal !== undefined) setSaldoFinal(String(result.saldoFinal));
      setPendingPdf(null);
      setPdfPassword("");

      if (result.transactions.length === 0) {
        toast.warning("Nenhum movimento detetado. Verifique o ficheiro ou ajuste o banco selecionado.");
      } else {
        toast.success(`${result.transactions.length} movimentos importados (${result.bank})`);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      const name = err?.name || "";
      if (name === "PasswordException" || /password/i.test(msg)) {
        setPendingPdf(file);
        toast.info("Este PDF está protegido. Introduza a palavra-passe.");
      } else {
        console.error(err);
        toast.error("Erro a processar o ficheiro: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await processFile(file);
  };

  const handleUnlockPdf = async () => {
    if (!pendingPdf || !pdfPassword) return;
    await processFile(pendingPdf, pdfPassword);
  };

  const updateTx = (idx: number, field: keyof BankTransaction, value: string) => {
    setTransactions((prev) => {
      const next = [...prev];
      const t = { ...next[idx] };
      if (field === "dataMov" || field === "dataValor") {
        const d = new Date(value);
        if (!isNaN(d.getTime())) (t as any)[field] = d;
      } else if (field === "movimento") {
        const n = parseFloat(value.replace(",", "."));
        if (!isNaN(n)) t.movimento = n;
      } else {
        (t as any)[field] = value;
      }
      next[idx] = t;
      return next;
    });
  };

  const removeTx = (idx: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalEntradas = transactions.reduce((s, t) => s + (t.movimento > 0 ? t.movimento : 0), 0);
  const totalSaidas = transactions.reduce((s, t) => s + (t.movimento < 0 ? t.movimento : 0), 0);
  const saldoCalc =
    (parseFloat(saldoInicial.replace(",", ".")) || 0) + totalEntradas + totalSaidas;
  const saldoFinalNum = parseFloat(saldoFinal.replace(",", ".")) || 0;
  const isBalanced = Math.abs(saldoCalc - saldoFinalNum) < 0.01;

  const handleDownload = async () => {
    if (transactions.length === 0) {
      toast.error("Sem movimentos para exportar.");
      return;
    }
    const si = parseFloat(saldoInicial.replace(",", "."));
    const sf = parseFloat(saldoFinal.replace(",", "."));
    if (isNaN(si) || isNaN(sf)) {
      toast.error("Indique Saldo Inicial e Saldo Final.");
      return;
    }
    if (!isBalanced) {
      const ok = confirm(
        `Os saldos não conferem (calculado: ${saldoCalc.toFixed(2)} vs final: ${sf.toFixed(2)}). Exportar mesmo assim?`,
      );
      if (!ok) return;
    }
    try {
      const blob = await buildToconlineXlsx({ bank, transactions }, { saldoInicial: si, saldoFinal: sf });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `toconline_${bank.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Ficheiro TOConline gerado!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro a gerar ficheiro: " + (err?.message || ""));
    }
  };

  const handleClear = () => {
    setTransactions([]);
    setBank("");
    setSaldoInicial("");
    setSaldoFinal("");
    setFileName("");
  };

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Extratos Bancários</h1>
        <p className="text-muted-foreground">
          Converta extratos (PDF, Excel ou CSV) para o modelo de importação do TOConline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Carregar extrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={bankHint} onValueChange={setBankHint}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANCOS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ficheiro (PDF, XLSX, XLS, CSV)</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={handleFile} disabled={loading} />
                {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              {fileName && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {fileName.endsWith(".pdf") ? <FileText className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                  {fileName} {bank && `· detetado: ${bank}`}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {transactions.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Saldos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Saldo Inicial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Saldo Final</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={saldoFinal}
                    onChange={(e) => setSaldoFinal(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Saldo calculado</Label>
                  <div
                    className={`h-10 px-3 rounded-md border flex items-center font-mono text-sm ${
                      isBalanced ? "border-green-500/50 text-green-700 dark:text-green-400" : "border-destructive/50 text-destructive"
                    }`}
                  >
                    {saldoCalc.toFixed(2)} €
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Entradas: {totalEntradas.toFixed(2)} · Saídas: {totalSaidas.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">3. Movimentos ({transactions.length})</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <Trash2 className="w-4 h-4 mr-1" /> Limpar
                </Button>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" /> Exportar TOConline
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Data Mov.</TableHead>
                      <TableHead className="w-32">Data Valor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-32 text-right">Movimento</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input
                            type="date"
                            value={fmtDate(t.dataMov)}
                            onChange={(e) => updateTx(i, "dataMov", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={fmtDate(t.dataValor)}
                            onChange={(e) => updateTx(i, "dataValor", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={t.descricao}
                            onChange={(e) => updateTx(i, "descricao", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={t.movimento}
                            onChange={(e) => updateTx(i, "movimento", e.target.value)}
                            className={`h-8 text-xs text-right font-mono ${
                              t.movimento < 0 ? "text-destructive" : "text-green-700 dark:text-green-400"
                            }`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeTx(i)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {transactions.length === 0 && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Upload className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Carregue um extrato bancário para começar.</p>
            <p className="text-xs mt-1">Suporta PDF, Excel (.xlsx/.xls) e CSV dos principais bancos PT.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExtratosBancariosView;
