/** Visto mensal do SAF-T: o cliente não emitiu faturas no mês (comunica-se a inexistência no e-Fatura). */
export const SAFT_SEM_FATURACAO = "SAFT_sem_faturacao";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const isToconline = (p: string) => p.replace(/\s/g, "") === "toconline";
const isPortalAT = (p: string) => ["at", "portal das financas", "financas", "portal financas"].includes(p);

/**
 * Verdadeiro quando o cliente fatura só no TOConline (sozinho ou com o Portal das Finanças/AT):
 * as vendas já estão no TOConline, não há SAF-T para importar.
 * Ex.: «TOConline», «TOConline | PORTAL DAS FINANÇAS», «TOConline e AT» → true;
 * «TOConline/ZAPPY», «TOConline + Doc.pt | FALAR DIOGO» → false.
 */
export const faturaSoNoToconline = (programa: string | null | undefined): boolean => {
  if (!programa) return false;
  const partes = norm(programa)
    .split(/\s*(?:\||\/|\+|,|;|&| e )\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!partes.some(isToconline)) return false;
  return partes.every((p) => isToconline(p) || isPortalAT(p));
};
