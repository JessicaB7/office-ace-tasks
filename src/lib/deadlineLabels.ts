/** Textos dos prazos fiscais do "O meu dia": período a que o prazo se refere e
 * quanto falta (ou há quanto passou). Puro, para ser testável. */

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Período de referência de um prazo que cai no mês `monthIndex` (0–11) de `year`,
 * sendo `offset` o nº de meses para trás. Trimestral → "3º trimestre". */
export function referenceLabel(monthIndex: number, year: number, offset: number, quarterly: boolean): string {
  const total = monthIndex - offset;
  const m = ((total % 12) + 12) % 12;
  const y = year + Math.floor(total / 12);
  const suffix = y !== year ? ` ${y}` : "";
  if (quarterly) return `Referente ao ${Math.floor(m / 3) + 1}º trimestre${suffix}`;
  return `Referente a ${MONTH_NAMES[m]}${suffix}`;
}

export type DeadlineTone = "atrasado" | "urgente" | "proximo" | "concluido";

/** Quanto falta para o prazo, em dias de calendário. */
export function relativeDeadline(date: Date, today: Date, allDone: boolean): { label: string; tone: DeadlineTone } {
  if (allDone) return { label: "Concluído", tone: "concluido" };
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((b - a) / 86_400_000);
  if (days < 0) return { label: days === -1 ? "Terminou ontem" : `Terminou há ${-days} dias`, tone: "atrasado" };
  if (days === 0) return { label: "Termina hoje", tone: "urgente" };
  if (days === 1) return { label: "Termina amanhã", tone: "urgente" };
  return { label: `Faltam ${days} dias`, tone: "proximo" };
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Data curta e igual em todos os browsers: "ter, 20 out". */
export const shortDate = (d: Date): string => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
