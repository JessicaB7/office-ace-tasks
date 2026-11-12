/** Vistas que saíram da barra lateral e para onde passam (ligações antigas: ?view=…, notificações, emails). */
export const VISTAS_REDIRECIONADAS: Record<string, { view: string; tab?: string }> = {
  /** «Resumo Mensal» foi integrado na página «Negócio». */
  resumo: { view: "business" },
  /** «Painel de consultorias» é agora o separador «Consultorias» da página «Comercial». */
  consultorias_painel: { view: "comercial", tab: "consultorias" },
};

/** Vista final (e separador, se houver) para uma vista pedida. */
export function resolverVista(view: string, tab?: string | null): { view: string; tab: string | null } {
  const r = VISTAS_REDIRECIONADAS[view];
  if (r) return { view: r.view, tab: r.tab ?? tab ?? null };
  return { view, tab: tab ?? null };
}
