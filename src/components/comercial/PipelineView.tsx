import { useMemo, useState } from "react";
import { useLeads, useCollaborators, useUpsertLead, type Lead } from "@/hooks/useSupabaseQuery";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LEAD_STAGES, eur, fmtDate } from "./leadConstants";
import LeadFormDialog from "./LeadFormDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PipelineView = () => {
  const { data: leads = [], isLoading } = useLeads();
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertLead();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [defaultStage, setDefaultStage] = useState("novo");

  const columns = useMemo(
    () =>
      LEAD_STAGES.map((s) => {
        const items = leads.filter((l) => l.stage === s.id);
        return { ...s, items, value: items.reduce((a, l) => a + Number(l.estimated_value || 0), 0) };
      }),
    [leads]
  );

  const ownerName = (id: string | null) => collaborators.find((c: any) => c.id === id)?.name || "—";

  const openNew = (stage: string) => {
    setEditing(null);
    setDefaultStage(stage);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Leads por fase de negociação</p>
        </div>
        <Button onClick={() => openNew("novo")}>
          <Plus className="w-4 h-4 mr-2" /> Nova lead
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {columns.map((col) => (
          <div key={col.id} className="space-y-2">
            <div className="flex items-baseline justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide">{col.label}</p>
              <span className="text-xs text-muted-foreground">{col.items.length}</span>
            </div>
            <p className="px-1 text-xs text-muted-foreground">{eur(col.value)}</p>
            <div className="space-y-2 min-h-[80px]">
              {col.items.map((lead) => (
                <Card
                  key={lead.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => {
                    setEditing(lead);
                    setDialogOpen(true);
                  }}
                >
                  <CardContent className="p-3 space-y-2">
                    <p className="text-sm font-medium leading-tight">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{eur(lead.estimated_value)}</p>
                    <p className="text-[11px] text-muted-foreground">{ownerName(lead.owner_id)}</p>
                    {lead.next_followup && (
                      <p className="text-[11px] text-muted-foreground">Follow-up: {fmtDate(lead.next_followup)}</p>
                    )}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={lead.stage}
                        onValueChange={(v) => upsert.mutate({ id: lead.id, name: lead.name, stage: v })}
                      >
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEAD_STAGES.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <button
                onClick={() => openNew(col.id)}
                className="w-full py-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                + Adicionar
              </button>
            </div>
          </div>
        ))}
      </div>

      <LeadFormDialog open={dialogOpen} lead={editing} defaultStage={defaultStage} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

export default PipelineView;
