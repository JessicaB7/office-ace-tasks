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

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const dateFormatted = today.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })

    // Get tasks completed today (updated_at is today and status is concluida)
    const startOfDay = `${todayStr}T00:00:00.000Z`
    const endOfDay = `${todayStr}T23:59:59.999Z`

    const { data: completedTasks, error: taskError } = await supabase
      .from('tasks')
      .select('*, collaborators(name), clients(name)')
      .eq('status', 'concluida')
      .gte('updated_at', startOfDay)
      .lte('updated_at', endOfDay)

    if (taskError) throw taskError

    // Group by collaborator
    const byCollab: Record<string, { name: string; tasks: string[] }> = {}
    for (const task of completedTasks || []) {
      const collabName = task.collaborators?.name || 'Sem responsável'
      if (!byCollab[collabName]) byCollab[collabName] = { name: collabName, tasks: [] }
      const taskLabel = task.clients?.name
        ? `${task.title} — ${task.clients.name}`
        : task.title
      byCollab[collabName].tasks.push(taskLabel)
    }

    const collaboratorsList = Object.values(byCollab)
    const totalCompleted = (completedTasks || []).length

    // Find admin users to send the summary
    const { data: adminRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')

    if (roleError) throw roleError

    let sentCount = 0

    for (const adminRole of adminRoles || []) {
      // Get admin's email from auth
      const { data: userData } = await supabase.auth.admin.getUserById(adminRole.user_id)
      if (!userData?.user?.email) continue

      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'daily-completed-summary',
          recipientEmail: userData.user.email,
          idempotencyKey: `daily-summary-${adminRole.user_id}-${todayStr}`,
          templateData: {
            date: dateFormatted,
            collaborators: collaboratorsList,
            totalCompleted,
          },
        },
      })

      // Create in-app notification
      await supabase.from('notifications').insert({
        user_id: adminRole.user_id,
        title: 'Resumo diário de tarefas',
        message: `${totalCompleted} tarefa${totalCompleted !== 1 ? 's' : ''} concluída${totalCompleted !== 1 ? 's' : ''} hoje.`,
        type: 'daily_summary',
      })

      sentCount++
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount, totalCompleted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Daily summary error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
