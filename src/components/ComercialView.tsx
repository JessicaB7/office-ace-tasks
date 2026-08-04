import { useMemo, useState } from "react";
import { useCollaborators, useLeads } from "@/hooks/useSupabaseQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Euro, TrendingUp, Target, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STAGES, eur, stageClass, stageLabel } from "./comercial/leadConstants";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ComercialView = () => {
  const { data: leads = [], isLoading } = useLeads();
  const { data: collaborators = [] } = useCollaborators();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);

  const inYear = (d: string | null) => !!d && new Date(d).getFullYear() === year;
  const monthOf = (d: string) => new Date(d).getMonth();
  const inSelectedMonth = (d: string | null) => month === null || (d ? monthOf(d) === month : false);

  const yearLeads = useMemo(() => leads.filter((l) => inYear(l.created_at)), [leads, year]);
  const filteredLeads = useMemo(
    () => yearLeads.filter((l) => inSelectedMonth(l.created_at)),
    [yearLeads, month]
  );

  const monthly = useMemo(
    () =>
      MONTHS.map((label, i) => {
        const novas = yearLeads.filter((l) => monthOf(l.created_at) === i);
        const reunioes = leads.filter((l) => inYear(l.meeting_date) && monthOf(l.meeting_date as string) === i);
        const propostas = leads.filter((l) => inYear(l.proposal_sent_at) && monthOf(l.proposal_sent_at as string) === i);
        const ganhas = novas.filter((l) => l.stage === "ganho");
        const perdidas = novas.filter((l) => l.stage === "perda");
        return {
          label,
          novas: novas.length,
          reunioes: reunioes.length,
          propostas: propostas.length,
          ganhas: ganhas.length,
          perdidas: perdidas.length,
          valor: ganhas.reduce((s, l) => s + Number(l.estimated_value || 0), 0),
        };
      }),
    [leads, yearLeads, year]
  );

  const visibleMonthly = useMemo(() => (month === null ? monthly : monthly.filter((_, i) => i === month)), [monthly, month]);

  const maxNovas = Math.max(1, ...monthly.map((m) => m.novas));

  const stats = useMemo(() => {
    const ganhas = filteredLeads.filter((l) => l.stage === "ganho");
    const perdidas = filteredLeads.filter((l) => l.stage === "perda");
    const abertas = filteredLeads.filter((l) => !["ganho", "perda"].includes(l.stage));
    const decididas = ganhas.length + perdidas.length;
    const ganhoValor = ganhas.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
    return {
      ganhas,
      perdidas,
      abertas,
      pipelineValor: abertas.reduce((s, l) => s + Number(l.estimated_value || 0), 0),
      ganhoValor,
      taxa: decididas ? (ganhas.length / decididas) * 100 : 0,
      ticket: ganhas.length ? ganhoValor / ganhas.length : 0,
    };
  }, [filteredLeads]);

  const byStage = useMemo(
    () =>
      LEAD_STAGES.map((s) => {
        const items = filteredLeads.filter((l) => l.stage === s.id);
        return {
          ...s,
          count: items.length,
          value: items.reduce((a, l) => a + Number(l.estimated_value || 0), 0),
        };
      }),
    [filteredLeads]
  );

  const products = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    filteredLeads.forEach((l) => {
      const key = (l.suggested_product || "Sem produto").trim() || "Sem produto";
      const cur = map.get(key) || { count: 0, value: 0 };
      map.set(key, { count: cur.count + 1, value: cur.value + Number(l.estimated_value || 0) });
    });
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 8);
  }, [filteredLeads]);

  const losses = useMemo(() => {
    const map = new Map<string, number>();
    stats.perdidas.forEach((l) => {
      const key = (l.loss_reason || "Sem motivo").trim() || "Sem motivo";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [stats.perdidas]);

  const ownerName = (id: string | null) => collaborators.find((c: any) => c.id === id)?.name || "—";

  const years = [year + 1, year, year - 1, year - 2];

  const periodLabel = month === null ? String(year) : `${MONTHS[month]} ${year}`;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Painel comercial</h1>
          <p className="text-sm text-muted-foreground">Atividade e resultados das leads da pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month === null ? "all" : String(month)} onValueChange={(v) => setMonth(v === "all" ? null : Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano todo</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Leads em aberto", value: String(stats.abertas.length), hint: `${eur(stats.pipelineValor)} em pipeline`, icon: Target },
          { label: `Ganhas em ${year}`, value: String(stats.ganhas.length), hint: `${eur(stats.ganhoValor)}`, icon: Handshake },
          { label: "Taxa de conversão", value: `${stats.taxa.toFixed(0)}%`, hint: `${stats.perdidas.length} perdidas`, icon: TrendingUp },
          { label: "Valor médio ganho", value: eur(stats.ticket), hint: "por lead ganha", icon: Euro },
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
          <CardTitle className="text-base">Novas leads por mês — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-2 items-end h-40">
            {monthly.map((m) => (
              <div key={m.label} className="flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] text-muted-foreground">{m.novas || ""}</span>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${(m.novas / maxNovas) * 100}%`, minHeight: m.novas ? 4 : 2 }}
                />
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Atividade comercial mensal — {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Mês</th>
                <th className="text-right p-3">Leads novas</th>
                <th className="text-right p-3">Reuniões</th>
                <th className="text-right p-3">Propostas enviadas</th>
                <th className="text-right p-3">Ganhas</th>
                <th className="text-right p-3">Perdas</th>
                <th className="text-right p-3">Valor ganho</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.label} className="border-t">
                  <td className="p-3 font-medium">{m.label}</td>
                  <td className="p-3 text-right">{m.novas || "—"}</td>
                  <td className="p-3 text-right">{m.reunioes || "—"}</td>
                  <td className="p-3 text-right">{m.propostas || "—"}</td>
                  <td className="p-3 text-right">{m.ganhas || "—"}</td>
                  <td className="p-3 text-right">{m.perdidas || "—"}</td>
                  <td className="p-3 text-right font-medium">{m.valor ? eur(m.valor) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline por estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {byStage.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <Badge variant="outline" className={stageClass(s.id)}>{s.label}</Badge>
                <div className="text-right">
                  <p className="font-semibold">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{eur(s.value)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Produtos sugeridos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {products.map(([name, p]) => (
              <div key={name} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">{p.count} lead(s)</p>
                </div>
                <span className="font-semibold">{eur(p.value)}</span>
              </div>
            ))}
            {products.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Motivos de perda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {losses.map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <p className="font-medium truncate">{reason}</p>
                <Badge variant="destructive">{count}</Badge>
              </div>
            ))}
            {losses.length === 0 && <p className="text-sm text-muted-foreground">Sem perdas registadas.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Leads ganhas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.ganhas.slice(0, 8).map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium truncate">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.suggested_product || stageLabel(l.stage)} · {ownerName(l.owner_id)}
                  </p>
                </div>
                <span className="font-semibold">{eur(l.estimated_value)}</span>
              </div>
            ))}
            {stats.ganhas.length === 0 && <p className="text-sm text-muted-foreground">Sem leads ganhas.</p>}
          </CardContent>
        </Card>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
    </div>
  );
};

export default ComercialView;
