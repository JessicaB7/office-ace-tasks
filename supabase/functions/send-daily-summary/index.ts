// Resumo diário da equipa para a(s) admin(s): dias úteis às 19:00 de Lisboa
// (cron às 18:00 e 19:00 UTC, seg–sex; a função só envia quando em Lisboa são 19h — verão/inverno).
// Por colaborador: tarefas concluídas, células da Gestão Mensal e obrigações marcadas hoje,
// contactos registados hoje e tarefas com o prazo ultrapassado. Quem não fez nada aparece
// com «Sem registos hoje». Envio pela fila de emails (enqueue_email) + notificação in-app.
// Corpo opcional: { force: true } ignora a verificação da hora e do dia útil (teste manual).
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { template } from '../_shared/transactional-email-templates/daily-completed-summary.tsx'
import { buildResumoDiario, isDiaUtil, lisbonDay, lisbonHour } from '../_shared/lib/resumoDiario.ts'
import { contactTipoLabel } from '../_shared/lib/clientContacts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const SENDER_DOMAIN = Deno.env.get('EMAIL_SENDER_DOMAIN') ?? 'notify.contabilistaexplica.pt'
const TEMPLATE_NAME = 'daily-completed-summary'
const HORA_ENVIO = 19

function parseJwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return (JSON.parse(atob(payload)) as { role?: string }).role ?? null
  } catch {
    return null
  }
}

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function fetchAll(supabase: SupabaseClient, table: string, select: string, apply?: (q: any) => any) {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(select).range(from, from + 999)
    if (apply) q = apply(q)
    const { data, error } = await q
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

async function enfileirar(supabase: SupabaseClient, email: string, data: Record<string, unknown>, key: string) {
  const to = email.toLowerCase()
  const messageId = crypto.randomUUID()
  const { data: suppressed, error: supErr } = await supabase.from('suppressed_emails').select('id').eq('email', to).maybeSingle()
  if (supErr) throw supErr
  if (suppressed) {
    await supabase.from('email_send_log').insert({ message_id: messageId, template_name: TEMPLATE_NAME, recipient_email: to, status: 'suppressed' })
    return 'suppressed'
  }
  let { data: tok } = await supabase.from('email_unsubscribe_tokens').select('token, used_at').eq('email', to).maybeSingle()
  if (!tok) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    await supabase.from('email_unsubscribe_tokens').upsert({ token, email: to }, { onConflict: 'email', ignoreDuplicates: true })
    tok = (await supabase.from('email_unsubscribe_tokens').select('token, used_at').eq('email', to).maybeSingle()).data
  }
  if (!tok || tok.used_at) return 'unsubscribed'

  const el = React.createElement(template.component, data)
  const html = await renderAsync(el)
  const text = await renderAsync(el, { plainText: true })
  await supabase.from('email_send_log').insert({ message_id: messageId, template_name: TEMPLATE_NAME, recipient_email: to, status: 'pending' })
  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to,
      from: `Contabilista Explica <noreply@${SENDER_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: template.subject(data),
      html,
      text,
      purpose: 'transactional',
      label: TEMPLATE_NAME,
      idempotency_key: key,
      unsubscribe_token: tok.token,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) {
    await supabase.from('email_send_log').insert({ message_id: messageId, template_name: TEMPLATE_NAME, recipient_email: to, status: 'failed', error_message: 'Failed to enqueue email' })
    throw error
  }
  return 'queued'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Só o cron / chamadas de serviço. A assinatura do JWT já é validada pela Supabase (verify_jwt = true);
  // aceita-se a chave de serviço do vault (papel service_role) mesmo que difira da variável de ambiente.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token || (token !== serviceRoleKey && parseJwtRole(token) !== 'service_role')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: { force?: boolean } = {}
  try { body = await req.json() } catch { /* sem corpo */ }

  const now = new Date()
  const dia = lisbonDay(now)
  if (!body.force) {
    if (lisbonHour(now) !== HORA_ENVIO) return json({ skipped: true, reason: 'fora_de_hora' })
    if (!isDiaUtil(dia)) return json({ skipped: true, reason: 'fim_de_semana' })
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    // Margem de um dia para cada lado em UTC; o filtro exato pelo dia de Lisboa é feito em buildResumoDiario.
    const desde = `${addDays(dia, -1)}T00:00:00Z`
    const ate = `${addDays(dia, 1)}T23:59:59Z`

    const [collaborators, clients, tarefasConcluidas, tarefasAbertas, obrigacoes, contactos, roles] = await Promise.all([
      fetchAll(supabase, 'collaborators', 'id,name,email,user_id,active'),
      fetchAll(supabase, 'clients', 'id,name'),
      fetchAll(supabase, 'tasks', 'id,title,status,due_date,collaborator_id,client_id,updated_at',
        (q) => q.eq('status', 'concluida').gte('updated_at', desde).lte('updated_at', ate)),
      fetchAll(supabase, 'tasks', 'id,title,status,due_date,collaborator_id,client_id,updated_at',
        (q) => q.in('status', ['pendente', 'em_progresso']).lte('due_date', dia)),
      fetchAll(supabase, 'monthly_obligations', 'client_id,obligation_type,reference_month,completed_at,completed_by',
        (q) => q.eq('status', 'concluida').gte('completed_at', desde).lte('completed_at', ate)),
      fetchAll(supabase, 'client_contacts', 'client_id,collaborator_id,created_by,tipo,created_at',
        (q) => q.gte('created_at', desde).lte('created_at', ate)),
      fetchAll(supabase, 'user_roles', 'user_id', (q) => q.eq('role', 'admin')),
    ])
    const adminUserIds = roles.map((r: any) => r.user_id as string)

    const resumo = buildResumoDiario({
      dia, collaborators, adminUserIds, clients, tarefasConcluidas, tarefasAbertas, obrigacoes, contactos,
    })
    // Rótulos dos tipos de contacto (Chamada, WhatsApp, …)
    const colaboradores = resumo.colaboradores.map((c) => ({
      ...c, contactos: c.contactos.map((k) => ({ ...k, tipo: contactTipoLabel(k.tipo) })),
    }))
    const date = `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`
    const t = resumo.totais

    let enviados = 0
    for (const userId of adminUserIds) {
      const col = collaborators.find((c: any) => c.user_id === userId)
      let email = col?.email as string | undefined
      if (!email) {
        const { data } = await supabase.auth.admin.getUserById(userId)
        email = data?.user?.email ?? undefined
      }
      if (!email) continue
      const nome = (col?.name || 'Jéssica').split(' ')[0]
      const key = `daily-summary-${userId}-${dia}${body.force ? `-manual-${Date.now()}` : ''}`
      const estado = await enfileirar(supabase, email, { nome, date, colaboradores, totais: t }, key)
      if (estado === 'queued') enviados++

      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Resumo do dia da equipa',
        message: `${t.tarefas} tarefa${t.tarefas !== 1 ? 's' : ''} concluída${t.tarefas !== 1 ? 's' : ''}, ` +
          `${t.gestaoMensal + t.obrigacoes} registo${t.gestaoMensal + t.obrigacoes !== 1 ? 's' : ''} na gestão mensal/obrigações, ` +
          `${t.contactos} contacto${t.contactos !== 1 ? 's' : ''}; ${t.emAtraso} tarefa${t.emAtraso !== 1 ? 's' : ''} com prazo ultrapassado.`,
        type: 'daily_summary',
      })
    }

    return json({ success: true, dia, enviados, totais: t })
  } catch (error) {
    console.error('Resumo diário falhou:', error)
    return json({ error: (error as Error).message }, 500)
  }
})
