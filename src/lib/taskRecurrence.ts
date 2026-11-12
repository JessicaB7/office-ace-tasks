// Tarefas periódicas: cálculo das datas das ocorrências (TS puro, sem side effects).
// O equivalente em SQL está em public.task_recurrence_occurrence / task_recurrence_next
// (migração 20261112100000_tarefas_periodicas.sql) — manter os dois alinhados.
//
// Regra: a série tem uma data de referência (start_date). As ocorrências são calculadas
// pelo índice a partir dessa data (nunca a partir da anterior), para não "escorregar"
// nos fins de mês (dia 31 → 30/28 e volta a 31 quando o mês o tem).
//  - semanal: start_date alinhada ao dia da semana (1 = segunda … 7 = domingo) + 7·N·i dias;
//  - mensal / trimestral / anual: mês de start_date + i·N·(1|3|12) meses, com o dia
//    escolhido ("dia" X limitado ao fim do mês, "último dia do mês" ou "último dia útil",
//    só fins de semana — a app não tem lista de feriados).

export type RecurrenceFrequency = "semanal" | "mensal" | "trimestral" | "anual";
export type RecurrenceDayMode = "dia" | "ultimo_dia_util" | "ultimo_dia";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  day_mode: RecurrenceDayMode;
  day_of_month: number | null;
  weekday: number | null; // ISO: 1 = segunda … 7 = domingo
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
}

export const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "segunda-feira",
  2: "terça-feira",
  3: "quarta-feira",
  4: "quinta-feira",
  5: "sexta-feira",
  6: "sábado",
  7: "domingo",
};

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const MONTH_STEP: Record<Exclude<RecurrenceFrequency, "semanal">, number> = { mensal: 1, trimestral: 3, anual: 12 };

const DAY_MS = 86_400_000;

