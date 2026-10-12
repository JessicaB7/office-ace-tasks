import { useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useClients, useMonthlyObligationsRange } from "@/hooks/useSupabaseQuery";
import { OBRIGACAO_GROUPS, obrigacoesForClient, isObrigacaoDone, todayYmd, fmtPrazo } from "@/lib/obrigacoesControlo";

const STORAGE_KEY = "prazosReminderLastShown";
const HOUR = 60 * 60 * 1000;

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

interface Props {
  /** Abrir o Controlo interno das Obrigações no mês de referência e na obrigação indicados. */
  onOpen: (group: string, month: string) => void;
}

/** Aviso de prazos: no dia do prazo de uma obrigação, se ainda houver clientes em
 * falta, abre um pop-up — e volta a abrir de hora a hora enquanto a app estiver aberta. */
const ObrigacoesPrazoReminder = ({ onOpen }: Props) => {
  const { data: clients = [] } = useClients();
  const [today, setToday] = useState(todayYmd());
  // Os prazos de hoje dizem respeito ao próprio mês (declaração trimestral SS) ou a 1–2 meses antes (IVA mensal/trimestral).
  const refMonths = useMemo(() => {
    const d = new Date(`${today}T12:00:00`);
    return [0, 1, 2].map((n) => monthKey(new Date(d.getFullYear(), d.getMonth() - n, 1)));
  }, [today]);
  const { data: obligations = [] } = useMonthlyObligationsRange(refMonths);

  // Obrigações com prazo hoje e ainda por fazer: por obrigação e mês de referência.
  const items = useMemo(() => {
    const byKey = new Map<string, any>();
    obligations.forEach((o: any) => byKey.set(`${o.client_id}|${o.reference_month}|${o.obligation_type}`, o));
    const acc = new Map<string, { group: string; month: string; labels: Set<string>; clients: Set<string> }>();
    clients.filter((c: any) => c.active).forEach((c: any) => {
      refMonths.forEach((month) => {
        obrigacoesForClient(c, month).forEach((t) => {
          if (t.deadline !== today || isObrigacaoDone(t, byKey.get(`${c.id}|${month}|${t.type}`))) return;
          const k = `${t.group}|${month}`;
          if (!acc.has(k)) acc.set(k, { group: t.group, month, labels: new Set(), clients: new Set() });
          acc.get(k)!.labels.add(t.label);
          acc.get(k)!.clients.add(c.id);
        });
      });
    });
    const order = OBRIGACAO_GROUPS.map((g) => g.id);
    return [...acc.values()].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  }, [clients, obligations, refMonths, today]);

  const [open, setOpen] = useState(false);
  // Fallback em memória quando o localStorage não está disponível.
  const lastShownMem = useRef(0);
  const readLast = () => {
    try { return Number(localStorage.getItem(STORAGE_KEY)) || lastShownMem.current; } catch { return lastShownMem.current; }
  };
  const writeLast = (t: number) => {
    lastShownMem.current = t;
    try { localStorage.setItem(STORAGE_KEY, String(t)); } catch { /* só em memória */ }
  };

  // Verifica a cada minuto: muda o dia à meia-noite e reabre se já passou 1 hora desde o último aviso.
  useEffect(() => {
    const check = () => {
      const t = todayYmd();
      if (t !== today) setToday(t);
      if (items.length > 0 && !open && Date.now() - readLast() >= HOUR) {
        writeLast(Date.now());
        setOpen(true);
      }
    };
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [items.length, open, today]);

  const close = () => { writeLast(Date.now()); setOpen(false); };
  const label = (id: string) => OBRIGACAO_GROUPS.find((g) => g.id === id)?.label || id;
  const monthName = (m: string) => new Date(`${m.slice(0, 7)}-15T12:00:00`).toLocaleDateString("pt-PT", { month: "long" });

  return (
    <Dialog open={open && items.length > 0} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlarmClock className="w-5 h-5 text-warning" /> Prazos de hoje — {fmtPrazo(today)}
          </DialogTitle>
          <DialogDescription>Ainda há obrigações por cumprir com prazo hoje.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-lg border">
          {items.map((it) => (
            <li key={`${it.group}|${it.month}`} className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{label(it.group)} <span className="text-muted-foreground font-normal">({monthName(it.month)})</span></div>
                <div className="text-xs text-muted-foreground truncate">{[...it.labels].join(" · ")}</div>
              </div>
              <span className="text-sm font-semibold text-warning whitespace-nowrap">{it.clients.size} em falta</span>
              <Button size="sm" variant="outline" onClick={() => { close(); onOpen(it.group, it.month); }}>Ver</Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={close}>Lembrar daqui a 1 hora</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ObrigacoesPrazoReminder;
