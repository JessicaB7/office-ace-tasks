import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpsertLead, type Lead } from "@/hooks/useSupabaseQuery";
import { LEAD_STAGES, BUSINESS_TYPES, IVA_FRAMEWORKS } from "./leadConstants";
import { toast } from "sonner";

interface Props {
  open: boolean;
  lead: Lead | null;
  defaultStage?: string;
  onClose: () => void;
}

const empty = {
  name: "",
  phone: "",
  email: "",
  meeting: false,
  meeting_date: "",
  suggested_product: "",
  estimated_value: "",
  stage: "reuniao_agendada",
  loss_reason: "",
  proposal_sent_at: "",
  next_followup: "",
  owner_id: "",
  notes: "",
};

const LeadFormDialog = ({ open, lead, defaultStage, onClose }: Props) => {
  const [form, setForm] = useState({ ...empty });
  const { data: collaborators = [] } = useCollaborators();
  const upsert = useUpsertLead();

  useEffect(() => {
    if (!open) return;
    setForm(
      lead
        ? {
            name: lead.name || "",
            phone: lead.phone || "",
            email: lead.email || "",
            meeting: !!lead.meeting,
            meeting_date: lead.meeting_date || "",
            suggested_product: lead.suggested_product || "",
            estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : "",
            stage: lead.stage || "reuniao_agendada",
            loss_reason: lead.loss_reason || "",
            proposal_sent_at: lead.proposal_sent_at || "",
            next_followup: lead.next_followup || "",
            owner_id: lead.owner_id || "",
            notes: lead.notes || "",
          }
        : { ...empty, stage: defaultStage || "reuniao_agendada" }
    );
  }, [open, lead, defaultStage]);

  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  // Follow-up por defeito: 3 dias após a data da reunião
  const plus3 = (d: string) => {
    const base = new Date(`${d}T12:00:00`);
    if (isNaN(base.getTime())) return "";
    base.setDate(base.getDate() + 3);
    return base.toISOString().slice(0, 10);
  };

  const setMeetingDate = (v: string) =>
    setForm((p) => {
      const auto = p.next_followup === "" || (p.meeting_date && p.next_followup === plus3(p.meeting_date));
      return { ...p, meeting_date: v, next_followup: auto && v ? plus3(v) : p.next_followup };
    });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Indica o nome da lead.");
      return;
    }
    if (form.stage === "perda" && !form.loss_reason.trim()) {
      toast.error("Indica o motivo da perda.");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: lead?.id,
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        meeting: form.meeting,
        meeting_date: form.meeting ? form.meeting_date || null : null,
        suggested_product: form.suggested_product || null,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        stage: form.stage,
        loss_reason: form.stage === "perda" ? form.loss_reason.trim() : null,
        proposal_sent_at: form.proposal_sent_at || null,
        next_followup: form.next_followup || null,
        owner_id: form.owner_id || null,
        notes: form.notes || null,
      });
      toast.success(lead ? "Lead atualizada." : "Lead criada.");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível guardar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Nova lead"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Contacto</Label>
            <Input placeholder="Telefone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Reunião</Label>
              <p className="text-xs text-muted-foreground">{form.meeting ? "Sim" : "Não"}</p>
            </div>
            <Switch checked={form.meeting} onCheckedChange={(v) => set("meeting", v)} />
          </div>
          <div>
            <Label>Data da reunião</Label>
            <Input
              type="date"
              disabled={!form.meeting}
              value={form.meeting_date}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Produto sugerido</Label>
            <Input
              placeholder="Contabilidade, IRS, consultoria…"
              value={form.suggested_product}
              onChange={(e) => set("suggested_product", e.target.value)}
            />
          </div>
          <div>
            <Label>Valor (€)</Label>
            <Input type="number" step="0.01" value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} />
          </div>

          <div>
            <Label>Estado</Label>
            <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo da perda {form.stage === "perda" && "*"}</Label>
            <Input
              disabled={form.stage !== "perda"}
              placeholder="Preço, ficou com o atual…"
              value={form.loss_reason}
              onChange={(e) => set("loss_reason", e.target.value)}
            />
          </div>

          <div>
            <Label>Proposta enviada em</Label>
            <Input type="date" value={form.proposal_sent_at} onChange={(e) => set("proposal_sent_at", e.target.value)} />
          </div>
          <div>
            <Label>Próximo follow-up</Label>
            <Input type="date" value={form.next_followup} onChange={(e) => set("next_followup", e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Por defeito, 3 dias após a reunião.</p>
          </div>
          <div>
            <Label>Tipo de negócio</Label>
            <Select value={form.business_type || "none"} onValueChange={(v) => set("business_type", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não definido</SelectItem>
                {BUSINESS_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Área de negócio</Label>
            <Input
              placeholder="Restauração, construção, consultoria…"
              value={form.business_area}
              onChange={(e) => set("business_area", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Enquadramento em IVA</Label>
            <Select value={form.iva_framework || "none"} onValueChange={(v) => set("iva_framework", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não definido</SelectItem>
                {IVA_FRAMEWORKS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Notas</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadFormDialog;
