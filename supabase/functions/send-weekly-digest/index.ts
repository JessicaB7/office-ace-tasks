import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get all active collaborators
    const { data: collaborators, error: collabError } = await supabase
      .from('collaborators')
      .select('*')
      .eq('active', true)

    if (collabError) throw collabError

    const now = new Date()
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const weekRange = `${monday.getDate()}–${sunday.getDate()} ${monday.toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}`

    const priorityLabels: Record<string, string> = {
      baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
    }

    let sentCount = 0

    for (const collab of collaborators || []) {
      if (!collab.email || !collab.user_id) continue

      // Get pending tasks for this collaborator due this week or overdue
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

      // Send email
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'weekly-tasks-digest',
          recipientEmail: collab.email,
          idempotencyKey: `weekly-digest-${collab.id}-${monday.toISOString().split('T')[0]}`,
          templateData: {
            collaboratorName: collab.name,
            tasks: taskList,
            weekRange,
          },
        },
      })

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_id: collab.user_id,
        title: 'Resumo semanal de tarefas',
        message: `Tem ${taskList.length} tarefa${taskList.length !== 1 ? 's' : ''} pendente${taskList.length !== 1 ? 's' : ''} esta semana.`,
        type: 'weekly_digest',
      })

      sentCount++
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Weekly digest error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
