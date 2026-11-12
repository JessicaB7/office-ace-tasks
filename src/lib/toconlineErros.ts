/** Painel de erros das automações TOConline — regras puras. */

export const ESTADOS_COM_ERRO = ["erro", "bloqueada"] as const;

/** Motivo normalizado para agrupar erros repetidos (sem datas/números variáveis nem espaços a mais). */
export const motivoNormalizado = (notes: string | null | undefined): string =>
  (notes || "Sem motivo indicado")
    .replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export interface GrupoErro<T> {
  motivo: string;
  procedureId: string;
  jobs: T[];
}

/** Agrupa tarefas com o mesmo procedimento e o mesmo motivo; grupos maiores primeiro. */
export function agruparErros<T extends { procedure_id: string; result_notes: string | null }>(jobs: T[]): GrupoErro<T>[] {
  const map = new Map<string, GrupoErro<T>>();
  for (const j of jobs) {
    const k = `${j.procedure_id}|${motivoNormalizado(j.result_notes)}`;
    if (!map.has(k)) map.set(k, { motivo: (j.result_notes || "Sem motivo indicado").trim(), procedureId: j.procedure_id, jobs: [] });
    map.get(k)!.jobs.push(j);
  }
  return [...map.values()].sort((a, b) => b.jobs.length - a.jobs.length || a.motivo.localeCompare(b.motivo, "pt"));
}
