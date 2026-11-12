// Sincroniza as páginas-filhas de "Manual · Técnica de contabilidade" (Notion) para manual_pages,
// para o assistente responder a dúvidas de processos. Corre 1x por dia (pg_cron) e pode ser
// chamada pela admin. Precisa do secret NOTION_TOKEN (integração do Notion com acesso à página).
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const RAIZ = '40b6c08f0de081ccb69cd9f3d48a0f1c' // Manual · Técnica de contabilidade
const MAX_PROFUNDIDADE = 2 // páginas-filhas e netas
const NOTION_VERSION = '2022-06-28'

function jwtRole(token: string): string | null {
  try {
    const p = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')
    return (JSON.parse(atob(p.padEnd(Math.ceil(p.length / 4) * 4, '='))) as { role?: string }).role ?? null
  } catch {
    return null
  }
}

async function notion(path: string, notionToken: string) {
  const r = await fetch(`https://api.notion.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${notionToken}`, 'Notion-Version': NOTION_VERSION },
  })
  if (!r.ok) throw new Error(`Notion ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function filhos(blockId: string, notionToken: string) {
  const out: any[] = []
  let cursor: string | undefined
  do {
    const res = await notion(`blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`, notionToken)
    out.push(...res.results)
    cursor = res.has_more ? res.next_cursor : undefined
  } while (cursor)
  return out
}

const textoDe = (b: any): string => {
  const v = b[b.type]
  const rt = v?.rich_text || v?.text || []
  const t = Array.isArray(rt) ? rt.map((r: any) => r.plain_text || '').join('') : ''
  if (b.type?.startsWith('heading')) return `\n## ${t}`
  if (b.type === 'bulleted_list_item' || b.type === 'numbered_list_item' || b.type === 'to_do') return `- ${t}`
  if (b.type === 'bookmark' || b.type === 'link_preview' || b.type === 'embed' || b.type === 'video') return v?.url ? `(${v.url})` : ''
  return t
}

/** Texto de uma página (blocos e sub-blocos), sem descer às páginas-filhas. */
async function conteudoPagina(pageId: string, notionToken: string, nivel = 0): Promise<{ texto: string; subpaginas: { id: string; titulo: string }[] }> {
  const blocos = await filhos(pageId, notionToken)
  const linhas: string[] = []
  const subpaginas: { id: string; titulo: string }[] = []
  for (const b of blocos) {
    if (b.type === 'child_page') { subpaginas.push({ id: b.id, titulo: b.child_page?.title || 'Sem título' }); continue }
    if (b.type === 'child_database') continue
    const t = textoDe(b)
    if (t.trim()) linhas.push(t)
    if (b.has_children && nivel < 4) {
      const sub = await conteudoPagina(b.id, notionToken, nivel + 1)
      if (sub.texto.trim()) linhas.push(sub.texto)
      subpaginas.push(...sub.subpaginas)
    }
  }
  return { texto: linhas.join('\n'), subpaginas }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Cron (chave de serviço) ou admin autenticada.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  if (jwtRole(token) !== 'service_role') {
    const { data } = token ? await supabase.auth.getUser(token) : { data: null }
    if (!data?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' })
    if (!isAdmin) return json({ error: 'Só a admin pode sincronizar os manuais.' }, 403)
  }

  const notionToken = Deno.env.get('NOTION_TOKEN')
  if (!notionToken) return json({ error: 'Falta configurar o NOTION_TOKEN (Supabase → Edge Functions → Secrets).' })

  try {
    const vistos: string[] = []
    const fila: { id: string; titulo: string; nivel: number }[] =
      (await conteudoPagina(RAIZ, notionToken)).subpaginas.map((p) => ({ ...p, nivel: 1 }))
    while (fila.length) {
      const p = fila.shift()!
      const idLimpo = p.id.replace(/-/g, '')
      if (vistos.includes(idLimpo)) continue
      vistos.push(idLimpo)
      const { texto, subpaginas } = await conteudoPagina(p.id, notionToken)
      const { error } = await supabase.from('manual_pages').upsert({
        notion_page_id: idLimpo,
        titulo: p.titulo,
        url: `https://app.notion.com/p/${idLimpo}`,
        conteudo: texto.slice(0, 200000),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'notion_page_id' })
      if (error) throw error
      if (p.nivel < MAX_PROFUNDIDADE) fila.push(...subpaginas.map((s) => ({ ...s, nivel: p.nivel + 1 })))
    }
    // Páginas que deixaram de existir no Notion
    if (vistos.length) {
      await supabase.from('manual_pages').delete().not('notion_page_id', 'in', `(${vistos.map((v) => `"${v}"`).join(',')})`)
    }
    return json({ success: true, paginas: vistos.length })
  } catch (e) {
    console.error('sync-manuais:', e)
    return json({ error: (e as Error).message }, 500)
  }
})
