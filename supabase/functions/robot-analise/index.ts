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

const SYSTEM = `És o assistente do gabinete de contabilidade "Contabilista Explica" (Portugal).
Escreves, em português de Portugal, o texto da análise financeira que o gabinete envia ao cliente
(por email ou WhatsApp). O cliente não é contabilista: explica de forma clara, próxima e profissional.

Regras:
- Usa APENAS os números do resumo que te é dado. Não inventes valores, não faças estimativas de impostos
  (IRS/IRC) e não acrescentes dados que não estejam no resumo.
- Valores em euros no formato português (ex.: 12 785,50 €). Arredonda ao euro quando ajudar a leitura.
- "rendimentos" = faturação e outros rendimentos; "gastos" = despesas (positivas no resumo); "resultado" = rendimentos − gastos.
- IVA por trimestre: valor positivo = imposto a pagar; negativo = a recuperar (crédito).
- Estrutura: saudação com o nome do cliente; resumo do período em 2–3 frases; os números principais
  (faturação, despesas, resultado) e a evolução por trimestre; o que mais pesa nas despesas;
  comparação com o mesmo período do ano anterior, se existir; 2 a 4 pontos de atenção ou recomendações
  práticas; fecho a oferecer disponibilidade para falar. Assina "A equipa Contabilista Explica".
- Sem notas técnicas internas, sem códigos de contas SNC, sem referências a ficheiros, importações ou ao TCO.
- Texto simples, sem markdown (sem #, sem **). Podes usar listas com "•". Máximo ~350 palavras.
- Se houver um pedido adicional da contabilista, segue-o.`;

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
      system: SYSTEM,
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
