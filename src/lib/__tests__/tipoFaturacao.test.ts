import { describe, it, expect } from "vitest";
import { tipoFaturacao } from "@/lib/toconlineProcedures";

describe("tipoFaturacao", () => {
  it.each([
    "PORTAL DAS FINANÇAS", "Portal das Finanças", "portal das finanças", "Portal  das finanças",
    "AT", "finanças", "AT - PEDE PELO WPP",
  ])("recibos verdes: %s", (v) => expect(tipoFaturacao(v)).toBe("recibos_verdes"));

  it.each([
    "TOCONLINE", "MOLONI", "FIZ - EMAIL Cliente", "WEO INVOICE", "CEGID - app2.business-pt.cegid.cloud",
    "zappy+vendus", "FIZ - ENVIA SAFT POR EMAIL", "JASMIN", "Cegid",
  ])("programa: %s", (v) => expect(tipoFaturacao(v)).toBe("programa"));

  it.each([
    "Vendus + Portal das finanças", "TOC ONLINE | PORTAL DAS FINANÇAS", "FIZ e AT",
    "Vendus e AT; PIN: 2026", "Portal das Finanças /PHC (PEDIR)",
  ])("ambos: %s", (v) => expect(tipoFaturacao(v)).toBe("ambos"));

  it("sem informação", () => {
    expect(tipoFaturacao(null)).toBe("sem_info");
    expect(tipoFaturacao("  ")).toBe("sem_info");
  });
});
