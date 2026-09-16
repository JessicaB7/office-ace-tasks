const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'npm:@supabase/supabase-js@2'

function parseJwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replaceAll('-', '+').replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    const claims = JSON.parse(atob(payload)) as { role?: string }
    return claims.role ?? null
  } catch {
    return null
  }
}

// Mesma configuração dos 4 regimes de "Contabilidades" que existe em
// src/lib/contabilidadesConfig.ts — duplicada aqui porque as Edge Functions
// (Deno) não partilham módulos com o código do frontend (Vite).
type RegimeConfig = {
  label: string
  filter: (c: any) => boolean
  columns?: string[]
}

const REGIMES: Record<string, RegimeConfig> = {
  TI_isento: {
    label: 'TI Simplificado - Isento IVA',
    filter: (c) => c.tipo_contabilidade === 'TI RS' && (c.iva === 'Art.53º' || c.iva === 'Art. 9º'),
  },
  TI_iva: {
    label: 'TI Simplificado - Reg. IVA',
    filter: (c) => c.tipo_contabilidade === 'TI RS' && c.iva !== 'Art.53º' && c.iva !== 'Art. 9º' && c.iva !== '' && c.iva != null,
    columns: ['Vendas', 'Compras', 'E-Fatura'],
  },
  organizada: {
    label: 'TI Contabilidade Organizada',
    filter: (c) => c.tipo_contabilidade === 'TI CO',
    columns: ['Vendas', 'Compras', 'Bancos', 'E-Fatura', 'Análise'],
  },
  empresas: {
    label: 'Empresas',
    filter: (c) => c.tipo_contabilidade === 'SQ',
  },
}

const obligationTypesFor = (key: string, config: RegimeConfig): string[] => {
  if (config.columns && config.columns.length > 0) {
    return config.columns.map((col) => `contabilidade_${key}_${col.toLowerCase().replace(/[- ]/g, '_')}`)
  }
  return [`contabilidade_${key}`]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Restrict to service-role callers only (cron/scheduled jobs).
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token || parseJwtRole(token) !== 'service_role' || token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const referenceMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysLeft = daysInMonth - today.getDate()

    // Só envia perto do fim do mês (últimos 3 dias, incl. o último dia) — evita
    // notificar todos os dias por algo que ainda vai sendo preenchido ao longo do mês.
    const END_OF_MONTH_URGENCY_DAYS = 3
    if (daysLeft > END_OF_MONTH_URGENCY_DAYS) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'not_end_of_month', daysLeft }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: clients, error: clientsError }, { data: obligations, error: oblError }, { data: collaborators, error: collabError }] =
      await Promise.all([
        supabase.from('clients').select('*').eq('active', true),
        supabase.from('monthly_obligations').select('*').eq('reference_month', referenceMonth),
        supabase.from('collaborators').select('*').eq('active', true),
      ])

    if (clientsError) throw clientsError
    if (oblError) throw oblError
    if (collabError) throw collabError

    // Para cada regime, calcula quais clientes ainda não estão concluídos.
    const pendingByClient: Record<string, string> = {} // client_id -> regime label

    for (const [key, config] of Object.entries(REGIMES)) {
      const regimeClients = (clients || []).filter(config.filter)
      const obTypes = obligationTypesFor(key, config)

      const doneSets = new Map<string, Set<string>>()
      for (const o of obligations || []) {
        if (o.status !== 'concluida' || !obTypes.includes(o.obligation_type)) continue
        if (!doneSets.has(o.client_id)) doneSets.set(o.client_id, new Set())
        doneSets.get(o.client_id)!.add(o.obligation_type)
      }

      for (const c of regimeClients) {
        const done = doneSets.get(c.id)
        const isDone = !!done && obTypes.every((t) => done.has(t))
        if (!isDone) pendingByClient[c.id] = config.label
      }
    }

    // Agrupa por responsável (collaborator).
    const byCollab = new Map<string, { collab: any; items: { clientName: string; regime: string }[] }>()
    for (const c of clients || []) {
      const label = pendingByClient[c.id]
      if (!label || !c.responsavel_id) continue
      if (!byCollab.has(c.responsavel_id)) {
        const collab = (collaborators || []).find((k: any) => k.id === c.responsavel_id)
        if (!collab) continue
        byCollab.set(c.responsavel_id, { collab, items: [] })
      }
      byCollab.get(c.responsavel_id)?.items.push({ clientName: c.name, regime: label })
    }

    let sentCount = 0

    for (const { collab, items } of byCollab.values()) {
      if (!collab.email || !collab.user_id || items.length === 0) continue

      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'monthly-obligations-reminder',
          recipientEmail: collab.email,
          idempotencyKey: `monthly-obligations-${collab.id}-${referenceMonth}-${todayStr}`,
          templateData: {
            collaboratorName: collab.name,
            items,
            daysLeft,
          },
        },
      })

      await supabase.from('notifications').insert({
        user_id: collab.user_id,
        title: 'Obrigações mensais por concluir',
        message: `Tem ${items.length} cliente${items.length !== 1 ? 's' : ''} por concluir este mês — o fim do mês está a aproximar-se.`,
        type: 'monthly_obligations_reminder',
      })

      sentCount++
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount, daysLeft }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Monthly obligations reminder error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
