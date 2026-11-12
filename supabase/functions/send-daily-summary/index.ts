// Resumo diário da equipa para a(s) admin(s): dias úteis às 19:00 de Lisboa
// (cron às 18:00 e 19:00 UTC, seg–sex; a função só corre quando em Lisboa são 19h — verão/inverno).
// Já não envia email: cria só uma notificação in-app «Resumo do dia» com os registos de cada
// colaborador («Ana: 5 · Diogo: 3 · Angela: 0») e ligação para a vista /?view=resumo_dia&date=YYYY-MM-DD,
// onde a admin vê o detalhe (calculado no cliente com a mesma lógica pura de resumoDiario.ts).
// Corpo opcional: { force: true } ignora a verificação da hora e do dia útil (teste manual).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  addDiasYmd, buildResumoDiario, isDiaUtil, lisbonDay, lisbonHour, resumoDiaLink, resumoNotificacaoTexto,
} from '../_shared/lib/resumoDiario.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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
    const desde = `${addDiasYmd(dia, -1)}T00:00:00Z`
    const ate = `${addDiasYmd(dia, 1)}T23:59:59Z`

    const [collaborators, clients, tarefasConcluidas, tarefasAbertas, obrigacoes, contactos, roles] = await Promise.all([
      fetchAll(supabase, 'collaborators', 'id,name,user_id,active'),
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
    const t = resumo.totais
    const message = resumoNotificacaoTexto(resumo) || 'Sem colaboradores ativos.'
    const link = resumoDiaLink(dia)

    let notificadas = 0
    for (const userId of adminUserIds) {
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Resumo do dia',
        message,
        type: 'daily_summary',
        link,
        data: { dia, totais: t },
      })
      if (error) throw error
      notificadas++
    }

    return json({ success: true, dia, notificadas, totais: t })
  } catch (error) {
    console.error('Resumo diário falhou:', error)
    return json({ error: (error as Error).message }, 500)
  }
})
