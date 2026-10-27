// Robot da análise financeira: recebe o resumo dos números (calculado na app) e escreve,
// com o Claude, o texto da análise para enviar ao cliente. Só para utilizadores autenticados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const estilo = (tratamento: string) => `Escreves como a contabilista do gabinete "Contabilista Explica" (Portugal) a mandar ao cliente a
análise financeira do período, por email ou WhatsApp. Português de Portugal, ${tratamento}.

Como deve soar: como uma pessoa que conhece bem o cliente e lhe explica os números de forma descontraída,
próxima e confiante, numa conversa. Frases naturais e variadas, em parágrafos curtos que fluem uns para os
outros. Nada de texto com ar de relatório ou de formulário: evita títulos, listas longas, frases feitas e
repetições do tipo "No que diz respeito a…", "Relativamente a…", "Importa referir…", "Em suma…". Não despejes
todos os números — escolhe os que contam a história e arredonda ao euro (ex.: cerca de 57 200 €), exceto
nos impostos, onde dás o valor certo.`;

// Empresas: "vocês". Trabalhadores independentes (TI): uma só pessoa, por "tu".
const TRATAMENTO_EMPRESA = 'a tratar o cliente por "vocês"';
const TRATAMENTO_TI = `a falar com uma só pessoa, por "tu" e sempre no singular (ex.: "faturaste", "já pagaste",
"vais receber"; nunca "vocês", "faturaram" nem "estejam")`;

// Empresas (SQ)
const ESTRUTURA_EMPRESA = `O que o texto conta, por esta ordem:
1. Começa com "Olá, espero que estejam bem!" e segue logo para o período analisado, sem cerimónias.
2. O quadro geral: quanto faturaram, quanto gastaram, se deu lucro ou prejuízo e a margem (em %),
   com os valores de "geral".
3. Como foi a evolução ao longo dos trimestres (faturação e despesas, em "evolucaoPorTrimestre"); se um mês
   se destacar em "faturacaoPorMes", menciona-o com naturalidade.
4. Os impostos, um a um, em linguagem simples — o que já pagaram ou vão pagar, ou o que têm a recuperar
   ou a receber, com os valores de "impostos":
   • IVA: o valor de cada trimestre e o que significa (positivo = a pagar; negativo = a recuperar).
   • Nas empresas (regime "SQ") é OBRIGATÓRIO falar do IRC: o valor total estimado a pagar e, em poucas
     palavras, de onde vem (IRC sobre o lucro, derrama e, se existirem, tributações autónomas — explica
     estas em meia frase, ex.: "imposto sobre algumas despesas, como ajudas de custo"). Diz que é uma
     estimativa com base no resultado até agora e que o valor final depende do fecho do ano.
5. Fecha numa frase calorosa, a dizer que estamos por cá para qualquer dúvida, e assina
   "A equipa Contabilista Explica".`;

// TI contabilidade organizada
const ESTRUTURA_TI_CO = `O que o texto conta, por esta ordem:
1. Começa com "Olá, espero que estejas bem!" e segue logo para o período analisado, sem cerimónias.
2. O quadro geral: quanto faturaste, quanto gastaste, se deu lucro ou prejuízo e a margem (em %),
   com os valores de "geral".
3. Como foi a evolução ao longo dos trimestres (faturação e despesas, em "evolucaoPorTrimestre"); se um mês
   se destacar em "faturacaoPorMes", menciona-o com naturalidade.
4. Os impostos, em linguagem simples, com os valores de "impostos":
   • IVA: o valor de cada trimestre e o que significa (positivo = a pagar; negativo = a recuperar).
   • IRS na contabilidade organizada (imposto "IRS (contabilidade organizada)"): é calculado sobre o lucro
     (faturação menos despesas); o IRS que daria, as deduções, o que já foi adiantado em retenção na fonte e
     pagamentos por conta, e se fica IRS a pagar ou a receber (diz qual e o valor). É uma estimativa com base
     nos valores até agora.
