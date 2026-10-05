// Formulário de novo cliente (migrado do Notion "Contratos a realizar") e
// checklist de onboarding. Partilhado pela página pública do formulário e pela
// vista "Novos clientes".

export type OnboardingFormType = "ti_rs" | "ti_co" | "empresa";

export const FORM_TYPES: { id: OnboardingFormType; label: string; tipoContabilidade: string }[] = [
  { id: "ti_rs", label: "TI Regime Simplificado", tipoContabilidade: "TI RS" },
  { id: "ti_co", label: "TI Contabilidade Organizada", tipoContabilidade: "TI CO" },
  { id: "empresa", label: "Empresa", tipoContabilidade: "SQ" },
];

export const formTypeLabel = (id: string) => FORM_TYPES.find((t) => t.id === id)?.label || id;

/** Cores por tipo de contabilidade (SQ azul, TI CO âmbar, TI RS verde). */
export const formTypeClass = (id: string) => {
  switch (id) {
    case "empresa": return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    case "ti_co": return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    default: return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
};

export type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  kind: "text" | "email" | "textarea" | "yesno";
  required?: boolean;
  /** Senhas: guardadas à parte, só o admin as vê. */
  secret?: boolean;
  types: OnboardingFormType[];
  showIf?: (answers: Record<string, string>) => boolean;
};

const ALL: OnboardingFormType[] = ["ti_rs", "ti_co", "empresa"];
const TI: OnboardingFormType[] = ["ti_rs", "ti_co"];

export const FORM_FIELDS: FieldDef[] = [
  { key: "nome", label: "Nome completo", kind: "text", required: true, types: TI },
  { key: "nome", label: "Nome da empresa", kind: "text", required: true, types: ["empresa"] },
  { key: "morada", label: "Morada completa", kind: "textarea", required: true, types: ALL },
  { key: "email", label: "E-mail", kind: "email", required: true, types: TI },
  { key: "email", label: "E-mail de contacto", kind: "email", required: true, types: ["empresa"] },
  { key: "cartao_cidadao", label: "Cartão de Cidadão", hint: "Números e letras", kind: "text", required: true, types: TI },
  { key: "nif", label: "NIF", kind: "text", required: true, types: TI },
  { key: "senha_at", label: "Senha das Finanças", kind: "text", required: true, secret: true, types: TI },
  { key: "niss", label: "NISS", hint: "Número de Identificação da Segurança Social", kind: "text", required: true, types: TI },
  { key: "senha_ss", label: "Senha da Segurança Social", kind: "text", required: true, secret: true, types: TI },
  { key: "nif", label: "NIPC", hint: "NIF da empresa", kind: "text", required: true, types: ["empresa"] },
  { key: "capital_social", label: "Capital social", kind: "text", required: true, types: ["empresa"] },
  {
    key: "ja_tinha_contabilista", label: "Já tinha contabilista?",
    hint: "No caso de estar enquadrado na contabilidade organizada antes",
    kind: "yesno", required: true, types: ["ti_co", "empresa"],
  },
  {
    key: "email_contabilista", label: "E-mail do contabilista anterior", kind: "email", required: true,
    types: ["ti_co", "empresa"], showIf: (a) => a.ja_tinha_contabilista === "sim",
  },
  { key: "usa_programa", label: "Utilizas programa de faturação?", kind: "yesno", required: true, types: ALL },
  {
    key: "programa", label: "Nome do programa de faturação", kind: "text", required: true, types: ALL,
    showIf: (a) => a.usa_programa === "sim",
  },
  {
    key: "utilizador_faturacao", label: "Utilizador do programa", kind: "text", secret: true, types: ALL,
    showIf: (a) => a.usa_programa === "sim",
  },
  {
    key: "senha_faturacao", label: "Senha do programa", kind: "text", secret: true, types: ALL,
    showIf: (a) => a.usa_programa === "sim",
  },
  { key: "informacoes", label: "Informações relevantes", kind: "textarea", types: ALL },
];

export const fieldsFor = (type: string, answers: Record<string, string>) =>
  FORM_FIELDS.filter((f) => f.types.includes(type as OnboardingFormType) && (!f.showIf || f.showIf(answers)));

export const answerLabel = (field: FieldDef, value: string | undefined) => {
  if (!value) return "—";
  if (field.kind === "yesno") return value === "sim" ? "Sim" : "Não";
  return value;
};

export const CHECKLIST: { key: ChecklistKey; label: string; hint: string; types?: OnboardingFormType[] }[] = [
  { key: "pasta_drive", label: "Pasta Drive", hint: "Pasta do cliente criada no Google Drive" },
  { key: "contrato", label: "Contrato", hint: "Elaborado, assinado com Autenticação Gov e devolvido pelo cliente" },
  { key: "fatura", label: "Fatura", hint: "Fatura da 1ª mensalidade emitida no TOConline" },
  { key: "pagamento", label: "Pagamento", hint: "Comprovativo da 1ª mensalidade recebido" },
  {
    key: "email_anterior_contabilista", label: "E-mail ao anterior contabilista", hint: "Pedido de passagem de pasta",
    types: ["ti_co", "empresa"],
  },
  { key: "grupo", label: "Grupo WhatsApp", hint: "Contabilidade + primeiro e último nome, com a Jéssica" },
  { key: "avenca", label: "Avença TOConline", hint: "Criada no TOConline (envio de fatura dia 5)" },
  { key: "onboarding", label: "Sessão de onboarding", hint: "Agendada com o cliente" },
  { key: "resumo_sessao", label: "Resumo da sessão", hint: "Resumo da sessão de onboarding enviado ao cliente", types: ["ti_rs"] },
];

export type ChecklistKey =
  | "pasta_drive" | "contrato" | "pagamento" | "fatura" | "grupo" | "avenca" | "onboarding" | "resumo_sessao"
  | "email_anterior_contabilista";

// Ordem própria da checklist por tipo (os restantes seguem a ordem de CHECKLIST)
const CHECKLIST_ORDER: Partial<Record<OnboardingFormType, ChecklistKey[]>> = {
  ti_rs: ["pasta_drive", "contrato", "fatura", "avenca", "pagamento", "grupo", "onboarding", "resumo_sessao"],
  ti_co: ["email_anterior_contabilista", "pasta_drive", "contrato", "fatura", "avenca", "pagamento", "grupo", "onboarding"],
  empresa: ["email_anterior_contabilista", "pasta_drive", "contrato", "fatura", "avenca", "pagamento", "grupo", "onboarding"],
};

export const checklistFor = (type: string) => {
  const items = CHECKLIST.filter((c) => !c.types || c.types.includes(type as OnboardingFormType));
  const order = CHECKLIST_ORDER[type as OnboardingFormType];
  return order ? order.map((k) => items.find((c) => c.key === k)!).filter(Boolean) : items;
};

export const formLink = (token: string) => `${window.location.origin}/formulario/${token}`;

export const formMessage = (name: string, token: string) => {
  const first = name.trim().split(/\s+/)[0] || "";
  return (
    `Olá${first ? ` ${first}` : ""}, espero que estejas bem! 😊\n\n` +
    "Desde já obrigada pelo voto de confiança! Para darmos início ao serviço mensal, precisamos de algumas " +
    "informações para elaborar o contrato e verificar todo o enquadramento do teu negócio.\n\n" +
    `Podes preencher o formulário aqui: ${formLink(token)}\n\n` +
    "Qualquer dúvida, estamos ao dispor!"
  );
};
