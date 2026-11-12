import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hojeISO, fmtPedido, candidatosParaColunas, celulasAPedir, type PedidoCandidato } from "@/lib/pedidosCliente";
import { cn } from "@/lib/utils";

/** Formulário curto do «Pedido ao cliente» (popover da célula). */
export function PedidoClienteForm({ title, initialDate, initialNota, hasPedido, onSave, onClear, onClose }: {
  title: string;
  initialDate?: string | null;
  initialNota?: string | null;
  hasPedido: boolean;
  onSave: (date: string, nota: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initialDate || hojeISO());
  const [nota, setNota] = useState(initialNota || "");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (date) { onSave(date, nota.trim()); onClose(); } }}>
      <div className="text-sm font-semibold">⏳ Pedido ao cliente</div>
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="space-y-1">
        <Label htmlFor="pedido-data" className="text-xs">Data do pedido</Label>
        <Input id="pedido-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pedido-nota" className="text-xs">O que se pediu (opcional)</Label>
        <Input id="pedido-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ex.: faturas de compras de outubro"
          className="h-8 text-sm" maxLength={200} autoFocus />
      </div>
      <div className="flex justify-between gap-2 pt-1">
        {hasPedido ? (
          <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive"
            onClick={() => { onClear(); onClose(); }}>
            Remover pedido
          </Button>
        ) : <span />}
        <Button type="submit" size="sm" disabled={!date}>{hasPedido ? "Guardar" : "Marcar pedido"}</Button>
      </div>
    </form>
  );
}

/** «Pedir documentos»: regista o pedido ao cliente em uma ou mais colunas, para vários clientes de uma vez. */
export function PedirDocumentosDialog({ open, onOpenChange, columns, candidates, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Colunas do separador atual (o índice é a posição). */
  columns: string[];
  candidates: PedidoCandidato[];
  onConfirm: (cells: { clientId: string; col: number }[], date: string, nota: string) => Promise<void> | void;
}) {
  const [cols, setCols] = useState<number[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(hojeISO());
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    if (open) { setCols([]); setSelected(new Set()); setDate(hojeISO()); setNota(""); setFiltro(""); }
  }, [open]);

  const toggleCol = (i: number) => setCols((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i].sort((a, b) => a - b)));

  const comColunas = useMemo(() => candidatosParaColunas(candidates, cols), [candidates, cols]);
  const visiveis = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return q ? comColunas.filter((c) => c.name.toLowerCase().includes(q)) : comColunas;
  }, [comColunas, filtro]);
  const cells = useMemo(() => celulasAPedir(comColunas, selected, cols), [comColunas, selected, cols]);
  const nClientes = new Set(cells.map((c) => c.clientId)).size;

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const allVisible = visiveis.length > 0 && visiveis.every((c) => selected.has(c.id));
  const toggleAll = () => setSelected((s) => {
    const n = new Set(s);
    visiveis.forEach((c) => (allVisible ? n.delete(c.id) : n.add(c.id)));
    return n;
  });

  const confirm = async () => {
    if (cells.length === 0 || !date) return;
    setSaving(true);
    try {
      await onConfirm(cells, date, nota.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const pedidosJa = (c: PedidoCandidato) => cols.map((i) => c.porFazer[i]).filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pedir documentos ao cliente</DialogTitle>
          <DialogDescription>
            Regista que pediste documentos. Quando os documentos chegarem, carrega na célula como sempre — o pedido desaparece sozinho.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-semibold">1. Que documentos pediste?</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {columns.map((col, i) => {
              const on = cols.includes(i);
              return (
                <button key={col} type="button" onClick={() => toggleCol(i)} aria-pressed={on}
                  className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium text-left transition-colors",
                    on ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}>
                  <Checkbox checked={on} tabIndex={-1} aria-hidden className="pointer-events-none" />
                  <span className="truncate">{col}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">2. A que clientes?</div>
          {cols.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Escolhe primeiro os documentos acima.
            </div>
          ) : (
            <>
              <Input placeholder="Procurar cliente..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="h-9 text-sm" />
              <div className="border rounded-lg max-h-64 overflow-y-auto divide-y">
                {visiveis.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">Não há clientes com estes documentos por fazer neste mês</div>
                ) : (
                  <>
                    <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-muted/40 cursor-pointer">
                      <Checkbox checked={allVisible} onCheckedChange={toggleAll} />
                      Selecionar todos ({visiveis.length})
                    </label>
                    {visiveis.map((c) => {
                      const ja = pedidosJa(c);
                      return (
                        <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                          <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                          <span className="flex-1 truncate">{c.name}</span>
                          {ja.length > 0 && <span className="text-xs text-muted-foreground">já pedido {fmtPedido(ja[0])}</span>}
                        </label>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pedir-data" className="text-sm font-semibold">3. Data do pedido</Label>
            <Input id="pedir-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pedir-nota" className="text-sm font-semibold">Nota (opcional)</Label>
            <Input id="pedir-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200}
              placeholder="ex.: faturas de compras de outubro" className="h-9 text-sm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || cells.length === 0 || !date}>
            Registar pedido ({nClientes})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
