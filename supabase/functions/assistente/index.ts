// Assistente da app (Claude, via API da Anthropic). Só utilizadores autenticados.
// Ações: "resumo" (estado do cliente), "pendentes" (rascunho de pedido de documentos em falta),
// "pergunta" (pergunta livre sobre o cliente) e "processo" (dúvidas de processos, só com base nos
// manuais do Notion sincronizados em manual_pages).
// Privacidade: nunca se enviam senhas, chaves, utilizador de faturação nem NISS ao modelo.
// Cada uso fica em assistant_log (quem, cliente, ação, data) — sem conteúdo.
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const MODEL = 'claude-sonnet-5-5'
const ACOES = ['resumo', 'pendentes', 'pergunta', 'processo'] as const
type Acao = (typeof ACOES)[number]

// Só estas colunas do cliente vão para o modelo (nada de senha_at, senha_ss, senha_faturacao,
// via_ctt_senha, via_ctt_resposta, chave_ss, utilizador_faturacao, niss).
const CLIENT_COLS = 'id,name,tipo_contabilidade,status,iva,iva_oss,recapitulativa,seguranca_social,seguranca_social_isencao_fim,pag_seguranca_social,salarios,saft,faturacao,faturacao_frequencia,programa_faturacao,inicio_contrato,responsavel_id,notas_internas,notas_faturas,notas_saft,notas_dmr,notas_retencao,notas_salarios,divida_at,divida_descricao,divida_ss,divida_ss_descricao,ativos'

const hojeLisboa = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon' }).format(new Date())
const monthStart = (ymd: string, delta = 0) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1 + delta, 1)).toISOString().slice(0, 10)

const ESTILO = `Escreves em português de Portugal, de forma clara e curta. És o assistente interno do gabinete de contabilidade Contabilista Explica.`

