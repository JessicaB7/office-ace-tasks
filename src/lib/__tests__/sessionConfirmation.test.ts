import { describe, expect, it } from "vitest";
import { confirmationState, needsConfirmation, isAdministrativeRole } from "../sessionConfirmation";

const lead = (meeting_date: string | null, confirmation_date: string | null, meeting_confirmed = false) =>
  ({ meeting_date, confirmation_date, meeting_confirmed });

describe("confirmationState", () => {
  const today = "2026-11-04";
  it("confirmada tem prioridade", () => {
    expect(confirmationState(lead("2026-11-05", "2026-11-04", true), today)).toBe("confirmada");
  });
  it("dia da confirmação", () => {
    expect(confirmationState(lead("2026-11-05", "2026-11-04"), today)).toBe("hoje");
  });
  it("em atraso enquanto a sessão não passou", () => {
    expect(confirmationState(lead("2026-11-04", "2026-11-03"), today)).toBe("atrasada");
  });
  it("sessão já passada sem confirmação não conta", () => {
    expect(confirmationState(lead("2026-11-03", "2026-11-02"), today)).toBe("sem_sessao");
  });
  it("ainda por chegar", () => {
    expect(confirmationState(lead("2026-11-12", "2026-11-11"), today)).toBe("agendada");
  });
  it("sem sessão", () => {
    expect(confirmationState(lead(null, null), today)).toBe("sem_sessao");
  });
  it("needsConfirmation só hoje e em atraso", () => {
    expect(needsConfirmation(lead("2026-11-05", "2026-11-04"), today)).toBe(true);
    expect(needsConfirmation(lead("2026-11-12", "2026-11-11"), today)).toBe(false);
  });
});

describe("isAdministrativeRole", () => {
  it("reconhece o cargo administrativo", () => {
    expect(isAdministrativeRole("Assistente Administrativa")).toBe(true);
    expect(isAdministrativeRole("Administrativo")).toBe(true);
    expect(isAdministrativeRole("Técnica de Contabilidade")).toBe(false);
    expect(isAdministrativeRole(null)).toBe(false);
  });
});
