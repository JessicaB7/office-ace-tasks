import { useEffect, useMemo, useState } from "react";
import { useLeads, useUpsertLead, useCollaborators } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmationState, isAdministrativeRole, needsConfirmation, todayKey } from "@/lib/sessionConfirmation";

const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-PT") : "—");

/** Pop-up para a função administrativa no dia da confirmação das sessões (e enquanto houver
 * confirmações em atraso). Aparece ao abrir a app e sempre que surge uma sessão nova para confirmar. */
const SessionConfirmationReminder = ({ onViewLeads }: { onViewLeads?: () => void }) => {
  const { user } = useAuth();
  const { data: collaborators = [] } = useCollaborators();
  const { data: leads = [], isFetched } = useLeads();
  const upsert = useUpsertLead();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const me = useMemo(
    () => (user?.email ? collaborators.find((c: any) => c.email?.toLowerCase() === user.email!.toLowerCase()) : null),
    [user, collaborators]
  );
  const enabled = !!me && isAdministrativeRole(me.role);

  const pending = useMemo(
    () => leads.filter((l) => needsConfirmation(l)).sort((a, b) => (a.meeting_date || "").localeCompare(b.meeting_date || "")),
    [leads]
  );

  // Mostra uma vez por dia por sessão: guarda as sessões já mostradas hoje.
  useEffect(() => {
    if (!enabled || !isFetched || pending.length === 0) return;
    const key = `sessionConfirmReminder:${me!.id}:${todayKey()}`;
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* sem localStorage */ }
    const fresh = pending.filter((l) => !seen.includes(l.id));
    if (fresh.length === 0) return;
    try { localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map((l) => l.id)])); } catch { /* sem localStorage */ }
    setOpen(true);
  }, [enabled, isFetched, pending, me]);

  const markConfirmed = async (id: string, name: string) => {
    setSaving(id);
    try {
      await upsert.mutateAsync({ id, name, meeting_confirmed: true });
      toast.success(`Sessão confirmada — ${name}`);
    } catch (e: any) {
      toast.error("Não foi possível marcar: " + e.message);
    } finally {
      setSaving(null);
    }
  };

  if (!enabled) return null;

  return (
    <Dialog open={open && pending.length > 0} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" /> Sessões para confirmar
          </DialogTitle>
          <DialogDescription>
            Envia a mensagem de confirmação (Scripts) e marca cada sessão quando a pessoa confirmar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {pending.map((l) => {
            const late = confirmationState(l) === "atrasada";
            return (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.segment === "consultoria" ? "Consultoria" : "Sessão de diagnóstico"} · {fmt(l.meeting_date)}
                    {l.phone ? ` · ${l.phone}` : ""}
                  </div>
                  {late && <div className="text-xs font-medium text-destructive">Confirmação atrasada (era a {fmt(l.confirmation_date)})</div>}
                </div>
                <Button size="sm" variant="outline" className={cn("shrink-0")} disabled={saving !== null} onClick={() => markConfirmed(l.id, l.name)}>
                  <Check className="w-4 h-4 mr-1" /> {saving === l.id ? "A marcar…" : "Confirmada"}
                </Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          {onViewLeads && (
            <Button variant="outline" onClick={() => { setOpen(false); onViewLeads(); }}>Ver leads</Button>
          )}
          <Button onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionConfirmationReminder;
