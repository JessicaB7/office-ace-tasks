import { useMemo, useState } from "react";
import { useLeads, useUpsertLead, type Lead } from "@/hooks/useSupabaseQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eur, fmtDate, stageClass, stageLabel, businessTypeLabel } from "./leadConstants";
import LeadFormDialog from "./LeadFormDialog";
import { FileText, ThumbsUp, ThumbsDown } from "lucide-react";

const PropostasView = () => {
  const { data: leads = [] } = useLeads(segment);
  const upsert = useUpsertLead();
  const [editing, setEditing] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sent = useMemo(
    () =>
      leads
        .filter((l) => l.proposal_sent_at || ["proposta_enviada", "ganho", "perda"].includes(l.stage))
        .sort((a, b) => (b.proposal_sent_at || "").localeCompare(a.proposal_sent_at || "")),
    [leads]
  );

  const stats = useMemo(() => {
    const pend = sent.filter((l) => l.stage === "proposta_enviada");
    const won = sent.filter((l) => l.stage === "ganho");
    const lost = sent.filter((l) => l.stage === "perda");
    const decided = won.length + lost.length;
    return {
      pend,
      won,
      lost,
      rate: decided ? (won.length / decided) * 100 : 0,
      pendValue: pend.reduce((a, l) => a + Number(l.estimated_value || 0), 0),
      wonValue: won.reduce((a, l) => a + Number(l.estimated_value || 0), 0),
    };
  }, [sent]);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Propostas enviadas</h1>
        <p className="text-sm text-muted-foreground">Acompanhamento das propostas e taxa de conversão</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Aguardam resposta", value: String(stats.pend.length), hint: `${eur(stats.pendValue)}`, icon: FileText },
          { label: "Ganhas", value: String(stats.won.length), hint: `${eur(stats.wonValue)}`, icon: ThumbsUp },
          { label: "Perdidas", value: String(stats.lost.length), hint: "propostas sem sucesso", icon: ThumbsDown },
          { label: "Taxa de conversão", value: `${stats.rate.toFixed(0)}%`, hint: "ganhas / decididas", icon: FileText },
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
          <CardTitle className="text-base">Histórico de propostas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Lead</th>
                <th className="text-left p-3">Enviada</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Tipo de negócio</th>
                <th className="text-left p-3">Estado</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {sent.map((l) => (
                <tr key={l.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{l.name}</td>
                  <td className="p-3 text-xs">{fmtDate(l.proposal_sent_at)}</td>
                  <td className="p-3 text-right font-medium">{eur(l.estimated_value)}</td>
                  <td className="p-3 text-xs">{businessTypeLabel(l.business_type)}</td>
                  <td className="p-3"><Badge variant="outline" className={stageClass(l.stage)}>{stageLabel(l.stage)}</Badge></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      {l.stage === "proposta_enviada" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => upsert.mutate({ id: l.id, name: l.name, stage: "ganho" })}>
                            Ganhou
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => upsert.mutate({ id: l.id, name: l.name, stage: "perda" })}>
                            Perdeu
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(l); setDialogOpen(true); }}>
                        Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {sent.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem propostas registadas.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <LeadFormDialog open={dialogOpen} lead={editing} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

export default PropostasView;