const parse = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
};
const toUTC = (iso: string) => {
  const { y, m, d } = parse(iso);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Dia da semana ISO (1 = segunda … 7 = domingo). */
export const isoWeekday = (iso: string) => {
  const dow = new Date(toUTC(iso)).getUTCDay();
  return dow === 0 ? 7 : dow;
};

export const addDays = (iso: string, n: number) => fromUTC(toUTC(iso) + n * DAY_MS);

/** Último dia útil (segunda a sexta) do mês. */
export function lastBusinessDay(y: number, m: number): number {
  let d = daysInMonth(y, m);
  while (isoWeekday(isoDate(y, m, d)) >= 6) d--;
  return d;
}

function dayFor(rule: RecurrenceRule, y: number, m: number): number {
  if (rule.day_mode === "ultimo_dia") return daysInMonth(y, m);
  if (rule.day_mode === "ultimo_dia_util") return lastBusinessDay(y, m);
  const wanted = rule.day_of_month ?? parse(rule.start_date).d;
  return Math.min(Math.max(1, wanted), daysInMonth(y, m));
}

const intervalOf = (rule: RecurrenceRule) => Math.max(1, Math.floor(rule.interval || 1));

/** Primeira data de referência das séries semanais: start_date alinhada ao dia da semana. */
function weeklyBase(rule: RecurrenceRule): string {
  const wd = rule.weekday ?? isoWeekday(rule.start_date);
  const diff = (wd - isoWeekday(rule.start_date) + 7) % 7;
  return addDays(rule.start_date, diff);
}

/** Data da ocorrência de índice i (0 = a do período da data de referência). */
export function occurrenceDate(rule: RecurrenceRule, i: number): string {
  const n = intervalOf(rule);
  if (rule.frequency === "semanal") return addDays(weeklyBase(rule), 7 * n * i);
  const { y, m } = parse(rule.start_date);
  const idx = y * 12 + (m - 1) + i * n * MONTH_STEP[rule.frequency];
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return isoDate(yy, mm, dayFor(rule, yy, mm));
}

/**
 * Próxima ocorrência depois de `after` (ou a partir de, se `inclusive`), nunca antes da
 * data de referência. Devolve null se passar a data de fim da série.
 */
export function nextOccurrence(rule: RecurrenceRule, after: string, inclusive = false): string | null {
  const n = intervalOf(rule);
  let i: number;
  if (rule.frequency === "semanal") {
    const diff = Math.floor((toUTC(after) - toUTC(weeklyBase(rule))) / DAY_MS);
    i = Math.max(0, Math.floor(diff / (7 * n)) - 1);
  } else {
    const s = parse(rule.start_date);
    const a = parse(after);
    const diffMonths = a.y * 12 + a.m - (s.y * 12 + s.m);
    i = Math.max(0, Math.floor(diffMonths / (n * MONTH_STEP[rule.frequency])) - 1);
  }
  let occ = occurrenceDate(rule, i);
  let guard = 0;
  while ((inclusive ? occ < after : occ <= after) || occ < rule.start_date) {
    i++;
    occ = occurrenceDate(rule, i);
    if (++guard > 1000) return null;
  }
  if (rule.end_date && occ > rule.end_date) return null;
  return occ;
}

/** Primeira ocorrência da série (a partir da data de referência, inclusive). */
export const firstOccurrence = (rule: RecurrenceRule) => nextOccurrence(rule, rule.start_date, true);

/** Descrição curta da regra, ex.: "Mensal · dia 20", "A cada 2 meses · último dia útil". */
export function describeRecurrence(rule: Pick<RecurrenceRule, "frequency" | "interval" | "day_mode" | "day_of_month" | "weekday" | "start_date">): string {
  const n = intervalOf(rule as RecurrenceRule);
  const freq =
    n === 1
      ? FREQUENCY_LABELS[rule.frequency]
      : rule.frequency === "semanal"
        ? `A cada ${n} semanas`
        : rule.frequency === "mensal"
          ? `A cada ${n} meses`
          : rule.frequency === "trimestral"
            ? `A cada ${n} trimestres`
            : `A cada ${n} anos`;
  if (rule.frequency === "semanal") {
    const wd = rule.weekday ?? isoWeekday(rule.start_date);
    return `${freq} · ${WEEKDAY_LABELS[wd]}`;
  }
  const dia =
    rule.day_mode === "ultimo_dia"
      ? "último dia do mês"
      : rule.day_mode === "ultimo_dia_util"
        ? "último dia útil"
        : `dia ${rule.day_of_month ?? parse(rule.start_date).d}`;
  if (rule.frequency === "anual") return `${freq} · ${dia} de ${MONTH_NAMES[parse(rule.start_date).m - 1]}`;
  if (rule.frequency === "trimestral" && n === 1) {
    const m0 = (parse(rule.start_date).m - 1) % 3;
    const meses = [0, 1, 2, 3].map((k) => MONTH_NAMES[m0 + k * 3].slice(0, 3)).join("/");
    return `${freq} · ${dia} (${meses})`;
  }
  return `${freq} · ${dia}`;
}

// ---- Formulário «Repetir» (dialog de tarefas) ----

export interface RepeatForm {
  frequency: RecurrenceFrequency | "nao";
  interval: number;
  day_mode: RecurrenceDayMode;
  day_of_month: number;
  weekday: number;
  end_date: string;
}

/** Valores por omissão a partir do prazo da tarefa (dia do mês e dia da semana do prazo). */
export const defaultRepeat = (dueDate: string, frequency: RepeatForm["frequency"] = "nao"): RepeatForm => ({
  frequency,
  interval: 1,
  day_mode: "dia",
  day_of_month: Number(dueDate.slice(8, 10)) || 1,
  weekday: dueDate ? isoWeekday(dueDate) : 1,
  end_date: "",
});

export const repeatToRule = (r: RepeatForm, startDate: string): RecurrenceRule | null =>
  r.frequency === "nao"
    ? null
    : {
        frequency: r.frequency,
        interval: Math.max(1, Math.floor(r.interval || 1)),
        day_mode: r.frequency === "semanal" ? "dia" : r.day_mode,
        day_of_month: r.frequency !== "semanal" && r.day_mode === "dia" ? r.day_of_month : null,
        weekday: r.frequency === "semanal" ? r.weekday : null,
        start_date: startDate,
        end_date: r.end_date || null,
      };
