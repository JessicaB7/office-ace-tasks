import { useMemo } from "react";
import { useClients, useCollaborators, useTasks, useMonthlyObligations } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
import {
  Euro,
  Users,
  Building2,
  TrendingDown,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const eur = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);

const TYPE_LABELS: Record<string, string> = {
  SQ: "Empresas (SQ)",
  "TI CO": "TI Contabilidade Organizada",
  "TI RS": "TI Simplificado",
};

interface Props {
  onNavigate?: (view: string) => void;
}

const BusinessOverviewView = ({ onNavigate }: Props) => {
  const { isAdmin } = useAuth();
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: tasks = [] } = useTasks();

  const refMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const { data: obligations = [] } = useMonthlyObligations(refMonth);

  const stats = useMemo(() => {
    const ativos = clients.filter((c: any) => c.status === "ativo");
    const aSair = clients.filter((c: any) => c.status === "a_sair");
    const inativos = clients.filter((c: any) => c.status === "inativo");
    const mrr = ativos.reduce((s: number, c: any) => s + Number(c.mensalidade || 0), 0);
    const riscoMrr = aSair.reduce((s: number, c: any) => s + Number(c.mensalidade || 0), 0);

    const byType = new Map<string, { count: number; value: number }>();
    ativos.forEach((c: any) => {
      const key = c.tipo_contabilidade || "Sem tipo";
      const cur = byType.get(key) || { count: 0, value: 0 };
      byType.set(key, { count: cur.count + 1, value: cur.value + Number(c.mensalidade || 0) });
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const openTasks = tasks.filter((t: any) => t.status === "pendente" || t.status === "em_progresso");
    const overdue = openTasks.filter((t: any) => new Date(`${t.due_date}T12:00:00`) < today);

    const workload = collaborators
      .filter((c: any) => c.active)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        clients: ativos.filter((cl: any) => cl.responsavel_id === c.id).length,
        value: ativos
          .filter((cl: any) => cl.responsavel_id === c.id)
          .reduce((s: number, cl: any) => s + Number(cl.mensalidade || 0), 0),
        open: openTasks.filter((t: any) => t.collaborator_id === c.id).length,
        overdue: overdue.filter((t: any) => t.collaborator_id === c.id).length,
      }))
      .sort((a, b) => b.open - a.open);

    const done = obligations.filter((o: any) => o.status === "concluida").length;
    const total = obligations.length;

    return {
      ativos: ativos.length,
      aSair,
      inativos: inativos.length,
      mrr,
      riscoMrr,
      byType: [...byType.entries()].sort((a, b) => b[1].value - a[1].value),
      openTasks: openTasks.length,
      overdue: overdue.length,
      workload,
      obligationsDone: done,
      obligationsTotal: total,
      ticketMedio: ativos.length ? mrr / ativos.length : 0,
    };
  }, [clients, collaborators, tasks, obligations]);

  if (isLoading) {
    return <p className="text-muted-foreground">A carregar painel do negócio...</p>;
  }

  const kpis = [
    { label: "Receita mensal recorrente", value: eur(stats.mrr), hint: `${stats.ativos} clientes ativos`, icon: Euro, tone: "primary" },
    { label: "Ticket médio", value: eur(stats.ticketMedio), hint: "por cliente ativo", icon: Building2, tone: "muted" },
    { label: "Receita em risco", value: eur(stats.riscoMrr), hint: `${stats.aSair.length} clientes a sair`, icon: TrendingDown, tone: "destructive" },
    {
      label: "Obrigações do mês",
      value: stats.obligationsTotal ? `${stats.obligationsDone}/${stats.obligationsTotal}` : "—",
      hint: "concluídas",
      icon: ClipboardCheck,
      tone: "muted",
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Painel do negócio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão global do escritório: carteira de clientes, receita, equipa e obrigações.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</span>
              <k.icon
                className={cn(
                  "w-4 h-4",
                  k.tone === "primary" && "text-primary",
                  k.tone === "destructive" && "text-destructive",
                  k.tone === "muted" && "text-muted-foreground"
                )}
              />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Carteira por tipo de contabilidade</h2>
            <button
              onClick={() => onNavigate?.("clients")}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Ver clientes <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {stats.byType.length === 0 && <p className="text-sm text-muted-foreground">Sem clientes ativos.</p>}
            {stats.byType.map(([type, v]) => {
              const pct = stats.mrr ? (v.value / stats.mrr) * 100 : 0;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{TYPE_LABELS[type] || type}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {v.count} · {eur(v.value)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold mb-4">Estado da carteira</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Ativos</span>
              <span className="font-medium tabular-nums">{stats.ativos}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">A sair</span>
              <span className="font-medium tabular-nums text-destructive">{stats.aSair.length}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Inativos</span>
              <span className="font-medium tabular-nums">{stats.inativos}</span>
            </li>
          </ul>
          <div className="mt-4 pt-4 border-t space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tarefas abertas</span>
              <span className="font-medium tabular-nums">{stats.openTasks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Em atraso
              </span>
              <span className="font-medium tabular-nums text-destructive">{stats.overdue}</span>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" /> Equipa
            </h2>
            <button
              onClick={() => onNavigate?.("collaborators")}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Ver colaboradores <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-5 py-2">Colaborador</th>
                  <th className="text-right font-medium px-5 py-2">Clientes</th>
                  <th className="text-right font-medium px-5 py-2">Receita gerida</th>
                  <th className="text-right font-medium px-5 py-2">Tarefas abertas</th>
                  <th className="text-right font-medium px-5 py-2">Em atraso</th>
                </tr>
              </thead>
              <tbody>
                {stats.workload.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-5 py-2.5 font-medium">{c.name}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{c.clients}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{eur(c.value)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{c.open}</td>
                    <td
                      className={cn(
                        "px-5 py-2.5 text-right tabular-nums",
                        c.overdue > 0 && "text-destructive font-medium"
                      )}
                    >
                      {c.overdue}
                    </td>
                  </tr>
                ))}
                {stats.workload.length === 0 && (
                  <tr className="border-t">
                    <td colSpan={5} className="px-5 py-4 text-muted-foreground">
                      Sem colaboradores ativos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.aSair.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="text-sm font-semibold mb-3 inline-flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-destructive" /> Clientes a sair — {eur(stats.riscoMrr)}/mês
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {stats.aSair.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg bg-card border px-3 py-2">
                <span className="truncate mr-2">{c.name}</span>
                <span className="tabular-nums text-muted-foreground">{eur(Number(c.mensalidade || 0))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BusinessOverviewView;
