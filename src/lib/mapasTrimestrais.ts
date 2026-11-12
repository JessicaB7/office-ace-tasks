/** Mapas trimestrais por enviar — regras puras sobre client_financial_settings. */

export type Trimestre = 1 | 2 | 3 | 4;

export const mapaFields = (q: Trimestre) => ({
  enviado: `mapa_q${q}_enviado`,
  enviadoData: `mapa_q${q}_data`,
  relatorio: `relatorio_q${q}_entregue`,
  relatorioData: `relatorio_q${q}_data`,
});

/** Trimestre já terminado mais recente à data `today` (o que se está a enviar). */
export function trimestreAtual(today: Date = new Date()): { year: number; q: Trimestre } {
  const q0 = Math.floor(today.getMonth() / 3); // 0..3 = trimestre em curso
  if (q0 === 0) return { year: today.getFullYear() - 1, q: 4 };
  return { year: today.getFullYear(), q: q0 as Trimestre };
}

/** Último dia do trimestre ("YYYY-MM-DD"). */
export const fimTrimestre = (year: number, q: Trimestre): string => {
  const d = new Date(Date.UTC(year, q * 3, 0));
  return d.toISOString().slice(0, 10);
};

export function contagemMapas(rows: Record<string, any>[], q: Trimestre) {
  const f = mapaFields(q);
  const enviados = rows.filter((r) => r[f.enviado] === true).length;
  const relatorios = rows.filter((r) => r[f.relatorio] === true).length;
  return { total: rows.length, enviados, relatorios, porEnviar: rows.length - enviados };
}
