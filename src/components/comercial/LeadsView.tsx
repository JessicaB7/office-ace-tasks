import { useMemo, useState } from "react";
import { useLeads, useDeleteLead, type Lead } from "@/hooks/useSupabaseQuery";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LEAD_STAGES,
  BUSINESS_TYPES,
  businessTypeLabel,
  ivaFrameworkLabel,
  eur,
  fmtDate,
  stageClass,
  stageLabel,
} from "./leadConstants";
import LeadFormDialog from "./LeadFormDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const LeadsView = () => {
  const { data: leads = [], isLoading } = useLeads();
  const del = useDeleteLead();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [bizType, setBizType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);

  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        const q = search.trim().toLowerCase();
        const matchQ =
          !q ||
          l.name.toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q) ||
          (l.business_area || "").toLowerCase().includes(q) ||
          (l.nif || "").includes(q);
        return matchQ && (stage === "all" || l.stage === stage) && (bizType === "all" || l.business_type === bizType);
      }),
    [leads, search, stage, bizType]
  );


  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {leads.length} leads</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova lead
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Procurar nome, email ou NIF…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estados</SelectItem>
            {LEAD_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os responsáveis</SelectItem>
            {collaborators.filter((c: any) => c.active).map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Contacto</th>
                <th className="text-left p-3">Produto</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Responsável</th>
                <th className="text-left p-3">Reunião</th>
                <th className="text-left p-3">Follow-up</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{l.name}{l.nif && <span className="block text-xs text-muted-foreground">NIF {l.nif}</span>}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {l.email || "—"}
                    {l.phone && <span className="block">{l.phone}</span>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{l.suggested_product || "—"}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={stageClass(l.stage)}>{stageLabel(l.stage)}</Badge>
                    {l.stage === "perda" && l.loss_reason && (
                      <span className="block text-xs text-muted-foreground mt-1">{l.loss_reason}</span>
                    )}
                  </td>
                  <td className="p-3 text-right font-medium">{eur(l.estimated_value)}</td>
                  <td className="p-3 text-xs">{ownerName(l.owner_id)}</td>
                  <td className="p-3 text-xs">{l.meeting ? fmtDate(l.meeting_date) : "—"}</td>
                  <td className="p-3 text-xs">{fmtDate(l.next_followup)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(l); setDialogOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm(`Eliminar a lead "${l.name}"?`)) return;
                            try {
                              await del.mutateAsync(l.id);
                              toast.success("Lead eliminada.");
                            } catch (e: any) {
                              toast.error(e.message || "Erro ao eliminar.");
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Sem leads.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <LeadFormDialog open={dialogOpen} lead={editing} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

export default LeadsView;
