/** Confirmação das sessões (diagnóstico e consultoria): estado de cada lead e quem recebe o pop-up. */

export type ConfirmationState = "confirmada" | "atrasada" | "hoje" | "agendada" | "sem_sessao";

interface LeadLike {
  meeting_date: string | null;
  confirmation_date: string | null;
  meeting_confirmed: boolean;
}

/** Hoje no formato "AAAA-MM-DD" (hora local). */
export const todayKey = (d = new Date()) => d.toLocaleDateString("sv-SE");

export function confirmationState(lead: LeadLike, today = todayKey()): ConfirmationState {
  if (!lead.meeting_date || !lead.confirmation_date) return "sem_sessao";
  if (lead.meeting_confirmed) return "confirmada";
  if (lead.meeting_date < today) return "sem_sessao"; // sessão já passou
  if (lead.confirmation_date < today) return "atrasada";
  if (lead.confirmation_date === today) return "hoje";
  return "agendada";
}

/** Sessões por confirmar hoje (ou em atraso), para o pop-up. */
export const needsConfirmation = (lead: LeadLike, today = todayKey()) => {
  const s = confirmationState(lead, today);
  return s === "hoje" || s === "atrasada";
};

/** O pop-up é para a função administrativa (cargo do colaborador), não para uma pessoa. */
export const isAdministrativeRole = (role: string | null | undefined) => /administrativ/i.test(role || "");
