/** Rótulos do registo de alterações (audit_log). */

export const AUDIT_CAMPOS: { value: string; label: string }[] = [
  { value: "registo", label: "Criação / eliminação" },
  { value: "responsavel_id", label: "Responsável" },
  { value: "mensalidade", label: "Mensalidade" },
  { value: "status", label: "Estado" },
  { value: "tipo_contabilidade", label: "Tipo de contabilidade" },
  { value: "senha_at", label: "Senha AT" },
  { value: "senha_ss", label: "Senha SS" },
  { value: "senha_faturacao", label: "Senha faturação" },
  { value: "via_ctt_senha", label: "Senha Via CTT" },
  { value: "chave_ss", label: "Chave SS" },
];

export const auditCampoLabel = (campo: string) => AUDIT_CAMPOS.find((c) => c.value === campo)?.label ?? campo;

const STATUS: Record<string, string> = { ativo: "Ativo", a_sair: "A sair", inativo: "Inativo" };

export const auditValor = (campo: string, valor: string | null): string => {
  if (valor == null || valor === "") return "—";
  if (campo === "status") return STATUS[valor] ?? valor;
  if (campo === "mensalidade") {
    const n = Number(valor);
    return Number.isFinite(n) ? n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : valor;
  }
  return valor;
};

export interface AuditEntry {
  id: string;
  tabela: string;
  registo_id: string | null;
  registo_nome: string | null;
  campo: string;
  valor_antigo: string | null;
  valor_novo: string | null;
  alterado_por: string | null;
  alterado_em: string;
}
