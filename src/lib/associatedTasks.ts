/** Tarefas associadas ao fecho (apuramento) do IVA na Gestão Mensal / IVA Periódica.
 * Não são criadas sozinhas: a app mostra um pop-up e a utilizadora ativa-as com a data
 * em que conseguir fazê-las. */

/** Tipos de obrigação do apuramento do IVA por regime (ver contabilidadesConfig). */
export const IVA_APURAMENTO_TYPES: Record<string, "TI" | "empresa"> = {
  contabilidade_TI_iva_iva: "TI",
  contabilidade_organizada_iva: "TI",
  contabilidade_empresas_iva: "empresa",
};

export interface AssociatedTaskSuggestion {
  kind: "efatura" | "mapas";
  title: string;
  /** Guardado em tasks.description — identifica a tarefa para não a ativar duas vezes. */
  marker: string;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "3º trimestre 2026" (IVA trimestral) ou "setembro 2026" (mensal). */
export function periodLabel(client: { iva?: string | null }, referenceMonth: string): string {
  const [y, m] = referenceMonth.split("-").map(Number);
  return client.iva === "Trimestral" ? `${Math.floor((m - 1) / 3) + 1}º trimestre ${y}` : `${MESES[m - 1]} ${y}`;
}

export function associatedTasksFor(obligationType: string, client: { iva?: string | null }, referenceMonth: string): AssociatedTaskSuggestion[] {
  const regime = IVA_APURAMENTO_TYPES[obligationType];
  if (!regime) return [];
  const periodo = periodLabel(client, referenceMonth);
  const base = `Associada ao apuramento IVA ${referenceMonth.slice(0, 7)}`;
  const list: AssociatedTaskSuggestion[] = [];
  if (regime === "TI") {
    list.push({ kind: "efatura", title: `Classificação das despesas no e-Fatura (${periodo})`, marker: `${base} · e-Fatura` });
  }
  list.push({ kind: "mapas", title: `Mapas de análise (${periodo})`, marker: `${base} · mapas de análise` });
  return list;
}

// ---- Aviso entre o registo da obrigação e o pop-up (montado no Index) ----

export interface IvaApuradoEvent {
  client_id: string;
  obligation_type: string;
  reference_month: string;
}

const EVENT = "iva-apurado";

export const emitIvaApurado = (detail: IvaApuradoEvent) => window.dispatchEvent(new CustomEvent(EVENT, { detail }));

export const onIvaApurado = (cb: (e: IvaApuradoEvent) => void) => {
  const handler = (e: Event) => cb((e as CustomEvent<IvaApuradoEvent>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
