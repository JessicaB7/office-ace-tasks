import { describe, expect, test } from "vitest";
import { calcRetencoesIrs } from "../retencoesIrs";

describe("calcRetencoesIrs", () => {
  test("soma os pagamentos por conta fora do TOConline à conta 241", () => {
    const m = new Map([["9:2414", -379.5], ["9:72", 2680.17]]);
    const r = calcRetencoesIrs(m, { ret_241_acum: 0, ppc_pagos_fora_toc: 946 });
    expect(r.conta241).toBe(379.5);
    expect(r.total).toBe(1325.5);
    expect(r.source).toBe("auto");
    expect(r.avisoDuplicado).toBe(false);
  });

  test("sem 241 usa o manual e acrescenta os pagamentos por conta", () => {
    const r = calcRetencoesIrs(new Map(), { irs_retencoes: 100, ppc_pagos_fora_toc: 233 });
    expect(r.source).toBe("manual");
    expect(r.total).toBe(333);
  });

  test("acumulado do balancete prevalece quando é maior", () => {
    const r = calcRetencoesIrs(new Map([["3:2414", 50]]), { ret_241_acum: 400 });
    expect(r.total).toBe(400);
  });

  test("avisa quando o balancete já tem outras subcontas da 241", () => {
    const m = new Map([["7:2411", 473], ["9:2414", 100]]);
    const r = calcRetencoesIrs(m, { ppc_pagos_fora_toc: 473 });
    expect(r.outras241).toBe(473);
    expect(r.avisoDuplicado).toBe(true);
  });

  test("valor negativo nos pagamentos por conta conta como zero", () => {
    expect(calcRetencoesIrs(new Map(), { ppc_pagos_fora_toc: -10 }).total).toBe(0);
  });
});