5. É OBRIGATÓRIO falar da poupança por estar na contabilidade organizada face ao regime simplificado (imposto
   "Comparação: …"): quanto daria o IRS no regime simplificado e quanto se poupa por estar na contabilidade
   organizada, com o valor certo. Se a linha disser que o regime simplificado daria menos IRS, diz isso com
   naturalidade, sem alarmismo nem empurrar para uma decisão.
6. Fecha numa frase calorosa, a dizer que estamos por cá para qualquer dúvida, e assina
   "A equipa Contabilista Explica".`;

// TI regime simplificado
const ESTRUTURA_TI_RS = `O que o texto conta, por esta ordem (e só isto):
1. Começa com "Olá, espero que estejas bem!" e segue logo para o período analisado, sem cerimónias.
2. A atividade: quanto faturaste e quanto tiveste de despesas (valores de "geral"), e quanto já pagaste de
   Segurança Social no período (imposto "Segurança Social (valor pago)"; podes dizer por trimestre se ajudar).
3. A estimativa de IRS no regime simplificado (imposto "IRS (regime simplificado)"): explica em linguagem
   simples que no regime simplificado o IRS é calculado sobre uma parte da faturação (o coeficiente),
   o IRS que daria, as deduções, e SALIENTA o que já foi adiantado ao Estado em retenção na fonte e
   pagamentos por conta — e que por isso, no fim, ficas com IRS a pagar ou a receber (diz qual e o valor).
   Diz que é uma estimativa com base na faturação até agora.
4. Termina com a comparação entre o regime simplificado e a contabilidade organizada (imposto
   "Comparação: …"): quanto daria o IRS em cada regime e qual sai mais favorável, com a poupança estimada,
   dita de forma simples e sem empurrar o cliente para uma decisão.
5. Fecha numa frase calorosa, a dizer que estamos por cá para qualquer dúvida, e assina
   "A equipa Contabilista Explica".
Não fales de IVA, margem nem evolução por trimestre.`;

const REGRAS = `Regras:
- Usa APENAS os números do resumo. Não inventes valores nem faças contas de impostos que não estejam lá.
- Não incluas: o que mais pesa nas despesas, comparação com o ano anterior, pontos de atenção,
  recomendações ou conselhos.
- Euros no formato português (12 785,50 €). Sem códigos de contas SNC, sem notas técnicas internas, sem
  referências a ficheiros, importações ou TCO.
- Texto simples, sem markdown (sem #, sem **). No máximo uma pequena lista, só se ajudar (ex.: IVA por trimestre).
- Se houver um pedido adicional da contabilista, segue-o.`;

const systemFor = (regime: string) => {
  if (regime === "TI RS") return [estilo(TRATAMENTO_TI), ESTRUTURA_TI_RS, REGRAS].join("\n\n");
  if (regime === "TI CO") return [estilo(TRATAMENTO_TI), ESTRUTURA_TI_CO, REGRAS].join("\n\n");
  return [estilo(TRATAMENTO_EMPRESA), ESTRUTURA_EMPRESA, REGRAS].join("\n\n");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sem autorização" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Falta configurar a chave ANTHROPIC_API_KEY no Supabase." }, 500);

    const { cliente, resumo, pedido } = await req.json();
    if (!cliente || !resumo) return json({ error: "Faltam o cliente ou o resumo" }, 400);

    const userText =
      `Cliente: ${cliente}\n\nResumo da análise (JSON):\n${JSON.stringify(resumo, null, 2)}` +
      (pedido ? `\n\nPedido adicional da contabilista: ${pedido}` : "") +
      `\n\nEscreve o texto da análise para enviar ao cliente.`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: systemFor(String(resumo.regime ?? "")),
      messages: [{ role: "user", content: userText }],
    } as any);

    if (response.stop_reason === "refusal") return json({ error: "O robot não conseguiu escrever este texto. Tente novamente." }, 502);
    const texto = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim();
    if (!texto) return json({ error: "O robot devolveu um texto vazio. Tente novamente." }, 502);
    return json({ texto });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "A chave ANTHROPIC_API_KEY não é válida." }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "Muitos pedidos ao robot — tente daqui a um minuto." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `Erro do robot (${e.status}): ${e.message}` }, 502);
    return json({ error: (e as Error).message }, 500);
  }
});
