import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hojeISO, fmtPedido } from "@/lib/pedidosCliente";

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

export interface PedidoCandidate {
  id: string;
  name: string;
  /** Data de um pedido já registado nesta coluna (se houver). */
  pedidoEm?: string | null;
}

/** Marcar «Pedido ao cliente» numa coluna para vários clientes de uma vez. */
export function PedidoLoteDialog({ open, onOpenChange, column, candidates, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: string;
  candidates: PedidoCandidate[];
  onConfirm: (clientIds: string[], date: string, nota: string) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(hojeISO());
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    if (open) { setSelected(new Set()); setDate(hojeISO()); setNota(""); setFiltro(""); }
  }, [open, column]);

  const visiveis = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates;
  }, [candidates, filtro]);

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
    if (selected.size === 0 || !date) return;
    setSaving(true);
    try {
      await onConfirm([...selected], date, nota.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>⏳ Pedido ao cliente — {column}</DialogTitle>
          <DialogDescription>Escolhe os clientes a quem pediste documentos. A célula fica «pedido» até a marcares como feita.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="lote-data" className="text-xs">Data do pedido</Label>
            <Input id="lote-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lote-nota" className="text-xs">O que se pediu (opcional)</Label>
            <Input id="lote-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} className="h-8 text-sm" />
          </div>
        </div>
        <Input placeholder="Filtrar clientes..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="h-8 text-sm" />
        <div className="border rounded-lg max-h-72 overflow-y-auto divide-y">
          {visiveis.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Sem clientes por fazer nesta coluna</div>
          ) : (
            <>
              <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-muted/40 cursor-pointer">
                <Checkbox checked={allVisible} onCheckedChange={toggleAll} />
                Selecionar todos ({visiveis.length})
              </label>
              {visiveis.map((c) => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/30">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.pedidoEm && <span className="text-xs text-muted-foreground">⏳ {fmtPedido(c.pedidoEm)}</span>}
                </label>
              ))}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || selected.size === 0 || !date}>
            Marcar pedido{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
