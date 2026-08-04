import { useMemo, useState } from "react";
import { useClients, useCollaborators, useLeads } from "@/hooks/useSupabaseQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Euro, TrendingUp, TrendingDown, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";

const eur = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ComercialView = () => {
  const { data: clients = [], isLoading } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: leads = [] } = useLeads();
  const [year, setYear] = useState(new Date().getFullYear());

  const monthlyLeads = useMemo(() => {
    const inYear = (d: string | null) => !!d && new Date(d).getFullYear() === year;
    return MONTHS.map((label, i) => {
      const novas = leads.filter((l) => inYear(l.created_at) && new Date(l.created_at).getMonth() === i);
      const propostas = leads.filter((l) => inYear(l.proposal_sent_at) && new Date(l.proposal_sent_at as string).getMonth() === i);
      const ganhas = propostas.filter((l) => l.stage === "ganho");
      return {
        label,
        novas: novas.length,
        propostas: propostas.length,
        ganhas: ganhas.length,
        valor: ganhas.reduce((s, l) => s + Number(l.estimated_value || 0), 0),
      };
    });
  }, [leads, year]);


  const stats = useMemo(() => {
    const ativos = clients.filter((c: any) => c.status === "ativo");
    const aSair = clients.filter((c: any) => c.status === "a_sair");
    const mrr = ativos.reduce((s: number, c: any) => s + Number(c.mensalidade || 0), 0);
    const risco = aSair.reduce((s: number, c: any) => s + Number(c.mensalidade || 0), 0);

    const novos = clients.filter((c: any) => {
      const d = c.inicio_contrato || c.created_at;
      return d && new Date(d).getFullYear() === year;
    });

    const perMonth = MONTHS.map((label, i) => {
      const list = novos.filter((c: any) => {
        const d = new Date(c.inicio_contrato || c.created_at);
        return d.getMonth() === i;
      });
      return {
        label,
        count: list.length,
        value: list.reduce((s: number, c: any) => s + Number(c.mensalidade || 0), 0),
      };
    });
    const maxCount = Math.max(1, ...perMonth.map((m) => m.count));

    const top = [...ativos]
      .sort((a: any, b: any) => Number(b.mensalidade || 0) - Number(a.mensalidade || 0))
      .slice(0, 8);

    const respName = (id: string | null) => collaborators.find((c: any) => c.id === id)?.name || "—";

    return {
      mrr,
      risco,
      ativos: ativos.length,
      novosCount: novos.length,
      novosValue: novos.reduce((s: number, c: any) => s + Number(c.mensalidade || 0), 0),
      ticket: ativos.length ? mrr / ativos.length : 0,
      perMonth,
      maxCount,
      top,
      aSair,
      respName,
    };
  }, [clients, collaborators, year]);

  const years = [year + 1, year, year - 1, year - 2];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Comercial</h1>
          <p className="text-sm text-muted-foreground">Carteira, novas entradas e receita em risco</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                y === year ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Receita recorrente", value: eur(stats.mrr), hint: `${stats.ativos} clientes ativos`, icon: Euro },
          { label: "Ticket médio", value: eur(stats.ticket), hint: "por cliente ativo", icon: Users2 },
          {
            label: `Novos em ${year}`,
            value: String(stats.novosCount),
            hint: `${eur(stats.novosValue)} / mês`,
            icon: TrendingUp,
          },
          {
            label: "Receita em risco",
            value: eur(stats.risco),
            hint: `${stats.aSair.length} clientes a sair`,
            icon: TrendingDown,
          },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <k.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Novas entradas por mês — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2 items-end h-40">
            {stats.perMonth.map((m) => (
              <div key={m.label} className="flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] text-muted-foreground">{m.count || ""}</span>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${(m.count / stats.maxCount) * 100}%`, minHeight: m.count ? 4 : 2 }}
                />
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Maiores mensalidades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.top.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{stats.respName(c.responsavel_id)}</p>
                </div>
                <span className="font-semibold">{eur(Number(c.mensalidade || 0))}</span>
              </div>
            ))}
            {stats.top.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Clientes a sair</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.aSair.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{stats.respName(c.responsavel_id)}</p>
                </div>
                <Badge variant="destructive">{eur(Number(c.mensalidade || 0))}</Badge>
              </div>
            ))}
            {stats.aSair.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente a sair.</p>}
          </CardContent>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
    </div>
  );
};

export default ComercialView;
