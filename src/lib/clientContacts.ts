/** Histórico de contactos por cliente (client_contacts) — tipos, rótulos e regras puras.
 * (Copiado tal e qual para supabase/functions/_shared/lib/ — ver sharedLib.test.ts.) */

export const CONTACT_TIPOS = [
  { value: "email", label: "Email" },
  { value: "chamada", label: "Chamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reuniao", label: "Reunião" },
  { value: "pedido_documentos", label: "Pedido de documentos" },
  { value: "outro", label: "Outro" },
] as const;

export type ContactTipo = (typeof CONTACT_TIPOS)[number]["value"];

export interface ClientContact {
  id: string;
  client_id: string;
  collaborator_id: string | null;
  tipo: ContactTipo;
  data: string;
  resumo: string;
  seguimento_em: string | null;
  task_id: string | null;
  created_by: string | null;
  created_at: string;
}

/** Entrada da linha do tempo (RPC client_timeline). */
export interface TimelineEntry {
  origem: "contacto" | "email" | "responsavel" | "nota_obrigacao";
  id: string;
  quando: string;
  tipo: string;
  titulo: string | null;
  resumo: string | null;
  autor: string | null;
  seguimento_em: string | null;
  created_by: string | null;
}

export const contactTipoLabel = (tipo: string): string => {
  const t = CONTACT_TIPOS.find((c) => c.value === tipo);
  if (t) return t.label;
  if (tipo === "email_app") return "Email enviado pela app";
  if (tipo === "responsavel") return "Mudança de responsável";
  if (tipo === "nota_obrigacao") return "Nota de obrigação";
  return tipo;
};

/** Filtro da linha do tempo por tipo e pesquisa (título, resumo e autor). */
export function filtrarTimeline(entries: TimelineEntry[], tipo: string, pesquisa: string): TimelineEntry[] {
  const q = pesquisa.trim().toLowerCase();
  return entries.filter((e) => {
    if (tipo !== "all" && e.tipo !== tipo) return false;
    if (!q) return true;
    return [e.titulo, e.resumo, e.autor, contactTipoLabel(e.tipo)].some((s) => (s || "").toLowerCase().includes(q));
  });
}

/**
 * Pedidos de documentos à espera há mais de `dias` dias: o pedido de documentos mais recente
 * de cada cliente, feito há mais de `dias` dias, sem nenhum contacto posterior registado.
 */
export function pedidosDocumentosPendentes<T extends { client_id: string; tipo: string; data: string; created_at?: string }>(
  contacts: T[],
  today: string,
  dias = 5,
): T[] {
  const limite = new Date(`${today}T12:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - dias);
  const limiteStr = limite.toISOString().slice(0, 10);
  const porCliente = new Map<string, T[]>();
  contacts.forEach((c) => {
    if (!porCliente.has(c.client_id)) porCliente.set(c.client_id, []);
    porCliente.get(c.client_id)!.push(c);
  });
  const out: T[] = [];
  for (const lista of porCliente.values()) {
    const ord = [...lista].sort((a, b) => b.data.localeCompare(a.data) || (b.created_at || "").localeCompare(a.created_at || ""));
    const ultimo = ord[0];
    if (ultimo && ultimo.tipo === "pedido_documentos" && ultimo.data < limiteStr) out.push(ultimo);
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}
