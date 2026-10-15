import { describe, it, expect } from "vitest";
import { shouldShowDailyReminder, dueGroup } from "./dailyReminder";

describe("dailyReminder", () => {
  it("só a partir das 9h e uma vez por dia", () => {
    expect(shouldShowDailyReminder(new Date(2026, 9, 16, 8, 59), null)).toBe(false);
    expect(shouldShowDailyReminder(new Date(2026, 9, 16, 9, 0), null)).toBe(true);
    expect(shouldShowDailyReminder(new Date(2026, 9, 16, 14, 0), "2026-10-15")).toBe(true);
    expect(shouldShowDailyReminder(new Date(2026, 9, 16, 14, 0), "2026-10-16")).toBe(false);
  });

  it("agrupa por data limite", () => {
    const now = new Date(2026, 9, 16, 9, 0);
    expect(dueGroup("2026-10-15", now)).toBe("atrasadas");
    expect(dueGroup("2026-10-16", now)).toBe("hoje");
    expect(dueGroup("2026-10-20", now)).toBe("proximas");
  });
});
