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
    columns: ["Vendas", "Compras", "Salários", "E-Fatura", "IVA"],
  },
  organizada: {
    label: "TI Contabilidade Organizada",
    filter: (c) => c.tipo_contabilidade === "TI CO",
    hideNif: true,
    gallery: true,
    columns: ["Vendas", "Compras", "Bancos", "Salários", "Depreciações", "E-Fatura", "IVA"],
  },
  empresas: {
    label: "Empresas",
    filter: (c) => c.tipo_contabilidade === "SQ",
    hideNif: true,
    gallery: true,
    columns: ["Vendas", "Compras", "Bancos", "Salários", "Depreciações", "IVA"],
  },
};

/** Primeiro mês com a tarefa "Depreciações" (começa no ano novo) — os meses
 * anteriores fecham-se sem ela e não aparecem como por concluir. */
export const DEPRECIACOES_FROM = "2027-01-01";

/** Chaves dos tipos de obrigação mensal para um dado regime (as mesmas usadas em
 * `monthly_obligations.obligation_type`), replicando a lógica de ContabilidadesView. */
export const obligationTypesFor = (key: string, config: TabConfig): string[] => {
  if (config.columns && config.columns.length > 0) {
    return config.columns.map((col) => `contabilidade_${key}_${col.toLowerCase().replace(/[- ]/g, "_")}`);
  }
  return [`contabilidade_${key}`];
};

/** Último mês de um trimestre (Mar/Jun/Set/Dez), com o mês em "YYYY-MM-01". */
export const isQuarterEndMonth = (month: string): boolean => Number(month.slice(5, 7)) % 3 === 0;

/** Uma coluna pode não se aplicar a um cliente específico, apesar de existir
 * no regime:
 * - "Salários" quando a ficha tem `salarios === "Não tem"`;
 * - "Depreciações" nos meses anteriores a DEPRECIACOES_FROM, quando a ficha diz
 *   que o cliente não tem ativos (`ativos === false`) ou antes do mês de
 *   `ativos_desde` (sem resposta, assume-se que tem);
 * - "IVA" quando o cliente é isento; no IVA trimestral só existe no último mês
 *   do trimestre (apuramento), no mensal existe todos os meses.
 * Nesse caso a coluna conta sempre como satisfeita. `month` ("YYYY-MM-01") é
 * preciso para o IVA trimestral; sem ele assume-se que se aplica. */
export const isColumnApplicable = (client: any, column: string, month?: string): boolean => {
  if (column === "Salários" && client?.salarios === "Não tem") return false;
  if (column === "Depreciações") {
    if (client?.ativos === false) return false;
    return !month || (month >= DEPRECIACOES_FROM && month >= ativosFromMonth(client));
  }
  if (column === "IVA") {
    if (client?.iva === "Mensal") return true;
    if (client?.iva === "Trimestral") return month ? isQuarterEndMonth(month) : true;
    return false;
  }
  return true;
};

/** Mês ("YYYY-MM-01") a partir do qual o cliente tem ativos; "" sem data. */
const ativosFromMonth = (client: any): string =>
  client?.ativos === true && client?.ativos_desde ? `${String(client.ativos_desde).slice(0, 7)}-01` : "";

/** A coluna existe para o cliente mas não neste mês (IVA trimestral fora do fim
 * do trimestre; Depreciações antes de começar) — mostra-se vazia em vez de "Não aplicável". */
export const isColumnOffMonth = (client: any, column: string, month: string): boolean =>
  (column === "IVA" && client?.iva === "Trimestral" && !isQuarterEndMonth(month)) ||
  (column === "Depreciações" && client?.ativos !== false && (month < DEPRECIACOES_FROM || month < ativosFromMonth(client)));

/** Nome da tarefa para o cliente: no IVA trimestral é o apuramento do trimestre. */
export const columnLabel = (client: any, column: string): string =>
  column === "IVA" && client?.iva === "Trimestral" ? "Apuramento IVA" : column;

/** Uma obrigação está satisfeita se estiver concluída, OU se a coluna nem
 * se aplicar a este cliente (ver isColumnApplicable). */
export const isObligationSatisfied = (client: any, column: string, status: string | null | undefined, month?: string): boolean => {
  if (!isColumnApplicable(client, column, month)) return true;
  return status === "concluida";
};

/** Tipo de obrigação da tarefa IVA da Gestão Mensal para este cliente (conforme o
 * regime), ou null se o regime do cliente não tiver IVA. Partilhado com a coluna
 * "Apuramento" do IVA Periódica, para as duas ficarem ligadas ao mesmo registo. */
export const ivaObligationTypeFor = (client: any): string | null => {
  for (const key of ["TI_iva", "organizada", "empresas"]) {
    const cfg = SUB_PAGE_CONFIG[key];
    const idx = cfg.columns?.indexOf("IVA") ?? -1;
    if (idx >= 0 && cfg.filter(client)) return obligationTypesFor(key, cfg)[idx];
  }
  return null;
};
