// Segunda-feira de manhã (cron às 07:00 e 08:00 UTC; o cron só chama às 08:00 de Lisboa):
//  1) resumo semanal de tarefas de cada colaborador (email + notificação) — como antes;
//  2) relatório semanal do escritório para a(s) admin(s) (email via fila de emails);
//  3) versão resumida (só os seus clientes) para quem a ativou em Definições → Notificações.
// A admin pode pedir o relatório na app ("Enviar relatório agora"): body { only: "admin_report" }.
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { template as relatorioTemplate } from '../_shared/transactional-email-templates/weekly-business-report.tsx'
import { computeFecho, type FechoGrupo } from '../_shared/lib/fechoMes.ts'
import { obrigacoesForClient, isObrigacaoDone, fmtPrazo } from '../_shared/lib/obrigacoesControlo.ts'
import { makeDayResolver, type DayResolver } from '../_shared/lib/deadlineOverrides.ts'
import { ativoNoMes } from '../_shared/lib/clientSaida.ts'
import { pedidosDocumentosPendentes } from '../_shared/lib/clientContacts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const APP = 'https://gestao.contabilistaexplica.pt'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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

// ---------- datas (Lisboa) ----------
const lisbonToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon' }).format(new Date())
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const monthStart = (ymd: string, delta = 0) => {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1 + delta, 1))
  return d.toISOString().slice(0, 10)
}
const fmt = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`
const SEM: Record<string, string> = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }

// ---------- leitura de dados ----------
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

interface Dados {
  today: string
  clients: any[]
  collaborators: any[]
  offboardings: any[]
  obligations: any[]
  dayFor: DayResolver
  tasks: any[]
  contacts: any[]
  jobs: any[]
  leads: any[]
  settings: any[]
  mapaYear: number
  mapaQ: number
}

async function carregar(supabase: SupabaseClient): Promise<Dados> {
  const today = lisbonToday()
  const months = [monthStart(today, -2), monthStart(today, -1), monthStart(today, 0)]
  // Trimestre já terminado mais recente (mapas trimestrais)
  const m0 = +today.slice(5, 7) - 1
  const qIdx = Math.floor(m0 / 3)
  const mapaYear = qIdx === 0 ? +today.slice(0, 4) - 1 : +today.slice(0, 4)
  const mapaQ = qIdx === 0 ? 4 : qIdx

  // Só colunas não sensíveis (nada de senhas).
  const [clients, collaborators, offboardings, obligations, overrides, tasks, contacts, jobs, leads, settings] = await Promise.all([
    fetchAll(supabase, 'clients', 'id,name,active,status,responsavel_id,tipo_contabilidade,saft,salarios,seguranca_social,seguranca_social_isencao_fim,pag_seguranca_social,iva,recapitulativa,inicio_contrato,ultimo_mes_responsabilidade,created_at'),
    fetchAll(supabase, 'collaborators', 'id,name,email,user_id,active'),
    fetchAll(supabase, 'client_offboardings', 'client_id,completed_at,ultimo_mes_responsabilidade'),
    fetchAll(supabase, 'monthly_obligations', 'client_id,obligation_type,reference_month,status,extra_done', (q) => q.in('reference_month', months)),
    fetchAll(supabase, 'fiscal_deadline_overrides', 'deadline_key,year,month,day'),
    fetchAll(supabase, 'tasks', 'id,title,due_date,status,collaborator_id,client_id', (q) => q.in('status', ['pendente', 'em_progresso']).lt('due_date', today)),
    fetchAll(supabase, 'client_contacts', 'client_id,tipo,data,created_at', (q) => q.gte('data', addDays(today, -120))),
    fetchAll(supabase, 'toconline_jobs', 'id,procedure_id,client_id,status,result_notes,updated_at,finished_at', (q) => q.in('status', ['erro', 'bloqueada']).gte('updated_at', `${addDays(today, -7)}T00:00:00`)),
    fetchAll(supabase, 'leads', 'id,name,stage,segment,next_followup,meeting_date,owner_id'),
    fetchAll(supabase, 'client_financial_settings', `client_id,year,mapa_q${mapaQ}_enviado`, (q) => q.eq('year', mapaYear)),
  ])
  return { today, clients, collaborators, offboardings, obligations, dayFor: makeDayResolver(overrides), tasks, contacts, jobs, leads, settings, mapaYear, mapaQ }
}

// ---------- secções ----------
interface Secao { titulo: string; link?: string; linhas: string[]; vazio?: string }

function obrigacoesProximos7Dias(d: Dados, clientes: any[]) {
  const byKey = new Map<string, any>()
  d.obligations.forEach((o) => byKey.set(`${o.client_id}|${String(o.reference_month).slice(0, 10)}|${o.obligation_type}`, o))
  const fim = addDays(d.today, 7)
  const out: { client: any; label: string; deadline: string }[] = []
  for (const month of [monthStart(d.today, -2), monthStart(d.today, -1), monthStart(d.today, 0)]) {
    for (const c of clientes) {
      if (!ativoNoMes(c, month)) continue
      for (const t of obrigacoesForClient(c, month, d.dayFor)) {
        if (t.deadline < d.today || t.deadline > fim) continue
        if (isObrigacaoDone(t, byKey.get(`${c.id}|${month}|${t.type}`))) continue
        out.push({ client: c, label: t.label, deadline: t.deadline })
      }
    }
  }
  return out
}

function construir(d: Dados, opts: { collaboratorId?: string }) {
  const nome = (id: string | null | undefined) =>
    id === 'none' || !id ? 'Sem responsável' : d.collaborators.find((c) => c.id === id)?.name || '—'
  const ativos = d.clients.filter((c) => c.active && c.status !== 'inativo')
  const meus = opts.collaboratorId ? ativos.filter((c) => c.responsavel_id === opts.collaboratorId) : ativos
  const meusIds = new Set(meus.map((c) => c.id))
  const clientName = (id: string) => d.clients.find((c) => c.id === id)?.name || '—'
  const secoes: Secao[] = []

  if (!opts.collaboratorId) {
    const novos = ativos.filter((c) => c.created_at && c.created_at.slice(0, 10) >= addDays(d.today, -7))
    const emSaida = d.offboardings.filter((o) => !o.completed_at && d.clients.find((c) => c.id === o.client_id)?.status === 'a_sair')
    secoes.push({
      titulo: 'Clientes',
      link: `${APP}/?view=clients`,
      linhas: [
        `${ativos.length} clientes ativos`,
        `${novos.length} ${novos.length === 1 ? 'cliente novo' : 'clientes novos'} na última semana${novos.length ? `: ${novos.map((c) => c.name).slice(0, 8).join(', ')}` : ''}`,
        `${emSaida.length} ${emSaida.length === 1 ? 'saída em curso' : 'saídas em curso'}${emSaida.length ? `: ${emSaida.map((o) => clientName(o.client_id)).slice(0, 8).join(', ')}` : ''}`,
      ],
    })
  }

  // Fecho do mês de trabalho (o anterior)
  const mesRef = monthStart(d.today, -1)
  const fecho = computeFecho(meus, d.obligations, mesRef, d.today, d.dayFor)
  const linhaFecho = (titulo: string, g: FechoGrupo) =>
    `${SEM[g.semaforo]} ${titulo} — ${g.pct}% (${g.feitas}/${g.total})${g.pendentes && g.proximoPrazo ? ` · próximo prazo ${fmtPrazo(g.proximoPrazo)}` : ''}`
  const proximos = obrigacoesProximos7Dias(d, meus)
  const proxPorResp = new Map<string, number>()
  proximos.forEach((p) => proxPorResp.set(p.client.responsavel_id || 'none', (proxPorResp.get(p.client.responsavel_id || 'none') || 0) + 1))
  secoes.push({
    titulo: `Fecho do mês (${mesRef.slice(5, 7)}/${mesRef.slice(0, 4)})`,
    link: `${APP}/?view=fecho_mes`,
    linhas: [
      ...(opts.collaboratorId
        ? fecho.porResponsavel.map((g) => linhaFecho('As minhas obrigações', g))
        : fecho.porResponsavel.sort((a, b) => nome(a.key).localeCompare(nome(b.key), 'pt')).map((g) => linhaFecho(nome(g.key), g))),
      ...(proximos.length
        ? [`Obrigações por fazer com prazo nos próximos 7 dias: ${proximos.length}${opts.collaboratorId ? '' : ` (${[...proxPorResp.entries()].map(([k, n]) => `${nome(k).split(' ')[0]} ${n}`).join(', ')})`}`]
        : ['Sem obrigações pendentes com prazo nos próximos 7 dias']),
    ],
  })

  // Tarefas em atraso
  const atrasadas = d.tasks.filter((t) => !opts.collaboratorId || t.collaborator_id === opts.collaboratorId)
  const porColab = new Map<string, number>()
  atrasadas.forEach((t) => porColab.set(t.collaborator_id || 'none', (porColab.get(t.collaborator_id || 'none') || 0) + 1))
  secoes.push({
    titulo: 'Tarefas em atraso',
    link: `${APP}/?view=tasks`,
    linhas: opts.collaboratorId
      ? atrasadas.slice(0, 15).map((t) => `${t.title}${t.client_id ? ` — ${clientName(t.client_id)}` : ''} (prazo ${fmt(t.due_date)})`)
      : [...porColab.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${nome(k)}: ${n}`),
    vazio: 'Sem tarefas em atraso. 🎉',
  })

  // Pedidos de documentos à espera há mais de 5 dias
  const pedidos = pedidosDocumentosPendentes(d.contacts.filter((c) => meusIds.has(c.client_id)), d.today, 5)
  secoes.push({
    titulo: 'Pedidos de documentos à espera (> 5 dias)',
    link: `${APP}/?view=clients`,
    linhas: pedidos.slice(0, 20).map((p) => {
      const c = d.clients.find((x) => x.id === p.client_id)
      return `${c?.name || '—'} — pedido a ${fmt(p.data)}${opts.collaboratorId ? '' : ` (${nome(c?.responsavel_id).split(' ')[0]})`}`
    }),
    vazio: 'Nenhum pedido de documentos à espera.',
  })

  // Automações TOConline com erro na semana
  const erros = d.jobs.filter((j) => meusIds.has(j.client_id))
  secoes.push({
    titulo: 'Automações TOConline com erro (última semana)',
    link: `${APP}/?view=toconline_automacoes`,
    linhas: erros.length ? [`${erros.length} ${erros.length === 1 ? 'tarefa com erro ou bloqueada' : 'tarefas com erro ou bloqueadas'}`,
      ...erros.slice(0, 8).map((j) => `${clientName(j.client_id)} — ${(j.result_notes || 'sem motivo').slice(0, 90)}`)] : [],
    vazio: 'Sem erros nas automações.',
  })

  if (!opts.collaboratorId) {
    const fechados = ['ganho', 'perda', 'mensal_sim', 'mensal_nao']
    const followAtraso = d.leads.filter((l) => l.next_followup && l.next_followup < d.today && !fechados.includes(l.stage))
    const reunioes = d.leads.filter((l) => l.meeting_date && l.meeting_date >= d.today && l.meeting_date <= addDays(d.today, 6))
    secoes.push({
      titulo: 'Comercial',
      link: `${APP}/?view=followups`,
      linhas: [
        `${followAtraso.length} follow ups em atraso${followAtraso.length ? `: ${followAtraso.slice(0, 8).map((l) => `${l.name} (${fmt(l.next_followup)})`).join(', ')}` : ''}`,
        `${reunioes.length} ${reunioes.length === 1 ? 'reunião' : 'reuniões'} esta semana${reunioes.length ? `: ${reunioes.sort((a, b) => a.meeting_date.localeCompare(b.meeting_date)).map((l) => `${l.name} (${fmt(l.meeting_date)})`).join(', ')}` : ''}`,
      ],
    })
  }

  // Alertas
  const ss = meus.filter((c) => c.seguranca_social_isencao_fim && c.seguranca_social_isencao_fim >= d.today && c.seguranca_social_isencao_fim <= addDays(d.today, 60))
  const mapasPorEnviar = d.settings.filter((s) => meusIds.has(s.client_id) && s[`mapa_q${d.mapaQ}_enviado`] !== true)
  secoes.push({
    titulo: 'Alertas',
    link: `${APP}/?view=mapas_trimestrais`,
    linhas: [
      ...ss.sort((a, b) => a.seguranca_social_isencao_fim.localeCompare(b.seguranca_social_isencao_fim))
        .map((c) => `Isenção SS a terminar: ${c.name} a ${fmt(c.seguranca_social_isencao_fim)}`),
      ...(mapasPorEnviar.length ? [`${mapasPorEnviar.length} mapas do ${d.mapaQ}º trimestre de ${d.mapaYear} por enviar`] : []),
    ],
    vazio: 'Sem alertas.',
  })

  return secoes
}

