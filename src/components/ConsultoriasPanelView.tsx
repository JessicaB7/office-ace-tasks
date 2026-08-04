import { useMemo, useState } from "react";
import { useLeads } from "@/hooks/useSupabaseQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Handshake, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSULTORIA_STAGES, eur, fmtDate, stageClass, stageLabel } from "./comercial/leadConstants";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const ConsultoriasPanelView = () => {
  const { data: leads = [], isLoading } = useLeads("consultoria");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(new Date().getMonth());

  const inYear = (d: string | null) => !!d && new Date(d).getFullYear() === year;
  const monthOf = (d: string) => new Date(d).getMonth();
  const inSelectedMonth = (d: string | null) => month === null || (d ? monthOf(d) === month : false);

  const yearLeads = useMemo(() => leads.filter((l) => inYear(l.created_at)), [leads, year]);
  const filtered = useMemo(() => yearLeads.filter((l) => inSelectedMonth(l.created_at)), [yearLeads, month]);

  const semIVA = (v: number) => v / 1.23;

  const stats = useMemo(() => {
    const sim = filtered.filter((l) => l.stage === "mensal_sim");
    const nao = filtered.filter((l) => l.stage === "mensal_nao");
    const agendadas = filtered.filter((l) => l.stage === "reuniao_agendada");
    const valorTotalComIVA = filtered.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
    const valorTotal = semIVA(valorTotalComIVA);
    return {
      sim,
      nao,
      agendadas,
      taxa: filtered.length ? (sim.length / filtered.length) * 100 : 0,
      valorTotal,
      valorTotalComIVA,
    };
  }, [filtered]);


  const monthly = useMemo(
    () =>
      MONTHS.map((label, i) => {
        const novas = yearLeads.filter((l) => monthOf(l.created_at) === i);
        const sessoes = leads.filter((l) => inYear(l.meeting_date) && monthOf(l.meeting_date as string) === i);
        const sim = novas.filter((l) => l.stage === "mensal_sim");
        return {
          label,
          novas: novas.length,
          sessoes: sessoes.length,
          sim: sim.length,
          nao: novas.filter((l) => l.stage === "mensal_nao").length,
          valor: novas.reduce((s, l) => s + semIVA(Number(l.estimated_value || 0)), 0),
        };
      }),
    [leads, yearLeads, year]
  );

  const maxSessoes = Math.max(1, ...monthly.map((m) => m.sessoes));
  const visibleMonthly = useMemo(() => (month === null ? monthly : monthly.filter((_, i) => i === month)), [monthly, month]);

  const byStage = useMemo(
    () =>
      CONSULTORIA_STAGES.map((s) => {
        const items = filtered.filter((l) => l.stage === s.id);
        return { ...s, count: items.length, value: items.reduce((a, l) => a + semIVA(Number(l.estimated_value || 0)), 0) };
      }),
    [filtered]
  );

  const byConsultant = useMemo(() => {
    const map = new Map<string, { total: number; sim: number; valor: number }>();
    filtered.forEach((l) => {
      const key = l.given_by || "Não definido";
      const cur = map.get(key) || { total: 0, sim: 0, valor: 0 };
      map.set(key, {
        total: cur.total + 1,
        sim: cur.sim + (l.stage === "mensal_sim" ? 1 : 0),
        valor: cur.valor + semIVA(Number(l.estimated_value || 0)),
      });
    });
    return [...map.entries()].sort((a, b) => b[1].valor - a[1].valor);
  }, [filtered]);


  const proximas = useMemo(
    () =>
      leads
        .filter((l) => l.next_followup && !["mensal_sim", "mensal_nao"].includes(l.stage))
        .sort((a, b) => (a.next_followup || "").localeCompare(b.next_followup || ""))
        .slice(0, 8),
    [leads]
  );

  const years = [year + 1, year, year - 1, year - 2];
  const periodLabel = month === null ? String(year) : `${MONTHS[month]} ${year}`;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Painel de consultorias</h1>
          <p className="text-sm text-muted-foreground">Sessões, conversão em serviço mensal e follow-ups</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month === null ? "all" : String(month)} onValueChange={(v) => setMonth(v === "all" ? null : Number(v))}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Mês" /></SelectTrigger>
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

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Consultorias agendadas", value: String(stats.agendadas.length), hint: `${filtered.length} no período`, icon: Target },
          { label: `Valor total com IVA (${periodLabel})`, value: eur(stats.valorTotalComIVA), hint: `${filtered.length} leads`, icon: Handshake },
          { label: `Valor total sem IVA (${periodLabel})`, value: eur(stats.valorTotal), hint: `${filtered.length} leads · valor / 1,23`, icon: Handshake },
          { label: "Taxa de conversão", value: `${stats.taxa.toFixed(0)}%`, hint: `${stats.sim.length} com serviço mensal · ${stats.nao.length} sem`, icon: Users },
        ].map((k) => (

          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-bold mt-2">{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>
                </div>
                <k.icon className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Leads por estado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {byStage.map((s) => {
              const pct = filtered.length ? (s.count / filtered.length) * 100 : 0;
              return (
                <div key={s.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className={stageClass(s.id)}>{s.label}</Badge>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-sm font-semibold tabular-nums">{s.count}</span>
                      <span className="text-xs text-muted-foreground w-20">{eur(s.value)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%`, opacity: 0.6 + (pct / 100) * 0.4 }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Por consultor</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {byConsultant.length === 0 && <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
            {byConsultant.map(([name, v]) => (
              <div key={name} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{name}</span>
                <div className="text-right text-xs text-muted-foreground">
                  <span className="block text-sm font-semibold text-foreground">{eur(v.valor)}</span>
                  {v.total} sessões · {v.sim} com serviço mensal
                </div>
              </div>
            ))}

          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Atividade mensal</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Mês</th>
                <th className="text-right p-3">Novas leads</th>
                <th className="text-right p-3">Sessões</th>
                <th className="text-right p-3">Mensal sim</th>
                <th className="text-right p-3">Mensal não</th>
                <th className="text-right p-3">Valor</th>
                <th className="p-3 w-40" />
              </tr>
            </thead>
            <tbody>
              {visibleMonthly.map((m) => (
                <tr key={m.label} className="border-t">
                  <td className="p-3 font-medium">{m.label}</td>
                  <td className="p-3 text-right">{m.novas}</td>
                  <td className="p-3 text-right">{m.sessoes}</td>
                  <td className="p-3 text-right text-emerald-700">{m.sim}</td>
                  <td className="p-3 text-right text-destructive">{m.nao}</td>
                  <td className="p-3 text-right font-medium">{eur(m.valor)}</td>
                  <td className="p-3">
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(m.sessoes / maxSessoes) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Próximos follow-ups</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {proximas.length === 0 && <p className="text-sm text-muted-foreground">Sem follow-ups marcados.</p>}
          {proximas.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  {stageLabel(l.stage)}
                  {l.given_by ? ` · ${l.given_by}` : ""}
                  {l.meeting_date ? ` · sessão ${fmtDate(l.meeting_date)}` : ""}
                </p>
              </div>
              <span className="text-xs font-medium">{fmtDate(l.next_followup)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsultoriasPanelView;
