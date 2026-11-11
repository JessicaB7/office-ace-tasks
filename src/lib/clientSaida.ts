// Saída de clientes (client_offboardings) e acompanhamento dos novos clientes — regras puras.

export const MOTIVOS_SAIDA = [
  { value: "preco", label: "Preço" },
  { value: "servico", label: "Serviço" },
  { value: "mudou_contabilista", label: "Mudou de contabilista" },
  { value: "fechou_atividade", label: "Fechou atividade" },
  { value: "empresa_outro_escritorio", label: "Passou a empresa noutro escritório" },
  { value: "outro", label: "Outro" },
] as const;

export const motivoLabel = (v: string | null | undefined) =>
  MOTIVOS_SAIDA.find((m) => m.value === v)?.label ?? "Sem motivo";

export const SAIDA_CHECKLIST = [
  { key: "confirmacao_escrita", label: "Saída confirmada por escrito ao cliente", hint: "Com o último mês e as entregas finais" },
  { key: "avencas_regularizadas", label: "Avenças em dívida verificadas / regularizadas", hint: "" },
  { key: "ultimas_declaracoes", label: "Últimas declarações entregues", hint: "IVA, DMR, SS, SAF-T do último mês" },
  { key: "documentos_enviados", label: "Documentos e acessos enviados ao novo contabilista", hint: "" },
  { key: "renuncia_cc", label: "Renúncia de contabilista certificado submetida na AT", hint: "" },
  { key: "toconline_desativado", label: "Cliente desativado no TOConline", hint: "" },
  { key: "crmcontab_desativado", label: "Cliente desativado no CRMContab", hint: "" },
  { key: "drive_arquivada", label: "Pasta do Drive arquivada", hint: "" },
  { key: "motivo_registado", label: "Motivo de saída registado", hint: "" },
] as const;

export type SaidaChecklistKey = (typeof SAIDA_CHECKLIST)[number]["key"];

export interface Offboarding {
  id: string;
  client_id: string;
  responsavel_id: string | null;
  data_aviso: string | null;
  ultimo_mes_responsabilidade: string | null;
  motivo_saida: string | null;
  motivo_detalhe: string | null;
  notas: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export const saidaProgresso = (o: Record<string, unknown>) =>
  SAIDA_CHECKLIST.filter((c) => o[c.key] === true).length;

/** "YYYY-MM" de uma data/mês ("2026-10-01" → "2026-10"). */
const ym = (s: string) => s.slice(0, 7);

/**
 * O cliente tem obrigações no mês? Só se estiver ativo (ativo ou a sair) e o mês não for
 * posterior ao último mês de que o escritório trata.
 * `month` aceita "YYYY-MM" ou "YYYY-MM-DD".
 */
export function ativoNoMes(
  client: { active?: boolean | null; ultimo_mes_responsabilidade?: string | null },
  month: string,
): boolean {
  if (!client.active) return false;
  const ultimo = client.ultimo_mes_responsabilidade;
  return !ultimo || ym(month) <= ym(ultimo);
}

/** Mês (0–11) + ano → "YYYY-MM". */
export const monthOf = (year: number, month0: number) => `${year}-${String(month0 + 1).padStart(2, "0")}`;

/** Saídas concluídas nos últimos 12 meses, contadas por motivo (ordenado do maior para o menor). */
export function saidasPorMotivo(offboardings: Offboarding[], today = new Date()) {
  const desde = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  offboardings
    .filter((o) => o.completed_at && o.completed_at.slice(0, 10) >= desde)
    .forEach((o) => {
      const k = o.motivo_saida || "sem_motivo";
      counts.set(k, (counts.get(k) || 0) + 1);
    });
  return [...counts.entries()]
    .map(([motivo, n]) => ({ motivo, label: motivo === "sem_motivo" ? "Sem motivo" : motivoLabel(motivo), n }))
    .sort((a, b) => b.n - a.n);
}

export const ACOMPANHAMENTO = [
  { key: "boas_vindas_responsavel", label: "Boas-vindas", dias: 2 },
  { key: "contacto_30_dias", label: "Contacto 30 dias", dias: 30 },
  { key: "contacto_60_dias", label: "Ponto de situação 60 dias", dias: 60 },
] as const;
