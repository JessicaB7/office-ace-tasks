import { useMemo, useState } from "react";
import { useLeads, useUpsertLead, type Lead } from "@/hooks/useSupabaseQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eur, fmtDate, stageClass, stageLabel, businessTypeLabel, closedStagesFor } from "./leadConstants";
import LeadFormDialog from "./LeadFormDialog";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

const addDays = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const FollowUpsView = ({ segment = "contabilidade" }: { segment?: string }) => {
  const { data: leads = [] } = useLeads(segment);
  const upsert = useUpsertLead();
  const [editing, setEditing] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const groups = useMemo(() => {
    const today = addDays(0);
    const week = addDays(7);
    const withDate = leads
      .filter((l) => l.next_followup && !closedStagesFor(segment).includes(l.stage))
      .sort((a, b) => (a.next_followup || "").localeCompare(b.next_followup || ""));
    return {
      atrasados: withDate.filter((l) => (l.next_followup as string) < today),
      hoje: withDate.filter((l) => l.next_followup === today),
      semana: withDate.filter((l) => (l.next_followup as string) > today && (l.next_followup as string) <= week),
      futuros: withDate.filter((l) => (l.next_followup as string) > week),
      sem: leads.filter((l) => !l.next_followup && !closedStagesFor(segment).includes(l.stage)),
    };
  }, [leads, segment]);


  const Row = ({ lead, tone }: { lead: Lead; tone?: string }) => (
    <div className="flex items-center justify-between gap-3 border-b last:border-0 py-2.5 flex-wrap">
      <div className="min-w-0">
        <p className="text-sm font-medium">{lead.name}</p>
        <p className="text-xs text-muted-foreground">
          {businessTypeLabel(lead.business_type)} · {eur(lead.estimated_value)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={stageClass(lead.stage)}>{stageLabel(lead.stage)}</Badge>
        <span className={cn("text-xs font-medium", tone)}>{fmtDate(lead.next_followup)}</span>
        <Button size="sm" variant="outline" onClick={() => upsert.mutate({ id: lead.id, name: lead.name, next_followup: addDays(7) })}>
          +7 dias
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(lead); setDialogOpen(true); }}>
          Abrir
        </Button>
      </div>
    </div>
  );

  const sections = [
    { title: "Atrasados", items: groups.atrasados, tone: "text-destructive" },
    { title: "Hoje", items: groups.hoje, tone: "text-primary" },
    { title: "Próximos 7 dias", items: groups.semana, tone: "text-muted-foreground" },
    { title: "Mais tarde", items: groups.futuros, tone: "text-muted-foreground" },
    { title: "Sem follow-up marcado", items: groups.sem, tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Follow ups</h1>
        <p className="text-sm text-muted-foreground">Contactos a fazer, por prioridade</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Atrasados", value: groups.atrasados.length },
          { label: "Hoje", value: groups.hoje.length },
          { label: "Próximos 7 dias", value: groups.semana.length },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {sections.map((s) => (
        <Card key={s.title}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">{s.title} <span className="text-muted-foreground font-normal">({s.items.length})</span></CardTitle>
          </CardHeader>
          <CardContent>
            {s.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada a fazer aqui.</p>
            ) : (
              s.items.map((l) => <Row key={l.id} lead={l} tone={s.tone} />)
            )}
          </CardContent>
        </Card>
      ))}

      <LeadFormDialog segment={segment} open={dialogOpen} lead={editing} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

export default FollowUpsView;
