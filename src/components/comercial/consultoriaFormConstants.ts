// Formulário de preparação da consultoria (migrado do Notion "Formulário Consultorias - DÚVIDAS").
// Partilhado pela página pública do formulário, pela lead de consultoria e pela ficha do cliente.

export type ConsultoriaFieldDef = {
  key: string;
  label: string;
  kind: "text" | "textarea" | "choice";
  options?: { v: string; l: string }[];
  required?: boolean;
};

const SIM_NAO = [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }];

export const CONSULTORIA_FIELDS: ConsultoriaFieldDef[] = [
  { key: "nome", label: "Nome", kind: "text", required: true },
  { key: "nif", label: "NIF", kind: "text", required: true },
  { key: "telemovel", label: "Telemóvel", kind: "text", required: true },
  { key: "tem_atividade", label: "Já tens atividade ou empresa aberta?", kind: "choice", options: SIM_NAO, required: true },
  { key: "conta_outrem", label: "És trabalhador por conta de outrem?", kind: "choice", options: SIM_NAO, required: true },
  {
    key: "tipo_atividade", label: "Atividade?", kind: "choice", required: true,
    options: [
      { v: "servicos", l: "Prestação de Serviços" },
      { v: "produtos", l: "Venda de Produtos" },
      { v: "ambos", l: "Ambos" },
    ],
  },
  { key: "atividade", label: "Qual a atividade ou serviço que vais exercer?", kind: "textarea", required: true },
  { key: "duvidas", label: "Quais as tuas principais dúvidas?", kind: "textarea", required: true },
  {
    key: "informacoes",
    label: "Por favor, partilha qualquer coisa que possa ser útil para a preparação da nossa reunião.",
    kind: "textarea",
  },
];

/** Valor legível de uma resposta (as escolhas guardam o código). */
export const answerLabel = (f: ConsultoriaFieldDef, v: string | undefined) =>
  (f.options?.find((o) => o.v === v)?.l ?? v) || "";

export const consultoriaFormLink = (token: string) => `${window.location.origin}/consultoria/${token}`;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-PT", { day: "numeric", month: "long" }) : "";

/** Mensagem pré-definida "Envio Formulário Consultoria - Dúvidas" (Notion). */
export const consultoriaFormMessage = (name: string, token: string, sessionDate?: string | null) => {
  const first = name.trim().split(/\s+/)[0] || "";
  const date = fmtDate(sessionDate);
  return (
    `Olá${first ? ` ${first}` : ""}! Espero que estejas bem. 😊\n\n` +
    `A nossa sessão de Consultoria Individual é já${date ? ` no dia ${date}` : " em breve"}, e para que eu possa ` +
    "preparar a nossa sessão antecipadamente, para aproveitarmos o tempo da melhor forma, peço que por favor " +
    `respondas a este breve questionário:\n\n${consultoriaFormLink(token)}\n\nObrigada!`
  );
};
