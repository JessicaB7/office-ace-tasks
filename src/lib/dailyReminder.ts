/** Pop-up diário das tarefas: aparece uma vez por dia, a partir das 9h
 * (às 9h com a app aberta, ou na primeira abertura depois disso). */

export const REMINDER_HOUR = 9;

/** Data local "YYYY-MM-DD" (chave do dia em que o pop-up já foi mostrado). */
export const localDayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const shouldShowDailyReminder = (now: Date, lastShownDay: string | null): boolean =>
  now.getHours() >= REMINDER_HOUR && lastShownDay !== localDayKey(now);

/** Intervalo entre pop-ups das tarefas pendentes (2 horas). */
export const REMINDER_EVERY_MS = 2 * 60 * 60 * 1000;

/** Pop-up das tarefas pendentes: ao abrir a app e depois de 2 em 2 horas.
 * `lastShownAt` é o instante (ms) do último pop-up, ou null se ainda não apareceu. */
export const shouldShowPendingReminder = (nowMs: number, lastShownAt: number | null): boolean =>
  lastShownAt === null || !isFinite(lastShownAt) || nowMs - lastShownAt >= REMINDER_EVERY_MS;

export type DueGroup = "atrasadas" | "hoje" | "proximas";

/** Agrupa pela data limite face a hoje (dias de calendário locais). */
export const dueGroup = (dueDate: string, now: Date): DueGroup => {
  const due = localDayKey(new Date(dueDate.length === 10 ? `${dueDate}T12:00:00` : dueDate));
  const today = localDayKey(now);
  return due < today ? "atrasadas" : due === today ? "hoje" : "proximas";
};
