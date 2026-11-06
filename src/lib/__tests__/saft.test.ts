import { describe, it, expect } from "vitest";
import { faturaSoNoToconline, SAFT_SEM_FATURACAO } from "@/lib/saft";

describe("faturaSoNoToconline", () => {
  it.each(["TOConline", " toconline ", "TOC Online", "TOConline | PORTAL DAS FINANÇAS", "TOConline e AT"])(
    "só TOConline: %s",
    (v) => expect(faturaSoNoToconline(v)).toBe(true),
  );

  it.each(["TOConline/ZAPPY", "TOConline + Doc.pt | FALAR DIOGO", "MOLONI", "PORTAL DAS FINANÇAS", ""])(
    "não é só TOConline: %s",
    (v) => expect(faturaSoNoToconline(v)).toBe(false),
  );

  it("null / undefined", () => {
    expect(faturaSoNoToconline(null)).toBe(false);
    expect(faturaSoNoToconline(undefined)).toBe(false);
  });

  it("tipo de obrigação", () => expect(SAFT_SEM_FATURACAO).toBe("SAFT_sem_faturacao"));
});
