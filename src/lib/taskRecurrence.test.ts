import { describe, expect, it } from "vitest";
import {
  defaultRepeat,
  describeRecurrence,
  firstOccurrence,
  lastBusinessDay,
  nextOccurrence,
  occurrenceDate,
  repeatToRule,
  type RecurrenceRule,
} from "./taskRecurrence";

const rule = (r: Partial<RecurrenceRule>): RecurrenceRule => ({
  frequency: "mensal",
  interval: 1,
  day_mode: "dia",
  day_of_month: null,
  weekday: null,
  start_date: "2026-01-31",
  end_date: null,
  ...r,
});

describe("mensal", () => {
  it("dia 31 ajusta ao fim do mês e volta a 31", () => {
    const r = rule({ day_of_month: 31 });
    expect([0, 1, 2, 3].map((i) => occurrenceDate(r, i))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(nextOccurrence(r, "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence(r, "2026-02-28")).toBe("2026-03-31");
  });

  it("ano bissexto", () => {
    expect(occurrenceDate(rule({ day_of_month: 30, start_date: "2028-01-30" }), 1)).toBe("2028-02-29");
  });

  it("primeira ocorrência nunca antes da data de referência", () => {
    const r = rule({ day_of_month: 20, start_date: "2026-11-25" });
    expect(firstOccurrence(r)).toBe("2026-12-20");
    expect(firstOccurrence(rule({ day_of_month: 20, start_date: "2026-11-20" }))).toBe("2026-11-20");
  });

  it("intervalo de 2 meses", () => {
    const r = rule({ day_of_month: 10, start_date: "2026-01-10", interval: 2 });
    expect(nextOccurrence(r, "2026-01-10")).toBe("2026-03-10");
    expect(nextOccurrence(r, "2026-06-01")).toBe("2026-07-10");
  });

  it("último dia útil salta fins de semana", () => {
    expect(lastBusinessDay(2026, 1)).toBe(30); // 31/01/2026 é sábado
    expect(lastBusinessDay(2026, 5)).toBe(29); // 31/05/2026 é domingo
    expect(lastBusinessDay(2026, 3)).toBe(31);
    const r = rule({ day_mode: "ultimo_dia_util", start_date: "2026-01-01" });
    expect(firstOccurrence(r)).toBe("2026-01-30");
    expect(nextOccurrence(r, "2026-01-30")).toBe("2026-02-27");
  });

  it("último dia do mês", () => {
    const r = rule({ day_mode: "ultimo_dia", start_date: "2026-02-01" });
    expect(nextOccurrence(r, "2026-02-28")).toBe("2026-03-31");
  });

  it("data de fim termina a série", () => {
    const r = rule({ day_of_month: 15, start_date: "2026-01-15", end_date: "2026-03-01" });
    expect(nextOccurrence(r, "2026-01-15")).toBe("2026-02-15");
    expect(nextOccurrence(r, "2026-02-15")).toBeNull();
  });
});

describe("trimestral e anual", () => {
  it("trimestral a partir de janeiro", () => {
    const r = rule({ frequency: "trimestral", day_of_month: 31, start_date: "2026-01-31" });
    expect(nextOccurrence(r, "2026-01-31")).toBe("2026-04-30");
    expect(nextOccurrence(r, "2026-05-01")).toBe("2026-07-31");
  });

  it("anual com 29/02", () => {
    const r = rule({ frequency: "anual", day_of_month: 29, start_date: "2028-02-29" });
    expect(nextOccurrence(r, "2028-02-29")).toBe("2029-02-28");
    expect(nextOccurrence(r, "2031-03-01")).toBe("2032-02-29");
  });
});

describe("semanal", () => {
  it("alinha ao dia da semana e salta N semanas", () => {
    // 12/11/2026 é quinta-feira
    const r = rule({ frequency: "semanal", weekday: 1, start_date: "2026-11-12" });
    expect(firstOccurrence(r)).toBe("2026-11-16");
    expect(nextOccurrence(r, "2026-11-16")).toBe("2026-11-23");
    const r2 = { ...r, interval: 2 };
    expect(nextOccurrence(r2, "2026-11-16")).toBe("2026-11-30");
    expect(nextOccurrence(r2, "2026-12-01", true)).toBe("2026-12-14");
  });
});

describe("describeRecurrence", () => {
  it("textos em pt-PT", () => {
    expect(describeRecurrence(rule({ day_of_month: 20 }))).toBe("Mensal · dia 20");
    expect(describeRecurrence(rule({ interval: 2, day_mode: "ultimo_dia_util" }))).toBe("A cada 2 meses · último dia útil");
    expect(describeRecurrence(rule({ frequency: "semanal", weekday: 5 }))).toBe("Semanal · sexta-feira");
    expect(describeRecurrence(rule({ frequency: "trimestral", day_mode: "ultimo_dia", start_date: "2026-03-01" }))).toBe(
      "Trimestral · último dia do mês (mar/jun/set/dez)",
    );
    expect(describeRecurrence(rule({ frequency: "anual", day_of_month: 31, start_date: "2026-03-31" }))).toBe("Anual · dia 31 de março");
  });
});

describe("formulário Repetir", () => {
  it("defaults a partir do prazo e conversão para regra", () => {
    const f = defaultRepeat("2026-11-20", "mensal");
    expect(f).toMatchObject({ day_of_month: 20, weekday: 5, interval: 1, day_mode: "dia" });
    expect(repeatToRule(defaultRepeat("2026-11-20"), "2026-11-20")).toBeNull();
    expect(repeatToRule({ ...f, frequency: "semanal" }, "2026-11-20")).toMatchObject({ weekday: 5, day_of_month: null, day_mode: "dia" });
    expect(repeatToRule({ ...f, day_mode: "ultimo_dia_util", end_date: "" }, "2026-11-20")).toMatchObject({ day_of_month: null, end_date: null });
  });
});
