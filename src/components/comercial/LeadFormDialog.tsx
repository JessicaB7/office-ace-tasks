import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCollaborators, useUpsertLead, type Lead } from "@/hooks/useSupabaseQuery";
import { LEAD_STAGES } from "./leadConstants";
import { toast } from "sonner";

interface Props {
  open: boolean;
  lead: Lead | null;
  defaultStage?: string;
  onClose: () => void;
}

const empty = {
  name: "",
  nif: "",
  email: "",
  phone: "",
  source: "",
  stage: "novo",
  estimated_value: "",
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
            nif: lead.nif || "",
            email: lead.email || "",
            phone: lead.phone || "",
            source: lead.source || "",
            stage: lead.stage || "novo",
            estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : "",
            proposal_sent_at: lead.proposal_sent_at || "",
            next_followup: lead.next_followup || "",
            owner_id: lead.owner_id || "",
            notes: lead.notes || "",
          }
        : { ...empty, stage: defaultStage || "novo" }
    );
  }, [open, lead, defaultStage]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Indica o nome da lead.");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: lead?.id,
        name: form.name.trim(),
        nif: form.nif || null,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
        stage: form.stage,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar lead" : "Nova lead"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>NIF</Label>
            <Input value={form.nif} onChange={(e) => set("nif", e.target.value)} />
          </div>
          <div>
            <Label>Origem</Label>
            <Input placeholder="Referência, redes sociais…" value={form.source} onChange={(e) => set("source", e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Fase</Label>
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
            <Label>Mensalidade estimada (€)</Label>
            <Input type="number" step="0.01" value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} />
          </div>
          <div>
            <Label>Proposta enviada em</Label>
            <Input type="date" value={form.proposal_sent_at} onChange={(e) => set("proposal_sent_at", e.target.value)} />
          </div>
          <div>
            <Label>Próximo follow-up</Label>
            <Input type="date" value={form.next_followup} onChange={(e) => set("next_followup", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Responsável</Label>
            <Select value={form.owner_id || "none"} onValueChange={(v) => set("owner_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {collaborators.filter((c: any) => c.active).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
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
