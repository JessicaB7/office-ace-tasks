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

    // Get all active collaborators
    const { data: collaborators, error: collabError } = await supabase
      .from('collaborators')
      .select('*')
      .eq('active', true)

    if (collabError) throw collabError

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const dateFormatted = today.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const priorityLabels: Record<string, string> = {
      baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
    }

    let sentCount = 0

    for (const collab of collaborators || []) {
      if (!collab.email || !collab.user_id) continue

      // Get pending tasks for this collaborator due today (or overdue, so nothing is missed)
      const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*, clients(name)')
        .eq('collaborator_id', collab.id)
        .in('status', ['pendente', 'em_progresso'])
        .lte('due_date', todayStr)
        .order('due_date')

      if (taskError) {
        console.error(`Error fetching tasks for ${collab.name}:`, taskError)
        continue
      }

      // Skip collaborators with nothing due — avoids sending an empty reminder every day
      if (!tasks || tasks.length === 0) continue

      const taskList = tasks.map((t: any) => ({
        title: t.title,
        clientName: t.clients?.name || undefined,
        priority: priorityLabels[t.priority] || t.priority,
      }))

      // Send email
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'daily-tasks-reminder',
          recipientEmail: collab.email,
          idempotencyKey: `daily-tasks-${collab.id}-${todayStr}`,
          templateData: {
            collaboratorName: collab.name,
            tasks: taskList,
            dateFormatted,
          },
        },
      })

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_id: collab.user_id,
        title: 'Tarefas de hoje',
        message: `Tem ${taskList.length} tarefa${taskList.length !== 1 ? 's' : ''} para hoje.`,
        type: 'daily_tasks_reminder',
      })

      sentCount++
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Daily tasks reminder error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
