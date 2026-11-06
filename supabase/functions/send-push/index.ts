// Envia uma notificação da app (tabela notifications) como push para todos os
// dispositivos ativados pelo destinatário (tabela push_subscriptions).
// Chamada pelo trigger notifications_send_push com a chave de serviço.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function jwtRole(token: string): string | null {
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

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Só o próprio servidor (trigger com a chave de serviço) pode chamar. A assinatura do
  // JWT já é validada pela Supabase (verify_jwt = true); aqui exige-se o papel service_role.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token || (token !== serviceRoleKey && jwtRole(token) !== 'service_role')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Chaves VAPID: secrets das Edge Functions ou, na falta deles, o vault (get_vapid_keys)
  let publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  let privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) {
    const { data: k } = await supabase.rpc('get_vapid_keys')
    publicKey = publicKey || k?.public_key
    privateKey = privateKey || k?.private_key
  }
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:geral@contabilistaexplica.pt'
  if (!publicKey || !privateKey) return json({ error: 'VAPID não configurado' }, 500)
  webpush.setVapidDetails(subject, publicKey, privateKey)

  let notificationId: string | undefined
  try {
    notificationId = (await req.json())?.notification_id
  } catch { /* corpo inválido */ }
  if (!notificationId) return json({ error: 'notification_id em falta' }, 400)

  const { data: n, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, link')
    .eq('id', notificationId)
    .maybeSingle()
  if (error || !n) return json({ error: 'Notificação não encontrada' }, 404)

  const { data: subs = [] } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', n.user_id)

  const payload = JSON.stringify({ id: n.id, title: n.title, message: n.message ?? '', url: n.link || '/' })
  let enviadas = 0
  const removidas: string[] = []

  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 * 24 },
      )
      enviadas++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // Subscrição expirada ou removida no dispositivo
        await supabase.from('push_subscriptions').delete().eq('id', s.id)
        removidas.push(s.id)
      } else {
        console.error('Push falhou', status, (e as Error).message)
      }
    }
  }))

  return json({ enviadas, removidas: removidas.length })
})