async function dadosCliente(supabase: any, clientId: string) {
  const today = hojeLisboa()
  const { data: c, error } = await supabase.from('clients').select(CLIENT_COLS).eq('id', clientId).maybeSingle()
  if (error || !c) throw new Error('Cliente não encontrado.')
  const meses = [monthStart(today, -3), monthStart(today, -2), monthStart(today, -1), monthStart(today, 0)]
  const [resp, obls, tasks, contacts] = await Promise.all([
    c.responsavel_id ? supabase.from('collaborators').select('name').eq('id', c.responsavel_id).maybeSingle() : { data: null },
    supabase.from('monthly_obligations').select('obligation_type,reference_month,status,extra_done,notes').eq('client_id', clientId).in('reference_month', meses),
    supabase.from('tasks').select('title,due_date,status,description').eq('client_id', clientId).in('status', ['pendente', 'em_progresso']).order('due_date').limit(30),
    supabase.from('client_contacts').select('tipo,data,resumo,seguimento_em').eq('client_id', clientId).order('data', { ascending: false }).limit(10),
  ])
  const { responsavel_id: _r, id: _i, ...cliente } = c
  return {
    hoje: today,
    cliente: { ...cliente, responsavel: resp?.data?.name ?? null },
    obrigacoes_ultimos_meses: (obls.data || []).map((o: any) => ({ tipo: o.obligation_type, mes: String(o.reference_month).slice(0, 7), estado: o.status, pagamento_ou_envio_feito: o.extra_done, notas: o.notes })),
    tarefas_abertas: tasks.data || [],
    ultimos_contactos: contacts.data || [],
  }
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

async function paginasRelevantes(supabase: any, pergunta: string) {
  const { data: pages } = await supabase.from('manual_pages').select('titulo,url,conteudo')
  if (!pages?.length) return []
  const termos = [...new Set(normalizar(pergunta).split(/[^a-z0-9]+/).filter((t) => t.length >= 4))]
  return pages
    .map((p: any) => {
      const titulo = normalizar(p.titulo)
      const corpo = normalizar(p.conteudo)
      const score = termos.reduce((s, t) => s + (titulo.includes(t) ? 5 : 0) + Math.min(corpo.split(t).length - 1, 10), 0)
      return { ...p, score }
    })
    .filter((p: any) => p.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 4)
}

function prompts(acao: Acao, dados: any, texto: string, paginas: any[]) {
  const ctx = dados ? `Dados do cliente (JSON):\n${JSON.stringify(dados, null, 1)}` : ''
  switch (acao) {
    case 'resumo':
      return {
        system: `${ESTILO} Fazes resumos internos para a equipa, com base apenas nos dados fornecidos.`,
        user: `${ctx}\n\nFaz um resumo curto do cliente para a equipa, em três partes com estes títulos: "Em dia", "Pendente" e "Alertas" (dívidas AT/SS, fim de isenção da Segurança Social, tarefas atrasadas, obrigações por concluir, seguimentos). Usa listas curtas. Não inventes nada que não esteja nos dados.`,
      }
    case 'pendentes':
      return {
        system: `${ESTILO} Redige mensagens para clientes, sempre tratando o cliente por "tu" (singular), num tom simpático e profissional. Nunca envias nada: só escreves o rascunho.`,
        user: `${ctx}\n\nLista de movimentos sem documento colada pela equipa:\n"""\n${texto}\n"""\n\nRedige um pedido ao cliente, pronto a copiar, organizado por tipo: "Falta a fatura", "Fatura sem o NIF da empresa/atividade" e "Movimento a explicar" (só os grupos que tiverem movimentos). Para cada movimento indica data, descrição e valor tal como aparecem. Pede o envio até uma data concreta 5 dias úteis depois de ${dados?.hoje ?? 'hoje'}. Trata o cliente por "tu". Devolve só a mensagem.`,
      }
    case 'pergunta':
      return {
        system: `${ESTILO} Respondes a perguntas da equipa sobre um cliente usando apenas os dados fornecidos; se a resposta não estiver nos dados, dizes isso claramente.`,
        user: `${ctx}\n\nPergunta da equipa: ${texto}`,
      }
    case 'processo':
      return {
        system: `${ESTILO} Respondes a dúvidas de processos internos usando APENAS os excertos dos manuais fornecidos. No fim indicas o link da página do manual que usaste ("Fonte: <título> — <url>"). Se os manuais não responderem à pergunta, diz que não encontraste a resposta nos manuais e sugere falar com a Jéssica. Não uses conhecimento externo.`,
        user: `Manuais:\n${paginas.map((p) => `### ${p.titulo}\nURL: ${p.url}\n${String(p.conteudo).slice(0, 15000)}`).join('\n\n')}\n\nPergunta: ${texto}`,
      }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const { data: userData } = token ? await supabase.auth.getUser(token) : { data: null }
  const user = userData?.user
  if (!user) return json({ error: 'Sessão inválida — volta a entrar na app.' }, 401)

  let body: { acao?: Acao; client_id?: string; texto?: string } = {}
  try { body = await req.json() } catch { /* corpo inválido */ }
  const acao = body.acao
  const texto = (body.texto || '').trim().slice(0, 20000)
  if (!acao || !ACOES.includes(acao)) return json({ error: 'Ação inválida.' })
  if (acao !== 'processo' && !body.client_id) return json({ error: 'Falta indicar o cliente.' })
  if ((acao === 'pendentes' || acao === 'pergunta' || acao === 'processo') && !texto) return json({ error: 'Escreve o texto ou a pergunta.' })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'Falta configurar a chave ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).' })

  try {
    const dados = acao === 'processo' ? null : await dadosCliente(supabase, body.client_id!)
    const paginas = acao === 'processo' ? await paginasRelevantes(supabase, texto) : []
    if (acao === 'processo' && paginas.length === 0) {
      const { count } = await supabase.from('manual_pages').select('id', { count: 'exact', head: true })
      return json({
        texto: count
          ? 'Não encontrei nada sobre isso nos manuais. Fala com a Jéssica.'
          : 'Os manuais do Notion ainda não foram sincronizados (falta configurar o NOTION_TOKEN ou correr a sincronização). Entretanto, fala com a Jéssica.',
      })
    }

    // Registo de uso (sem conteúdo)
    await supabase.from('assistant_log').insert({ user_id: user.id, client_id: body.client_id ?? null, acao })

    const { system, user: userMsg } = prompts(acao, dados, texto, paginas)
    const client = new Anthropic({ apiKey })
    // Fallback do lado do servidor se o modelo recusar (categoria de segurança).
    const resp: any = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system,
      messages: [{ role: 'user', content: userMsg }],
    } as any)
    if (resp.stop_reason === 'refusal') return json({ error: 'O assistente não conseguiu responder a este pedido.' })
    const out = (resp.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    return json({ texto: out || 'Sem resposta.', fontes: paginas.map((p: any) => ({ titulo: p.titulo, url: p.url })) })
  } catch (e) {
    console.error('assistente:', e)
    const status = (e as { status?: number }).status
    if (status === 401) return json({ error: 'A chave ANTHROPIC_API_KEY não é válida.' })
    return json({ error: 'Erro do assistente: ' + (e as Error).message })
  }
})
