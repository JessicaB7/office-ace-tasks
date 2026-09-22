/** Configuração dos 4 regimes de "Contabilidades" — partilhada entre a vista de
 * detalhe (ContabilidadesView) e qualquer sítio que precise de calcular
 * progresso/pendências sem abrir cada separador (ex.: barra lateral). */

export interface TabConfig {
  label: string;
  filter: (c: any) => boolean;
  hideNif?: boolean;
  columns?: string[];
  /** Mostra clientes em cartões (galeria) com os dados do cliente à vista,
   * em vez da tabela genérica — usado em TI_iva, organizada e empresas. */
  gallery?: boolean;
}

export const SUB_PAGE_CONFIG: Record<string, TabConfig> = {
  TI_isento: {
    label: "TI Simplificado - Isento IVA",
    filter: (c) => c.tipo_contabilidade === "TI RS" && (c.iva === "Art.53º" || c.iva === "Art. 9º"),
  },
  TI_iva: {
    label: "TI Simplificado - Reg. IVA",
    filter: (c) => c.tipo_contabilidade === "TI RS" && c.iva !== "Art.53º" && c.iva !== "Art. 9º" && c.iva !== "" && c.iva != null,
    hideNif: true,
    gallery: true,
    columns: ["Vendas", "Compras", "E-Fatura", "Salários"],
  },
  organizada: {
    label: "TI Contabilidade Organizada",
    filter: (c) => c.tipo_contabilidade === "TI CO",
    hideNif: true,
    gallery: true,
    columns: ["Vendas", "Compras", "Bancos", "Salários", "E-Fatura", "Análise"],
  },
  empresas: {
    label: "Empresas",
    filter: (c) => c.tipo_contabilidade === "SQ",
    hideNif: true,
    gallery: true,
    columns: ["Vendas", "Compras", "Bancos", "Salários", "Balancete"],
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

/** Uma coluna pode não se aplicar a um cliente específico, apesar de existir
 * no regime — ex.: "Salários" quando o próprio cliente tem `salarios ===
 * "Não tem"` na ficha (não há folha de vencimentos a processar, não faz
 * sentido pedir para marcar/desmarcar). Nesse caso a coluna conta sempre
 * como satisfeita e mostra "Não aplicável" em vez de um estado editável. */
export const isColumnApplicable = (client: any, column: string): boolean => {
  if (column === "Salários" && client?.salarios === "Não tem") return false;
  return true;
};

/** Uma obrigação está satisfeita se estiver concluída, OU se a coluna nem
 * se aplicar a este cliente (ver isColumnApplicable). */
export const isObligationSatisfied = (client: any, column: string, status: string | null | undefined): boolean => {
  if (!isColumnApplicable(client, column)) return true;
  return status === "concluida";
};