// ---------- envio ----------
// O relatório é renderizado aqui e posto na fila de emails (enqueue_email → process-email-queue),
// com as mesmas regras do send-transactional-email: lista de supressão, token de unsubscribe e log.
const SENDER_DOMAIN = Deno.env.get('EMAIL_SENDER_DOMAIN') ?? 'notify.contabilistaexplica.pt'

async function enviarRelatorio(supabase: SupabaseClient, email: string, nome: string, secoes: Secao[], titulo: string, key: string, today: string) {
  const to = email.toLowerCase()
  const messageId = crypto.randomUUID()
  const templateName = 'weekly-business-report'
  const { data: suppressed, error: supErr } = await supabase.from('suppressed_emails').select('id').eq('email', to).maybeSingle()
  if (supErr) throw supErr
  if (suppressed) {
    await supabase.from('email_send_log').insert({ message_id: messageId, template_name: templateName, recipient_email: to, status: 'suppressed' })
    return
  }
  let { data: tok } = await supabase.from('email_unsubscribe_tokens').select('token, used_at').eq('email', to).maybeSingle()
  if (!tok) {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    await supabase.from('email_unsubscribe_tokens').upsert({ token, email: to }, { onConflict: 'email', ignoreDuplicates: true })
    tok = (await supabase.from('email_unsubscribe_tokens').select('token, used_at').eq('email', to).maybeSingle()).data
  }
  if (!tok || tok.used_at) return

  const data = { nome: nome.split(' ')[0], titulo, periodo: `semana de ${fmt(today)}`, secoes }
  const el = React.createElement(relatorioTemplate.component, data)
  const html = await renderAsync(el)
  const text = await renderAsync(el, { plainText: true })
  await supabase.from('email_send_log').insert({ message_id: messageId, template_name: templateName, recipient_email: to, status: 'pending' })
  const { error } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to,
      from: `Contabilista Explica <noreply@${SENDER_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: relatorioTemplate.subject(data),
      html,
      text,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: key,
      unsubscribe_token: tok.token,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) {
    await supabase.from('email_send_log').insert({ message_id: messageId, template_name: templateName, recipient_email: to, status: 'failed', error_message: 'Failed to enqueue email' })
    throw error
  }
}

async function adminsDestino(supabase: SupabaseClient, collaborators: any[]) {
  const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin')
  const out: { email: string; nome: string }[] = []
  for (const r of roles || []) {
    const col = collaborators.find((c) => c.user_id === r.user_id)
    let email = col?.email as string | undefined
    if (!email) {
      const { data } = await supabase.auth.admin.getUserById(r.user_id)
      email = data?.user?.email ?? undefined
    }
    if (email && !out.some((o) => o.email === email)) out.push({ email, nome: col?.name || 'Jéssica' })
  }
  return out
}

async function resumoTarefasColaboradores(supabase: SupabaseClient) {
  const { data: collaborators, error: collabError } = await supabase.from('collaborators').select('*').eq('active', true)
  if (collabError) throw collabError

  const now = new Date()
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const weekRange = `${monday.getDate()}–${sunday.getDate()} ${monday.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}`
  const priorityLabels: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }
  let sentCount = 0

  for (const collab of collaborators || []) {
    if (!collab.email || !collab.user_id) continue
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('*, clients(name)')
      .eq('collaborator_id', collab.id)
      .in('status', ['pendente', 'em_progresso'])
      .lte('due_date', sunday.toISOString().split('T')[0])
      .order('due_date')
    if (taskError) {
      console.error(`Error fetching tasks for ${collab.name}:`, taskError)
      continue
    }
    const taskList = (tasks || []).map((t: any) => ({
      title: t.title,
      clientName: t.clients?.name || undefined,
      dueDate: new Date(t.due_date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }),
      priority: priorityLabels[t.priority] || t.priority,
    }))
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'weekly-tasks-digest',
        recipientEmail: collab.email,
        idempotencyKey: `weekly-digest-${collab.id}-${monday.toISOString().split('T')[0]}`,
        templateData: { collaboratorName: collab.name, tasks: taskList, weekRange },
      },
    })
    await supabase.from('notifications').insert({
      user_id: collab.user_id,
      title: 'Resumo semanal de tarefas',
      message: `Tem ${taskList.length} tarefa${taskList.length !== 1 ? 's' : ''} pendente${taskList.length !== 1 ? 's' : ''} esta semana.`,
      type: 'weekly_digest',
    })
    sentCount++
  }
  return sentCount
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  // A assinatura do JWT já é validada pela Supabase (verify_jwt = true); como no send-push,
  // aceita-se a chave de serviço do vault (papel service_role) mesmo que difira da variável de ambiente.
  const isService = !!token && (token === serviceRoleKey || parseJwtRole(token) === 'service_role')

  let body: { only?: string } = {}
  try { body = await req.json() } catch { /* sem corpo */ }

  // Pedido manual da admin ("Enviar relatório agora")
  if (!isService) {
    if (!token) return json({ error: 'Unauthorized' }, 401)
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' })
    if (!isAdmin) return json({ error: 'Só a admin pode enviar o relatório.' }, 403)
    try {
      const d = await carregar(supabase)
      const col = d.collaborators.find((c) => c.user_id === userData.user.id)
      const email = col?.email || userData.user.email
      if (!email) return json({ error: 'Sem email para enviar.' }, 400)
      await enviarRelatorio(supabase, email, col?.name || '', construir(d, {}), 'Relatório semanal do escritório',
        `weekly-report-manual-${userData.user.id}-${Date.now()}`, d.today)
      return json({ success: true, sent: 1 })
    } catch (e) {
      console.error('Relatório manual falhou:', e)
      return json({ error: (e as Error).message }, 500)
    }
  }

  try {
    const result: Record<string, number> = {}
    const d = await carregar(supabase)

    if (body.only !== 'admin_report') result.digests = await resumoTarefasColaboradores(supabase)

    // Relatório completo para as admins
    const admins = await adminsDestino(supabase, d.collaborators)
    for (const a of admins) {
      await enviarRelatorio(supabase, a.email, a.nome, construir(d, {}), 'Relatório semanal do escritório', `weekly-report-${a.email}-${d.today}`, d.today)
    }
    result.admin_reports = admins.length

    // Versão resumida para quem a ativou
    if (body.only !== 'admin_report') {
      const { data: prefs } = await supabase.from('notification_preferences').select('user_id').eq('relatorio_semanal_pessoal', true)
      let n = 0
      for (const p of prefs || []) {
        const col = d.collaborators.find((c) => c.user_id === p.user_id && c.active)
        if (!col?.email) continue
        await enviarRelatorio(supabase, col.email, col.name, construir(d, { collaboratorId: col.id }), 'Resumo semanal dos teus clientes',
          `weekly-report-pessoal-${col.id}-${d.today}`, d.today)
        n++
      }
      result.personal_reports = n
    }

    return json({ success: true, ...result })
  } catch (error) {
    console.error('Weekly digest error:', error)
    return json({ error: (error as Error).message }, 500)
  }
})
