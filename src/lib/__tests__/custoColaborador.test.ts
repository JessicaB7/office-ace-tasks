import { describe, expect, test } from "vitest";
import { custoMensal, lucroPorColaborador, totalLucro } from "../custoColaborador";

describe("custoMensal", () => {
  test("bruto × 1,25 + subsídio de alimentação", () => {
    expect(custoMensal({ salario_bruto: 1200, subsidio_alimentacao: 200 })).toBeCloseTo(1200 * 1.25 + 200, 6);
  });
  test("sem dados → 0", () => {
    expect(custoMensal(null)).toBe(0);
    expect(custoMensal({ salario_bruto: -5 })).toBe(0);
  });
});

describe("lucroPorColaborador", () => {
  const avencas = [
    { key: "a", clientes: [1, 2, 3], valor: 3000 },
    { key: "none", clientes: [1], valor: 100 },
  ];
  const custos = new Map([["a", { salario_bruto: 1000 }], ["b", { salario_bruto: 900, subsidio_alimentacao: 150 }]]);
  const linhas = lucroPorColaborador(avencas, custos, ["a", "b"]);

  test("lucro = avenças − custo; colaborador sem clientes fica negativo", () => {
    const a = linhas.find((l) => l.key === "a")!;
    expect(a.custo).toBeCloseTo(1250, 6);
    expect(a.lucro).toBeCloseTo(3000 - a.custo, 6);
    expect(a.margem).toBeCloseTo(a.lucro / 3000, 6);
    const b = linhas.find((l) => l.key === "b")!;
    expect(b.clientes).toBe(0);
    expect(b.lucro).toBeLessThan(0);
    expect(b.margem).toBeNull();
  });

  test("sem responsável não tem custo; total bate com a soma", () => {
    const none = linhas.find((l) => l.key === "none")!;
    expect(none.custo).toBe(0);
    expect(none.semCusto).toBe(true);
    const t = totalLucro(linhas);
    expect(t.avencas).toBe(3100);
    expect(t.lucro).toBeCloseTo(3100 - linhas.reduce((s, l) => s + l.custo, 0), 6);
  });
});
