import { useMemo, useState } from "react";
import { useLeads, useDeleteLead, type Lead } from "@/hooks/useSupabaseQuery";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  stagesFor,
  BUSINESS_TYPES,
  businessTypeLabel,
  ivaFrameworkLabel,
  eur,
  fmtDate,
  stageClass,
  stageLabel,
  monthKey,
  monthLabel,
} from "./leadConstants";
import LeadFormDialog from "./LeadFormDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const LeadsView = ({ segment = "contabilidade" }: { segment?: string }) => {
  const { data: leads = [], isLoading } = useLeads(segment);
  const del = useDeleteLead();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [bizType, setBizType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const now = new Date();
  const [navMonth, setNavMonth] = useState(now.getMonth()); // 0-indexed
  const [navYear, setNavYear] = useState(now.getFullYear());
  const prevMonth = () => { if (navMonth === 0) { setNavMonth(11); setNavYear((y) => y - 1); } else setNavMonth((m) => m - 1); };
  const nextMonth = () => { if (navMonth === 11) { setNavMonth(0); setNavYear((y) => y + 1); } else setNavMonth((m) => m + 1); };

  const filtered = useMemo(
    () =>
      leads
        .filter((l) => {
          const q = search.trim().toLowerCase();
          const matchQ =
            !q ||
            l.name.toLowerCase().includes(q) ||
            (l.email || "").toLowerCase().includes(q) ||
            (l.business_area || "").toLowerCase().includes(q) ||
            (l.nif || "").includes(q);
          return matchQ && (stage === "all" || l.stage === stage) && (bizType === "all" || l.business_type === bizType);
        })
        .sort((a, b) => {
          const da = (a.meeting_date || a.created_at || "").slice(0, 10);
          const db = (b.meeting_date || b.created_at || "").slice(0, 10);
          return db.localeCompare(da);
        }),
    [leads, search, stage, bizType]
  );

  // Consultorias: mostra o mês corrente por omissão, com setas para navegar por mês,
  // de acordo com a data da sessão (meeting_date).
  const selectedMonthKey = `${navYear}-${String(navMonth + 1).padStart(2, "0")}`;
  const monthLeads = useMemo(
    () => (segment === "consultoria" ? filtered.filter((l) => monthKey(l.meeting_date) === selectedMonthKey) : []),
    [filtered, segment, selectedMonthKey]
  );
  const noDateLeads = useMemo(
    () => (segment === "consultoria" ? filtered.filter((l) => !l.meeting_date) : []),
    [filtered, segment]
  );

  const colCount = segment === "consultoria" ? 7 : 10;

  const renderRow = (l: Lead) => (
    <tr key={l.id} className="border-t hover:bg-muted/30">
      <td className="p-3 font-medium">{l.name}{l.nif && <span className="block text-xs text-muted-foreground">NIF {l.nif}</span>}</td>
      <td className="p-3 text-xs text-muted-foreground">
        {l.email || "—"}
        {l.phone && <span className="block">{l.phone}</span>}
      </td>
      {segment !== "consultoria" && (
        <td className="p-3 text-xs text-muted-foreground">{l.suggested_product || "—"}</td>
      )}
      <td className="p-3">
        <Badge variant="outline" className={stageClass(l.stage)}>{stageLabel(l.stage)}</Badge>
        {segment !== "consultoria" && l.stage === "perda" && l.loss_reason && (
          <span className="block text-xs text-muted-foreground mt-1">{l.loss_reason}</span>
        )}
      </td>
      <td className="p-3 text-right font-medium">{eur(l.estimated_value)}</td>
      {segment !== "consultoria" && (
        <td className="p-3 text-xs">
          {businessTypeLabel(l.business_type)}
          <span className="block text-muted-foreground">{l.business_area || "—"}</span>
        </td>
      )}
      {segment !== "consultoria" && (
        <td className="p-3 text-xs">{ivaFrameworkLabel(l.iva_framework)}</td>
      )}

      <td className="p-3 text-xs">
        {segment === "consultoria" ? fmtDate(l.meeting_date) : l.meeting ? fmtDate(l.meeting_date) : "—"}
        {segment === "consultoria" && l.given_by && (
          <span className="block text-muted-foreground">{l.given_by}</span>
        )}
      </td>
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
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {leads.length} leads</p>
        </div>
        <div className="flex items-center gap-2">
          {segment === "consultoria" && (
            <div className="flex items-center gap-2 bg-card rounded-lg border px-2 py-1">
              <button onClick={prevMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-medium min-w-[160px] text-center">{monthLabel(selectedMonthKey)}</span>
              <button onClick={nextMonth} className="p-1 hover:bg-muted rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nova lead
          </Button>
        </div>
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
            {stagesFor(segment).map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {segment !== "consultoria" && (
          <Select value={bizType} onValueChange={setBizType}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {BUSINESS_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Contacto</th>
                {segment !== "consultoria" && <th className="text-left p-3">Produto</th>}
                <th className="text-left p-3">Estado</th>
                <th className="text-right p-3">Valor</th>
                {segment !== "consultoria" && <th className="text-left p-3">Tipo / área</th>}
                {segment !== "consultoria" && <th className="text-left p-3">IVA</th>}
                <th className="text-left p-3">{segment === "consultoria" ? "Sessão" : "Reunião"}</th>
                <th className="text-left p-3">Follow-up</th>

                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {segment === "consultoria" ? (
                <>
                  {monthLeads.map((l) => renderRow(l))}
                  {noDateLeads.length > 0 && (
                    <>
                      <tr className="border-t bg-muted/30">
                        <td colSpan={colCount} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Sem data de sessão <span className="font-normal normal-case">({noDateLeads.length})</span>
                        </td>
                      </tr>
                      {noDateLeads.map((l) => renderRow(l))}
                    </>
                  )}
                  {!isLoading && monthLeads.length === 0 && noDateLeads.length === 0 && (
                    <tr><td colSpan={colCount} className="p-6 text-center text-muted-foreground">Sem leads neste mês.</td></tr>
                  )}
                </>
              ) : (
                <>
                  {filtered.map((l) => renderRow(l))}
                  {!isLoading && filtered.length === 0 && (
                    <tr><td colSpan={colCount} className="p-6 text-center text-muted-foreground">Sem leads.</td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <LeadFormDialog segment={segment} open={dialogOpen} lead={editing} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

export default LeadsView;
