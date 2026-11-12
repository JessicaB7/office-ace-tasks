import { describe, it, expect } from "vitest";
import { resolverVista } from "./vistas";

describe("resolverVista", () => {
  it("redireciona as vistas antigas", () => {
    expect(resolverVista("resumo")).toEqual({ view: "business", tab: null });
    expect(resolverVista("consultorias_painel")).toEqual({ view: "comercial", tab: "consultorias" });
    expect(resolverVista("consultorias_painel", "pipeline")).toEqual({ view: "comercial", tab: "consultorias" });
  });
  it("mantém as outras vistas e o separador pedido", () => {
    expect(resolverVista("comercial", "consultorias")).toEqual({ view: "comercial", tab: "consultorias" });
    expect(resolverVista("controlo")).toEqual({ view: "controlo", tab: null });
  });
});
