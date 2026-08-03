import { describe, it, expect } from "vitest";
import fs from "fs";
import { parseBankText } from "@/lib/bankParsers";

describe("revolut tabular", () => {
  it("parses new statement layout", () => {
    const text = fs.readFileSync("/tmp/rev_fixture.txt", "utf8");
    const r = parseBankText(text, null);
    console.log(r.bank, r.saldoInicial, r.saldoFinal);
    console.log(r.transactions.map((t) => [t.dataMov.toISOString().slice(0,10), t.descricao, t.movimento]));
    expect(r.bank).toBe("Revolut");
    expect(r.transactions.length).toBe(4);
  });
});
