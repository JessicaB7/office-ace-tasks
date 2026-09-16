/** Configuração dos 4 regimes de "Contabilidades" — partilhada entre a vista de
 * detalhe (ContabilidadesView) e qualquer sítio que precise de calcular
 * progresso/pendências sem abrir cada separador (ex.: barra lateral). */

export interface TabConfig {
  label: string;
  filter: (c: any) => boolean;
  hasIvaTabs?: boolean;
  hideNif?: boolean;
  columns?: string[];
  subFilters?: { value: string; label: string; match: (c: any) => boolean }[];
}

export const SUB_PAGE_CONFIG: Record<string, TabConfig> = {
  TI_isento: {
    label: "TI Simplificado - Isento IVA",
    filter: (c) => c.tipo_contabilidade === "TI RS" && (c.iva === "Art.53º" || c.iva === "Art. 9º"),
  },
  TI_iva: {
    label: "TI Simplificado - Reg. IVA",
    filter: (c) => c.tipo_contabilidade === "TI RS" && c.iva !== "Art.53º" && c.iva !== "Art. 9º" && c.iva !== "" && c.iva != null,
    hasIvaTabs: true,
    hideNif: true,
    columns: ["Vendas", "Compras", "E-Fatura"],
    subFilters: [
      { value: "Mensal", label: "Mensal", match: (c) => c.iva === "Mensal" },
      { value: "Trimestral", label: "Trimestral", match: (c) => c.iva === "Trimestral" },
    ],
  },
  organizada: {
    label: "TI Contabilidade Organizada",
    filter: (c) => c.tipo_contabilidade === "TI CO",
    hasIvaTabs: true,
    hideNif: true,
    columns: ["Vendas", "Compras", "Bancos", "E-Fatura", "Análise"],
    subFilters: [
      { value: "Isento", label: "Isento", match: (c) => c.iva === "Art.53º" || c.iva === "Art. 9º" },
      { value: "Trimestral", label: "Trimestral", match: (c) => c.iva === "Trimestral" },
    ],
  },
  empresas: {
    label: "Empresas",
    filter: (c) => c.tipo_contabilidade === "SQ",
    hideNif: true,
  },
};

/** Chaves dos tipos de obrigação mensal para um dado regime (as mesmas usadas em
 * `monthly_obligations.obligation_type`), replicando a lógica de ContabilidadesView. */
export const obligationTypesFor = (key: string, config: TabConfig): string[] => {
  if (config.columns && config.columns.length > 0) {
    return config.columns.map((col) => `contabilidade_${key}_${col.toLowerCase().replace(/[- ]/g, "_")}`);
  }
  return [`contabilidade_${key}`];
};
