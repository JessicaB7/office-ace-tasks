/** «Pedido ao cliente» nas células da Gestão Mensal — regras puras.
 * Uma célula (monthly_obligations) está à espera do cliente quando tem
 * `pedido_cliente_em` e ainda não está concluída. */

export interface PedidoObl {
  status?: string | null;
  pedido_cliente_em?: string | null;
  pedido_cliente_nota?: string | null;
}

/** Dias a partir dos quais o pedido aparece em tom de aviso (mais de 5 dias). */
export const PEDIDO_DIAS_AVISO = 5;

/** "YYYY-MM-DD" → Date ao meio-dia local (evita drift de fuso). */
const parseDia = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

/** Data de hoje no formato "YYYY-MM-DD" (local). */
export const hojeISO = (today: Date = new Date()): string =>
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

export const temPedido = (obl: PedidoObl | null | undefined): boolean =>
  !!obl?.pedido_cliente_em && obl.status !== "concluida";

/** Dias de calendário desde o pedido (0 = pedido hoje; nunca negativo). */
export function diasAEspera(pedidoEm: string, today: Date = new Date()): number {
  const hoje = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const diff = Math.round((hoje.getTime() - parseDia(pedidoEm).getTime()) / 86_400_000);
  return Math.max(0, diff);
}

/** Pedido com mais de 5 dias sem resposta. */
export const pedidoAtrasado = (pedidoEm: string, today: Date = new Date()): boolean =>
  diasAEspera(pedidoEm, today) > PEDIDO_DIAS_AVISO;

/** "2026-11-12" → "12/11". */
export const fmtPedido = (pedidoEm: string): string => {
  const [, m, d] = pedidoEm.slice(0, 10).split("-");
  return `${d}/${m}`;
};

/** Texto da célula: "⏳ pedido 12/11". */
export const pedidoLabel = (pedidoEm: string): string => `⏳ pedido ${fmtPedido(pedidoEm)}`;

/** Conta as células à espera do cliente (e quantas com mais de 5 dias). */
export function contarPedidos(obls: (PedidoObl | null | undefined)[], today: Date = new Date()) {
  let total = 0;
  let atrasados = 0;
  for (const o of obls) {
    if (!temPedido(o)) continue;
    total++;
    if (pedidoAtrasado(o!.pedido_cliente_em!, today)) atrasados++;
  }
  return { total, atrasados };
}
