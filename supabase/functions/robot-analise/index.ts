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

const SYSTEM = `És a equipa do gabinete de contabilidade "Contabilista Explica" (Portugal) a escrever ao cliente
a análise financeira do período, para enviar por email ou WhatsApp. Escreve em português de Portugal, com o
tom do gabinete: próximo, simpático e claro, a tratar o cliente por "vocês". O cliente não é contabilista.

Estrutura (por esta ordem, e só isto):
1. Começa exatamente com: "Olá, espero que estejam bem!" e uma frase curta a apresentar a análise do período.
2. Análise geral: faturação, despesas, lucro ou prejuízo (diz "lucro" se o resultado for positivo e
   "prejuízo" se for negativo) e a margem (resultado ÷ faturação, em %). Usa os valores de "geral".
3. Evolução: como evoluíram a faturação e as despesas ao longo dos trimestres ("evolucaoPorTrimestre");
   podes referir um mês que se destaque em "faturacaoPorMes".
4. Análise detalhada por imposto: um bloco para cada imposto de "impostos", com o título do imposto e os
   valores das suas linhas e, se houver, por trimestre. Explica numa frase simples o que cada valor significa
   (ex.: IVA a pagar ou a recuperar; IRS a pagar ou a receber). Quando o imposto disser "estimativa",
   diz que é uma estimativa com base nos valores até agora.
5. Fecho curto a dizer que estamos disponíveis para qualquer dúvida. Assina "A equipa Contabilista Explica".

Regras:
- Usa APENAS os números do resumo. Não inventes valores nem faças contas de impostos que não estejam lá.
- Não incluas: o que mais pesa nas despesas, comparação com o ano anterior, pontos de atenção,
  recomendações ou conselhos.
- Valores em euros no formato português (ex.: 12 785,50 €).
- Sem códigos de contas SNC, sem notas técnicas internas, sem referências a ficheiros, importações ou TCO.
- Texto simples, sem markdown (sem #, sem **). Títulos de bloco numa linha própria; listas com "•".
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
